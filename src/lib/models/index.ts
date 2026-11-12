import { MODEL_CACHE_PREFIX } from '../local-db/models';
import { hostedModelsSupported } from './device';
import {
  MODEL_IDS,
  type ModelFile,
  type ModelId,
  type ModelManifest,
  parseManifest,
  sha256,
} from './manifest';

export { type HostedModelSupport, hostedModelsSupported } from './device';
export type { ModelId } from './manifest';
export type ModelState = 'not-hosted' | 'not-downloaded' | 'downloading' | 'ready';
export interface ModelProgress {
  loaded: number;
  total: number;
}
export interface DownloadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ModelProgress) => void;
}
export interface HostedModel {
  id: ModelId;
  displayName: string;
  purpose: 'transcription' | 'prepared-voice';
  downloadBytes: number;
}
export type ModelErrorReason =
  | 'not-hosted'
  | 'unsupported'
  | 'not-ready'
  | 'busy'
  | 'integrity'
  | 'network'
  | 'aborted';
export class ModelError extends Error {
  constructor(
    public readonly reason: ModelErrorReason,
    message: string
  ) {
    super(message);
    this.name = 'ModelError';
  }
}
const BASE = '/models/';
let manifestPromise: Promise<ModelManifest | null> | undefined;
const downloads = new Map<ModelId, { controller: AbortController; done: Promise<void> }>();

async function manifest(): Promise<ModelManifest | null> {
  if (!manifestPromise)
    manifestPromise = (async () => {
      try {
        const response = await fetch(`${BASE}manifest.json`, {
          redirect: 'error',
          credentials: 'same-origin',
        });
        if (!response.ok) return null;
        const text = await response.text();
        if (text.length > 1_000_000) return null;
        return parseManifest(JSON.parse(text));
      } catch {
        return null;
      }
    })();
  return manifestPromise;
}
/** One small, memoized same-origin manifest request. Never fetches model bytes. */
export async function hostedModelsAvailable(): Promise<boolean> {
  return (await manifest()) !== null;
}
/** Sizes include the shared single-threaded runtime, since each model works on its own. */
export async function hostedModelCatalogue(): Promise<HostedModel[]> {
  const data = await manifest();
  if (!data) return [];
  return MODEL_IDS.map((id) => ({
    id,
    displayName: id === 'kokoro' ? 'Kokoro' : 'Whisper tiny.en',
    purpose: id === 'kokoro' ? 'prepared-voice' : 'transcription',
    downloadBytes: data.models[id].reduce((sum, path) => sum + data.files[path].bytes, 0),
  }));
}
async function cacheName(id: ModelId, data: ModelManifest): Promise<string> {
  return `${MODEL_CACHE_PREFIX}${id}-${await sha256(new TextEncoder().encode(JSON.stringify(data)))}`;
}
const urlFor = (path: string) => new URL(`${BASE}${path}`, location.origin).href;
function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw new ModelError('aborted', 'Model operation cancelled.');
}

export async function getModelState(id: ModelId): Promise<ModelState> {
  const data = await manifest();
  if (!data) return 'not-hosted';
  if (downloads.has(id)) return 'downloading';
  try {
    const name = await cacheName(id, data);
    if (!(await caches.has(name))) return 'not-downloaded';
    const cache = await caches.open(name);
    for (const path of data.models[id]) {
      const response = await cache.match(urlFor(path));
      if (!response || Number(response.headers.get('content-length')) !== data.files[path].bytes)
        return 'not-downloaded';
    }
    return 'ready';
  } catch {
    return 'not-downloaded';
  }
}

