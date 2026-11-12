import runtimeModuleUrl from 'virtual:speech-runtime';
import { createModelFetch } from '../models';

// This module is created only by transcribe or prepareSpokenQuestions after a ready check.
self.onmessage = async (
  event: MessageEvent<
    { kind: 'transcribe'; audio: Float32Array } | { kind: 'prepare'; texts: string[] }
  >
) => {
  const request = event.data;
  try {
    const id = request.kind === 'transcribe' ? 'whisper-tiny-en' : 'kokoro';
    const modelFetch = await createModelFetch(id);
    const { env, pipeline } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = '/models/';
    env.useBrowserCache = false;
    env.useWasmCache = false;
    env.useFS = false;
    env.fetch = modelFetch;
    // Kokoro's voice loader and the runtime also use global fetch. Both are cache-only.
    globalThis.fetch = modelFetch;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) throw new Error('WASM runtime is unavailable.');
    wasm.numThreads = 1;
    wasm.proxy = false;
    wasm.wasmPaths = { mjs: new URL(runtimeModuleUrl, self.location.origin).href };
    wasm.wasmBinary = new Uint8Array(
      await (await modelFetch('/models/runtime/ort-wasm-simd-threaded.asyncify.wasm')).arrayBuffer()
    );
    const progress = (
      phase: 'loading' | 'transcribing' | 'synthesizing',
      completed: number,
      total: number
    ) => self.postMessage({ kind: 'progress', progress: { phase, completed, total } });
    progress('loading', 0, 1);
    if (request.kind === 'transcribe') {
      const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
        device: 'wasm',
        dtype: 'q8',
      });
      progress('loading', 1, 1);
      progress('transcribing', 0, 1);
      const result = await asr(request.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      const output = Array.isArray(result) ? result[0] : result;
      const segments = (output.chunks ?? []).map(
        (chunk: { text: string; timestamp: [number | null, number | null] }) => ({
          text: chunk.text.trim(),
          start: chunk.timestamp[0] ?? 0,
          end: chunk.timestamp[1] ?? request.audio.length / 16000,
        })
      );
      progress('transcribing', 1, 1);
      self.postMessage({ kind: 'result', value: { text: output.text.trim(), segments } });
    } else {
      const { KokoroTTS } = await import('kokoro-js');
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        device: 'wasm',
        dtype: 'q8',
      });
      progress('loading', 1, 1);
      const result: [string, Blob][] = [];
      progress('synthesizing', 0, request.texts.length);
      for (const text of request.texts) {
        const audio = await tts.generate(text, { voice: 'af_heart' });
        result.push([text, audio.toBlob()]);
        progress('synthesizing', result.length, request.texts.length);
      }
      self.postMessage({ kind: 'result', value: result });
    }
  } catch {
    self.postMessage({ kind: 'error' });
  }
};
