import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { recognizeOnDevice, speakBuiltIn } from '../src/lib/speech/built-in';
import {
  localVoices,
  onDeviceRecognitionState,
  speechCapabilities,
} from '../src/lib/speech/capabilities';
import { createRecorder } from '../src/lib/speech/recorder';

class Recognition extends EventTarget {
  static status = 'available';
  static available = vi.fn(async () => Recognition.status);
  static start = vi.fn();
  processLocally = false;
  lang = '';
  continuous = false;
  interimResults = false;
  start() {
    Recognition.start(this.processLocally);
    queueMicrotask(() => this.dispatchEvent(new Event('end')));
  }
  stop() {}
  abort() {}
}
beforeEach(() => {
  vi.unstubAllGlobals();
  Recognition.start.mockClear();
  Recognition.available.mockClear();
  Recognition.status = 'available';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('speech capability detection', () => {
  test.each(['available', 'downloadable', 'downloading', 'unavailable'])(
    'detects %s without starting or installing recognition',
    async (status) => {
      Recognition.status = status;
      vi.stubGlobal('SpeechRecognition', Recognition);
      expect(await onDeviceRecognitionState()).toBe(
        status === 'available'
          ? 'available'
          : status === 'unavailable'
            ? 'unsupported'
            : 'downloadable'
      );
      expect(Recognition.available).toHaveBeenCalledWith({
        langs: ['en-US'],
        processLocally: true,
      });
      expect(Recognition.start).not.toHaveBeenCalled();
    }
  );
  test('fails closed without the local property or availability method', async () => {
    vi.stubGlobal('SpeechRecognition', class extends EventTarget {});
    expect(await onDeviceRecognitionState()).toBe('unsupported');
    await expect(recognizeOnDevice()).rejects.toMatchObject({ reason: 'recognition-unavailable' });
  });
  test('starts only with processLocally true after an available check', async () => {
    vi.stubGlobal('SpeechRecognition', Recognition);
    await expect(recognizeOnDevice()).resolves.toBe('');
    expect(Recognition.start).toHaveBeenCalledWith(true);
    Recognition.status = 'downloadable';
    await expect(recognizeOnDevice()).rejects.toMatchObject({ reason: 'recognition-unavailable' });
    expect(Recognition.start).toHaveBeenCalledTimes(1);
  });
  test('only lists local voices and waits for voiceschanged', async () => {
    const synthesis = new EventTarget();
    const local = { localService: true, voiceURI: 'local', lang: 'en-US' };
    let voices: object[] = [];
    vi.stubGlobal('speechSynthesis', Object.assign(synthesis, { getVoices: () => voices }));
    const pending = localVoices();
    voices = [{ localService: false, voiceURI: 'remote' }, local];
    synthesis.dispatchEvent(new Event('voiceschanged'));
    expect(await pending).toEqual([local]);
  });
  test('voice wait has a deadline and missing media APIs report unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('speechSynthesis', Object.assign(new EventTarget(), { getVoices: () => [] }));
    const pending = speechCapabilities();
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).localVoices).toEqual([]);
    expect((await pending).mediaRecorder).toEqual({ supported: false, mimeType: null });
  });
  test('does not probe on-device recognition unless asked', async () => {
    const available = vi.fn(async () => 'available');
    class Recognition {
      processLocally = false;
      static available = available;
    }
    vi.stubGlobal('SpeechRecognition', Recognition);
    vi.stubGlobal('speechSynthesis', { getVoices: () => [{ localService: true }] });
    expect((await speechCapabilities()).recognition).toBe('unsupported');
    expect(available).not.toHaveBeenCalled();
    await speechCapabilities({ probeRecognition: true });
    expect(available).toHaveBeenCalled();
  });
  test('never speaks using a remote voice', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { getVoices: () => [{ localService: false }], speak });
    await expect(speakBuiltIn('Question')).rejects.toMatchObject({ reason: 'no-local-voice' });
    expect(speak).not.toHaveBeenCalled();
  });
  test('speaks a selected local voice, resolves on end and cancels on abort', async () => {
    const voice = { localService: true, voiceURI: 'local', lang: 'en-US' };
    let utterance: { onend: (() => void) | null; onerror: (() => void) | null; voice: unknown } = {
      onend: null,
      onerror: null,
      voice: null,
    };
    const cancel = vi.fn();
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        onend = null;
        onerror = null;
        voice = null;
      }
    );
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [voice],
      cancel,
      speak: (value: typeof utterance) => {
        utterance = value;
      },
    });
    const pending = speakBuiltIn('Question', { voiceURI: 'local' });
    await vi.waitFor(() => expect(utterance.voice).toBe(voice));
    utterance.onend?.();
    await pending;
    const controller = new AbortController();
    const aborted = speakBuiltIn('Question', { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ reason: 'aborted' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

class FakeRecorder {
  static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
  static latest: FakeRecorder;
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor() {
    FakeRecorder.latest = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio']) });
      this.onstop?.();
    });
  }
}
function media(getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }))) {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  return getUserMedia;
}
const track = { stop: vi.fn() };
beforeEach(() => {
  track.stop.mockClear();
});
describe('recorder lifecycle', () => {
  test('returns a blob and duration, requests audio only and releases tracks on stop', async () => {
    const getUserMedia = media();
    const recorder = createRecorder();
    await recorder.start();
    await expect(recorder.start()).rejects.toMatchObject({ reason: 'busy' });
    const result = await recorder.stop();
    expect(result.blob.size).toBe(5);
    expect(result.mimeType).toBe('audio/webm;codecs=opus');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(track.stop).toHaveBeenCalled();
    await expect(recorder.stop()).rejects.toMatchObject({ reason: 'not-recording' });
  });
  test('cancel releases tracks and discards the take', async () => {
    media();
    const recorder = createRecorder();
    await recorder.start();
    recorder.cancel();
    expect(track.stop).toHaveBeenCalled();
    await expect(recorder.stop()).rejects.toMatchObject({ reason: 'not-recording' });
  });
  test('cancel during permission acquisition stops the late stream', async () => {
    let release!: (stream: { getTracks(): (typeof track)[] }) => void;
    media(
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )
    );
    const recorder = createRecorder();
    const start = recorder.start();
    recorder.cancel();
    release({ getTracks: () => [track] });
    await expect(start).rejects.toMatchObject({ reason: 'aborted' });
    expect(track.stop).toHaveBeenCalled();
  });
  test.each([
    ['NotAllowedError', 'permission-denied'],
    ['NotFoundError', 'no-device'],
  ])('types %s failures', async (name, reason) => {
    media(
      vi.fn(async () => {
        throw new DOMException('no', name);
      })
    );
    await expect(createRecorder().start()).rejects.toMatchObject({ reason });
  });
  test('releases tracks on recorder errors', async () => {
    media();
    const recorder = createRecorder();
    await recorder.start();
    FakeRecorder.latest.onerror?.();
    expect(track.stop).toHaveBeenCalled();
    await expect(recorder.stop()).rejects.toMatchObject({ reason: 'not-recording' });
  });
  test('reports a bounded analyser level and closes its audio context', async () => {
    media();
    const close = vi.fn(async () => {});
    const disconnect = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class {
        close = close;
        resume = async () => {};
        createMediaStreamSource() {
          return { connect: vi.fn(), disconnect };
        }
        createAnalyser() {
          return { fftSize: 256, getFloatTimeDomainData: (array: Float32Array) => array.fill(0.5) };
        }
      }
    );
    let tick!: () => void;
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      tick = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const onLevel = vi.fn();
    const recorder = createRecorder({ onLevel });
    await recorder.start();
    tick();
    expect(onLevel).toHaveBeenCalledWith(0.5);
    recorder.cancel();
    expect(close).toHaveBeenCalled();
    expect(onLevel).toHaveBeenLastCalledWith(0);
  });
});
