import { recorderMimeType } from './capabilities';
import { SpeechError } from './errors';
export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}
export interface RecorderOptions {
  onLevel?: (level: number) => void;
}
export interface SpeechRecorder {
  start(): Promise<void>;
  stop(): Promise<RecordedAudio>;
  cancel(): void;
}
/** Capture stays in memory. The caller decides whether to keep a take in IndexedDB. */
export function createRecorder(options: RecorderOptions = {}): SpeechRecorder {
  let state: 'idle' | 'starting' | 'recording' | 'stopping' = 'idle';
  let generation = 0;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let context: AudioContext | undefined;
  let frame = 0;
  let started = 0;
  let stopped: number | undefined;
  let chunks: Blob[] = [];
  let completion: Promise<RecordedAudio> | undefined;
  let resolveStop: ((audio: RecordedAudio) => void) | undefined;
  let rejectStop: ((error: SpeechError) => void) | undefined;
  const cleanup = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = undefined;
    if (context) void context.close().catch(() => {});
    context = undefined;
    options.onLevel?.(0);
  };
  const fail = (error: SpeechError) => {
    cleanup();
    state = 'idle';
    chunks = [];
    rejectStop?.(error);
    resolveStop = undefined;
    rejectStop = undefined;
  };
  return {
    async start() {
      if (state !== 'idle') throw new SpeechError('busy', 'The microphone is already recording.');
      const mimeType = recorderMimeType();
      if (!mimeType) throw new SpeechError('unsupported', 'Audio recording is unavailable.');
      state = 'starting';
      const ticket = ++generation;
      let acquired: MediaStream | undefined;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (ticket !== generation) {
          for (const track of acquired.getTracks()) track.stop();
          throw new SpeechError('aborted', 'Recording cancelled.');
        }
        stream = acquired;
        recorder = new MediaRecorder(stream, { mimeType });
        chunks = [];
        completion = new Promise((resolve, reject) => {
          resolveStop = resolve;
          rejectStop = reject;
        });
        // Capture failures can occur before the caller asks to stop.
        void completion.catch(() => {});
        recorder.ondataavailable = (event) => {
          if (ticket === generation && event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => {
          if (ticket === generation)
            fail(new SpeechError('capture-failed', 'Audio recording failed.'));
        };
        recorder.onstop = () => {
          if (ticket !== generation) return;
          const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType });
          const durationMs = Math.max(0, (stopped ?? performance.now()) - started);
          cleanup();
          state = 'idle';
          chunks = [];
          resolveStop?.({ blob, mimeType: blob.type, durationMs });
          resolveStop = undefined;
          rejectStop = undefined;
        };
        if (options.onLevel && typeof AudioContext !== 'undefined') {
          context = new AudioContext();
          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples = new Float32Array(analyser.fftSize);
          const tick = () => {
            analyser.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
            options.onLevel?.(Math.min(1, Math.max(0, rms)));
            frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
          await context.resume();
        }
        if (ticket !== generation) throw new SpeechError('aborted', 'Recording cancelled.');
        stopped = undefined;
        started = performance.now();
        recorder.start();
        state = 'recording';
      } catch (error) {
        for (const track of acquired?.getTracks() ?? []) track.stop();
        const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
        const typed =
          error instanceof SpeechError
            ? error
            : new SpeechError(
                name === 'NotAllowedError' || name === 'SecurityError'
                  ? 'permission-denied'
                  : name === 'NotFoundError' || name === 'DevicesNotFoundError'
                    ? 'no-device'
                    : 'capture-failed',
                name === 'NotAllowedError'
                  ? 'Microphone permission was denied.'
                  : name === 'NotFoundError'
                    ? 'No microphone was found.'
                    : 'Audio recording failed.'
              );
        if (ticket === generation) fail(typed);
        throw typed;
      }
    },
    async stop() {
      if (state !== 'recording' || !recorder || !completion)
        throw new SpeechError('not-recording', 'No recording is running.');
      state = 'stopping';
      stopped = performance.now();
      try {
        recorder.stop();
      } catch {
        fail(new SpeechError('capture-failed', 'Audio recording failed.'));
      }
      // Release the microphone now, even if the final data event is delayed.
      cleanup();
      return completion;
    },
    cancel() {
      ++generation;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {}
      }
      fail(new SpeechError('aborted', 'Recording cancelled.'));
    },
  };
}
