// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { localSpeechRuntime } from '../scripts/models/build.mjs';

test('the pinned Kokoro adapter removes its remote URL and unmanaged voice cache', () => {
  const source = readFileSync('node_modules/kokoro-js/dist/kokoro.js', 'utf8');
  const result = localSpeechRuntime().transform(source, '/node_modules/kokoro-js/dist/kokoro.js');
  expect(result?.code).not.toContain('https://huggingface.co/');
  expect(result?.code).not.toContain('kokoro-voices');
  expect(result?.code).toContain('/models/onnx-community/Kokoro-82M-v1.0-ONNX/voices/');
  expect(() =>
    localSpeechRuntime().transform(
      'changed upstream code',
      '/node_modules/kokoro-js/dist/kokoro.js'
    )
  ).toThrow();
});
test('ONNX defaults cannot cause Vite to copy unchunked WASM files', () => {
  const source = readFileSync('node_modules/onnxruntime-web/dist/ort.webgpu.mjs', 'utf8');
  const result = localSpeechRuntime().transform(
    source,
    '/node_modules/onnxruntime-web/dist/ort.webgpu.mjs'
  );
  expect(result?.code).not.toMatch(/new URL\("ort-wasm.*?\.wasm"/);
  expect(result?.code).toContain('/models/runtime/ort-wasm-simd-threaded.asyncify.wasm');
});
