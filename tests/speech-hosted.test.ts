import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ ready: true }));
vi.mock('../src/lib/models', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hostedModelsSupported: () => ({ supported: true, reason: null }),
  getModelState: async () => (state.ready ? 'ready' : 'not-downloaded'),
}));

import { playAudio, prepareSpokenQuestions, transcribe } from '../src/lib/speech/hosted';

class FakeWorker {
  static latest: FakeWorker;
  static hold = false;
  onmessage?: (event: { data: object }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  message?: { kind: string; audio?: Float32Array; texts?: string[] };
  terminate = vi.fn();
  constructor() {
    FakeWorker.latest = this;
  }
  postMessage(message: typeof this.message) {
    this.message = message;
    if (FakeWorker.hold) return;
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          kind: 'result',
          value:
            message?.kind === 'transcribe'
              ? { text: 'hello', segments: [{ text: 'hello', start: 0, end: 1 }] }
              : message?.texts?.map((text) => [text, new Blob(['audio'])]),
        },
      })
    );
  }
}
const close = vi.fn(async () => {});
let mono: Float32Array;
let frames: number;
beforeEach(() => {
  vi.unstubAllGlobals();
  state.ready = true;
  FakeWorker.hold = false;
  close.mockClear();
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal(
    'AudioContext',
    class {
      close = close;
      async decodeAudioData() {
        return {
          length: 48000,
          duration: 1,
          sampleRate: 48000,
          numberOfChannels: 2,
          getChannelData: (channel: number) => new Float32Array(48000).fill(channel ? 0.75 : 0.25),
        };
      }
    }
  );
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      destination = {};
      constructor(_channels: number, length: number, _rate: number) {
        frames = length;
      }
      createBuffer() {
        mono = new Float32Array(48000);
        return { getChannelData: () => mono };
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn() };
      }
      async startRendering() {
        return { getChannelData: () => new Float32Array(16000).fill(mono[0]) };
      }
    }
  );
});
test('transcription averages stereo, resamples to 16 kHz and transfers the buffer to a disposable worker', async () => {
  const blob = { arrayBuffer: async () => new ArrayBuffer(8) } as Blob;
  expect((await transcribe(blob)).text).toBe('hello');
  expect(mono[0]).toBe(0.5);
  expect(frames).toBe(16000);
  expect(FakeWorker.latest.message?.audio?.length).toBe(16000);
  expect(FakeWorker.latest.terminate).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
test('inference requires ready models and never downloads them', async () => {
  state.ready = false;
  await expect(transcribe(new Blob())).rejects.toMatchObject({ reason: 'not-ready' });
  await expect(prepareSpokenQuestions(['Question'])).rejects.toMatchObject({ reason: 'not-ready' });
});
test('prepares distinct nonempty questions and returns blobs keyed by their exact text', async () => {
  const questions = await prepareSpokenQuestions(['One?', 'Two?', 'One?', '  ']);
  expect(FakeWorker.latest.message?.texts).toEqual(['One?', 'Two?']);
  expect([...questions.keys()]).toEqual(['One?', 'Two?']);
  expect(questions.get('One?')).toBeInstanceOf(Blob);
  expect(FakeWorker.latest.terminate).toHaveBeenCalled();
});
test('cancellation terminates the inference worker', async () => {
  FakeWorker.hold = true;
  const controller = new AbortController();
  const pending = prepareSpokenQuestions(['One?'], { signal: controller.signal });
  await vi.waitFor(() => expect(FakeWorker.latest.message?.texts).toEqual(['One?']));
  controller.abort();
  await expect(pending).rejects.toMatchObject({ reason: 'aborted' });
  expect(FakeWorker.latest.terminate).toHaveBeenCalled();
});
test('pre-aborted speech does not create a worker', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    prepareSpokenQuestions(['One?'], { signal: controller.signal })
  ).rejects.toMatchObject({ reason: 'aborted' });
});
test.each(['ended', 'abort', 'error'])('playback revokes its URL on %s', async (mode) => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:audio', revokeObjectURL });
  let audio: { onended: (() => void) | null; onerror: (() => void) | null } = {
    onended: null,
    onerror: null,
  };
  vi.stubGlobal(
    'Audio',
    class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        audio = this;
      }
      play = async () => {};
      pause = vi.fn();
      removeAttribute = vi.fn();
      load = vi.fn();
    }
  );
  const controller = new AbortController();
  const pending = playAudio(new Blob(), { signal: controller.signal });
  if (mode === 'ended') {
    audio.onended?.();
    await pending;
  } else {
    if (mode === 'abort') controller.abort();
    else audio.onerror?.();
    await expect(pending).rejects.toMatchObject({
      reason: mode === 'abort' ? 'aborted' : 'playback-failed',
    });
  }
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:audio');
});
