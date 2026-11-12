/**
 * Downloaded models live in the Cache API, never in IndexedDB or
 * localStorage, and only after the student pressed a button that states the
 * size. This file measures and deletes them. It never downloads anything.
 */

import { failureFrom, type LocalDbResult, success } from './db';

/** Model files are cached only under names with this prefix, after an opt-in download. */
export const MODEL_CACHE_PREFIX = 'models-';

export interface ModelCacheSize {
  name: string;
  entries: number;
  bytes: number;
}

export interface ModelCachesReport {
  available: boolean;
  bytes: number;
  caches: ModelCacheSize[];
}

function getCaches(): CacheStorage | null {
  try {
    return typeof caches === 'undefined' ? null : caches;
  } catch {
    return null;
  }
}

async function modelCacheNames(storage: CacheStorage): Promise<string[]> {
  return (await storage.keys()).filter((name) => name.startsWith(MODEL_CACHE_PREFIX));
}

async function responseBytes(response: Response): Promise<number> {
  const header = Number(response.headers.get('content-length'));
  if (Number.isFinite(header) && header > 0) return header;
  return (await response.blob()).size;
}

/** Bytes held by each model cache. Empty when the Cache API is unavailable. */
export async function modelCacheSizes(): Promise<ModelCachesReport> {
  const storage = getCaches();
  if (!storage) return { available: false, bytes: 0, caches: [] };
  try {
    const result: ModelCacheSize[] = [];
    for (const name of await modelCacheNames(storage)) {
      const cache = await storage.open(name);
      let bytes = 0;
      const requests = await cache.keys();
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) bytes += await responseBytes(response);
      }
      result.push({ name, entries: requests.length, bytes });
    }
    return { available: true, bytes: result.reduce((sum, c) => sum + c.bytes, 0), caches: result };
  } catch {
    return { available: false, bytes: 0, caches: [] };
  }
}

/** Delete every downloaded model. Resolves with how many caches were removed. */
export async function deleteModels(): Promise<LocalDbResult<number>> {
  const storage = getCaches();
  // Without the Cache API no model can have been downloaded.
  if (!storage) return success(0);
  try {
    let removed = 0;
    for (const name of await modelCacheNames(storage)) {
      if (await storage.delete(name)) removed++;
    }
    return success(removed);
  } catch (error) {
    return failureFrom(error);
  }
}

/** True when at least one model cache holds an entry. */
export async function hasDownloadedModels(): Promise<boolean> {
  const storage = getCaches();
  if (!storage) return false;
  try {
    for (const name of await modelCacheNames(storage)) {
      if ((await (await storage.open(name)).keys()).length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}
