import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/** Patch only the pinned voice loader. A package change must fail the build. */
export function localSpeechRuntime() {
  return {
    name: 'local-speech-runtime',
    enforce: 'pre',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.fileName.endsWith('.wasm'))
          throw new Error('WASM must be downloaded through the verified opt-in model cache.');
      }
      const visited = new Set();
      const visit = (name) => {
        if (visited.has(name)) return;
        visited.add(name);
        const chunk = bundle[name];
        if (chunk?.type !== 'chunk') return;
        if (
          Object.keys(chunk.modules).some((id) =>
            /node_modules\/(?:@huggingface\/transformers|kokoro-js)\//.test(id)
          )
        )
          throw new Error(
            'A speech dependency entered an eager chunk. Keep its import inside a visitor-triggered function.'
          );
        for (const imported of chunk.imports) visit(imported);
      };
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName);
      }
    },
    resolveId(id) {
      if (id === 'virtual:speech-runtime') return '\0speech-runtime';
      if (id === 'onnxruntime-web/webgpu') {
        const require = createRequire(import.meta.url);
        return resolve(dirname(require.resolve('onnxruntime-web')), 'ort.webgpu.mjs');
      }
    },
    load(id) {
      if (id !== '\0speech-runtime') return;
      const require = createRequire(import.meta.url);
      const path = resolve(
        dirname(require.resolve('onnxruntime-web')),
        'ort-wasm-simd-threaded.asyncify.mjs'
      );
      const source = readFileSync(path);
      const hash = createHash('sha256').update(source).digest('hex');
      if (hash !== '0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611')
        throw new Error('Speech runtime changed. Verify the new runtime before updating its pin.');
      const ref = this.emitFile({ type: 'asset', name: 'speech-ort.mjs', source });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/onnxruntime-web/dist/ort.webgpu.mjs')) {
        const pattern =
          /new URL\("(ort-wasm-simd-threaded(?:\.\w+)?\.wasm)", import\.meta\.url\)\.href/g;
        const matches = [...code.matchAll(pattern)];
        if (matches.length !== 4)
          throw new Error('ONNX runtime fallback changed. Review the cache-only adapter.');
        return {
          code: code.replace(pattern, (_, file) => JSON.stringify(`/models/runtime/${file}`)),
          map: null,
        };
      }
      if (!id.replaceAll('\\', '/').endsWith('/kokoro-js/dist/kokoro.js')) return;
      const remote =
        'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/';
      const cache =
        't=await caches.open("kokoro-voices");const e=await t.match(a);if(e)return await e.arrayBuffer()';
      if (!code.includes(remote) || !code.includes(cache))
        throw new Error('Kokoro voice loader changed. Review its local-only adapter.');
      // The worker fetch hook owns all reads. No second, unmanaged voice cache.
      return {
        code: code
          .replace(remote, '/models/onnx-community/Kokoro-82M-v1.0-ONNX/voices/')
          .replace(cache, 't=null'),
        map: null,
      };
    },
  };
}

/** Emit reviewable library entries without adding either entry to a page. */
export function speechLibraries() {
  return {
    name: 'speech-libraries',
    hooks: {
      'astro:build:start': async () => {
        if (process.env.HOSTED_MODELS !== '1')
          await rm(new URL('../../public/models/', import.meta.url), {
            recursive: true,
            force: true,
          });
      },
      'astro:build:setup': ({ updateConfig }) => {
        updateConfig({
          // Lets the page skip the manifest request, and its 404, when no models are hosted.
          define: { __HOSTED_MODELS__: JSON.stringify(process.env.HOSTED_MODELS === '1') },
          plugins: [
            {
              name: 'speech-library-entries',
              applyToEnvironment(environment) {
                return environment.name === 'client';
              },
              buildStart() {
                for (const name of ['speech', 'models'])
                  this.emitFile({
                    type: 'chunk',
                    id: resolve(`src/lib/${name}/index.ts`),
                    name,
                    preserveSignature: 'strict',
                  });
              },
            },
          ],
        });
      },
    },
  };
}