/** Fetch bounded chunks and verify both chunk and assembled hashes before returning bytes. */
async function assembleFile(
  file: ModelFile,
  options: DownloadOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Uint8Array(file.bytes);
  let offset = 0;
  for (const part of file.parts) {
    abort(options.signal);
    const response = await fetch(urlFor(part.path), {
      signal: options.signal,
      redirect: 'error',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok || !response.body) throw new ModelError('network', 'Model download failed.');
    const reader = response.body.getReader();
    const start = offset;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        abort(options.signal);
        if (offset + value.length > start + part.bytes)
          throw new ModelError('integrity', 'Model chunk size mismatch.');
        output.set(value, offset);
        offset += value.length;
        options.onProgress?.({ loaded: offset, total: file.bytes });
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (
      offset - start !== part.bytes ||
      (await sha256(output.slice(start, offset))) !== part.sha256
    )
      throw new ModelError('integrity', 'Model chunk integrity failure.');
  }
  if (offset !== file.bytes || (await sha256(output)) !== file.sha256)
    throw new ModelError('integrity', 'Model integrity failure.');
  abort(options.signal);
  return output;
}

/** The sole model-byte network path. Call only after a visitor accepts the displayed size. */
export async function downloadModel(id: ModelId, options: DownloadOptions = {}): Promise<void> {
  abort(options.signal);
  if (!hostedModelsSupported().supported)
    throw new ModelError('unsupported', 'Hosted models require a supported desktop browser.');
  const data = await manifest();
  if (!data) throw new ModelError('not-hosted', 'This site does not host models.');
  if (downloads.has(id)) throw new ModelError('busy', 'This model is already downloading.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const done = (async () => {
    const name = await cacheName(id, data);
    const cache = await caches.open(name);
    let completed = false;
    try {
      const total = data.models[id].reduce((n, path) => n + data.files[path].bytes, 0);
      let loaded = 0;
      options.onProgress?.({ loaded, total });
      for (const path of data.models[id]) {
        abort(controller.signal);
        const bytes = await assembleFile(data.files[path], {
          signal: controller.signal,
          onProgress: (p) => options.onProgress?.({ loaded: loaded + p.loaded, total }),
        });
        await cache.put(
          urlFor(path),
          new Response(bytes, {
            headers: {
              'Content-Length': String(bytes.length),
              'Content-Type': path.endsWith('.json')
                ? 'application/json'
                : path.endsWith('.mjs')
                  ? 'text/javascript'
                  : 'application/octet-stream',
            },
          })
        );
        loaded += bytes.length;
      }
      abort(controller.signal);
      completed = true;
    } finally {
      if (!completed) await caches.delete(name);
    }
  })();
  downloads.set(id, { controller, done });
  try {
    await done;
  } catch (error) {
    if (controller.signal.aborted) throw new ModelError('aborted', 'Model download cancelled.');
    throw error;
  } finally {
    downloads.delete(id);
    options.signal?.removeEventListener('abort', cancel);
  }
}

/** Cancels a pending download and removes every cached revision of this model. */
export async function deleteModel(id: ModelId): Promise<void> {
  const running = downloads.get(id);
  running?.controller.abort();
  await running?.done.catch(() => {});
  for (const name of await caches.keys())
    if (name.startsWith(`${MODEL_CACHE_PREFIX}${id}-`)) await caches.delete(name);
}

/** Transformers.js fetch hook. Reads verified assembled files only and never falls through to the network. */
export async function createModelFetch(id: ModelId): Promise<typeof fetch> {
  const data = await manifest();
  if (!data || (await getModelState(id)) !== 'ready')
    throw new ModelError('not-ready', 'Download this model before using it.');
  const cache = await caches.open(await cacheName(id, data));
  return async (input, init) => {
    abort(init?.signal ?? undefined);
    const url = new URL(input instanceof Request ? input.url : input.toString(), location.origin);
    const path = url.pathname.slice(BASE.length);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith(BASE) ||
      url.search ||
      !data.models[id].includes(path)
    )
      throw new ModelError('not-ready', 'Unlisted model request refused.');
    const saved = await cache.match(url.href);
    if (!saved) throw new ModelError('not-ready', 'This model was removed from this device.');
    return saved;
  };
}
