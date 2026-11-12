/**
 * What this site keeps on the device and how large it is, for the Storage
 * panel. Every figure is measured from what is stored; nothing is estimated
 * except the browser's own `navigator.storage.estimate()`, which is reported
 * separately and labeled as the browser's figure.
 *
 * The bulk deletes the panel offers are `deleteAllRecordings` (records.ts)
 * and `deleteModels` (models.ts).
 */

import { STUDIO_STORAGE_KEYS } from '../studio-backup';
import {
  DB_STORES,
  jsonBytes,
  openLocalDb,
  readSoft,
  requestResult,
  SINGLE_RECORD_KEY,
} from './db';
import { type ModelCachesReport, modelCacheSizes } from './models';
import { listRecordings } from './records';

export interface LocalStorageEntry {
  key: string;
  /** UTF-16 size of key and value, which is how browsers hold localStorage. */
  bytes: number;
  /** The key is carried in the backup file. */
  inBackup: boolean;
}

export interface StoreSize {
  /** Records in the store. */
  count: number;
  bytes: number;
}

export interface StorageReport {
  localStorage: {
    available: boolean;
    bytes: number;
    /** Largest first. */
    entries: LocalStorageEntry[];
  };
  indexedDb: {
    available: boolean;
    bytes: number;
    stores: {
      /** Audio plus metadata. */
      recordings: StoreSize;
      resumeFile: StoreSize;
      resumeDocument: StoreSize;
    };
  };
  models: ModelCachesReport;
  /** localStorage, IndexedDB, and model caches added together. */
  totalBytes: number;
  /** The browser's own figure for this site, when it offers one. */
  browserEstimate: { usage: number; quota: number } | null;
}

function readLocalStorage(): StorageReport['localStorage'] {
  const backupKeys = new Set<string>(STUDIO_STORAGE_KEYS);
  try {
    if (typeof localStorage === 'undefined') return { available: false, bytes: 0, entries: [] };
    const entries: LocalStorageEntry[] = [];
    // Everything in this origin's localStorage belongs to this site.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key) ?? '';
      entries.push({ key, bytes: (key.length + value.length) * 2, inBackup: backupKeys.has(key) });
    }
    entries.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
    return {
      available: true,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      entries,
    };
  } catch {
    return { available: false, bytes: 0, entries: [] };
  }
}

const EMPTY: StoreSize = { count: 0, bytes: 0 };

/** Bytes and record counts per IndexedDB store. Empty when IndexedDB is unavailable. */
export async function localDbSizes(): Promise<StorageReport['indexedDb']> {
  const available = (await openLocalDb()) !== null;
  if (!available) {
    return {
      available,
      bytes: 0,
      stores: { recordings: EMPTY, resumeFile: EMPTY, resumeDocument: EMPTY },
    };
  }
  const recordings = await listRecordings();
  const recordingSize: StoreSize = {
    count: recordings.length,
    bytes: recordings.reduce((sum, meta) => sum + meta.size + jsonBytes(meta), 0),
  };
  const resumeFile = await readSoft(
    DB_STORES.resumeFile,
    async (tx) => {
      const raw = (await requestResult(
        tx.objectStore(DB_STORES.resumeFile).get(SINGLE_RECORD_KEY)
      )) as { bytes?: ArrayBuffer; name?: unknown } | undefined;
      if (!raw) return EMPTY;
      const size = raw.bytes && typeof raw.bytes.byteLength === 'number' ? raw.bytes.byteLength : 0;
      return { count: 1, bytes: size + jsonBytes({ ...raw, bytes: undefined }) };
    },
    EMPTY
  );
  const resumeDocument = await readSoft(
    DB_STORES.resumeDocument,
    async (tx) => {
      const raw = await requestResult(
        tx.objectStore(DB_STORES.resumeDocument).get(SINGLE_RECORD_KEY)
      );
      return raw === undefined ? EMPTY : { count: 1, bytes: jsonBytes(raw) };
    },
    EMPTY
  );
  return {
    available,
    bytes: recordingSize.bytes + resumeFile.bytes + resumeDocument.bytes,
    stores: { recordings: recordingSize, resumeFile, resumeDocument },
  };
}

async function browserEstimate(): Promise<StorageReport['browserEstimate']> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate || typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') {
      return null;
    }
    return { usage: estimate.usage, quota: estimate.quota };
  } catch {
    return null;
  }
}

/** Everything the site stores on this device, measured. Never writes. */
export async function storageReport(): Promise<StorageReport> {
  const local = readLocalStorage();
  const [indexedDb, models, estimate] = await Promise.all([
    localDbSizes(),
    modelCacheSizes(),
    browserEstimate(),
  ]);
  return {
    localStorage: local,
    indexedDb,
    models,
    totalBytes: local.bytes + indexedDb.bytes + models.bytes,
    browserEstimate: estimate,
  };
}
