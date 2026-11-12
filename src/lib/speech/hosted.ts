import { getModelState, hostedModelsSupported, ModelError, type ModelId } from '../models';
import { checkSignal, SpeechError } from './errors';
import type { Transcript } from './facts';
export interface TranscribeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: SpeechProgress) => void;
}
export interface SpeechProgress {
  phase: 'loading' | 'transcribing' | 'synthesizing';
  completed: number;
  total: number;
}
export interface PrepareQuestionsOptions {
  signal?: AbortSignal;
  onProgress?: (progress: SpeechProgress) => void;
}
export type PreparedQuestions = Map<string, Blob>;

async function requireModel(id: ModelId, signal?: AbortSignal): Promise<void> {
  checkSignal(signal);
  if (!hostedModelsSupported().supported)
    throw new ModelError('unsupported', 'Hosted speech requires a supported desktop browser.');
  if ((await getModelState(id)) !== 'ready')
    throw new ModelError('not-ready', 'Download this model before using it.');
  checkSignal(signal);
}

function runWorker<T>(
  message: object,
  options: TranscribeOptions,
  decode: (value: unknown) => T,
  transfer: Transferable[] = []
): Promise<T> {
  checkSignal(options.signal);
  const worker = new Worker(new URL('./speech-worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      options.signal?.removeEventListener('abort', cancel);
    };
    const fail = () => {
      finish();
      reject(new SpeechError('inference-failed', 'On-device speech processing failed.'));
    };
    const cancel = () => {
      finish();
      reject(new SpeechError('aborted', 'Speech processing cancelled.'));
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    worker.onmessage = (event) => {
      const data = event.data;
      if (data?.kind === 'progress') {
        options.onProgress?.(data.progress);
        return;
      }
      finish();
      try {
        if (data?.kind !== 'result') throw new Error('Worker failed.');
        resolve(decode(data.value));
      } catch {
        reject(new SpeechError('inference-failed', 'On-device speech processing failed.'));
      }
    };
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      worker.postMessage(message, transfer);
    } catch {
      fail();
    }
  });
}
/** Decodes in the page, averages channels and resamples to mono 16 kHz before transferring to a worker. */
export async function transcribe(blob: Blob, options: TranscribeOptions = {}): Promise<Transcript> {
  await requireModel('whisper-tiny-en', options.signal);
  options.onProgress?.({ phase: 'loading', completed: 0, total: 1 });
  const context = new AudioContext();
  let mono: Float32Array<ArrayBuffer>;
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    checkSignal(options.signal);
    if (!decoded.length || !decoded.numberOfChannels) return { text: '', segments: [] };
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * 16000)),
      16000
    );
    const buffer = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] += data[i] / decoded.numberOfChannels;
    }
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start();
    mono = new Float32Array((await offline.startRendering()).getChannelData(0));
  } finally {
    await context.close();
  }
  checkSignal(options.signal);
  return runWorker(
    { kind: 'transcribe', audio: mono },
    options,
    (value) => {
      if (
        !value ||
        typeof value !== 'object' ||
        !('text' in value) ||
        typeof value.text !== 'string' ||
        !('segments' in value) ||
        !Array.isArray(value.segments) ||
        !value.segments.every(
          (s) =>
            typeof s.text === 'string' &&
            Number.isFinite(s.start) &&
            Number.isFinite(s.end) &&
            s.start >= 0 &&
            s.end >= s.start
        )
      )
        throw new Error('Invalid transcript.');
      return value as Transcript;
    },
    [mono.buffer]
  );
}
/** Synthesizes a session's known questions before rehearsal. Dynamic questions use a local browser voice or text. */
export async function prepareSpokenQuestions(
  texts: readonly string[],
  options: PrepareQuestionsOptions = {}
): Promise<PreparedQuestions> {
  await requireModel('kokoro', options.signal);
  const unique = [...new Set(texts.filter((text) => text.trim()))];
  if (!unique.length) return new Map();
  return runWorker({ kind: 'prepare', texts: unique }, options, (value) => {
    if (
      !Array.isArray(value) ||
      !value.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          typeof pair[0] === 'string' &&
          pair[1] instanceof Blob
      )
    )
      throw new Error('Invalid prepared audio.');
    return new Map(value);
  });
}
/** Object URLs are revoked on completion, rejection and cancellation. */
export async function playAudio(
  blob: Blob,
  { signal }: { signal?: AbortSignal } = {}
): Promise<void> {
  checkSignal(signal);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: SpeechError) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => finish(new SpeechError('aborted', 'Playback cancelled.'));
    audio.onended = () => finish();
    audio.onerror = () => finish(new SpeechError('playback-failed', 'Audio could not play.'));
    signal?.addEventListener('abort', cancel, { once: true });
    void audio
      .play()
      .catch(() => finish(new SpeechError('playback-failed', 'Audio could not play.')));
  });
}
