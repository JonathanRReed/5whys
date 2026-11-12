/**
 * The site's one IndexedDB database, behind a small promise wrapper.
 *
 * IndexedDB holds what is too large or too binary for localStorage: rehearsal
 * recordings, the original resume file, and the structured resume document.
 * Nothing here runs at module load; the database opens on the first call, so
 * islands still hydrate from empty state.
 *
 * Every caller fails soft. When IndexedDB is missing or refuses to open (some
 * private windows, blocked site data), `openLocalDb` resolves to null: reads
 * then return empty and writes return a typed failure the interface can show.
 */

export const LOCAL_DB_NAME = '5whys-career-studio';
export const LOCAL_DB_VERSION = 1;

/** Object store names. Renaming one is a migration, never an edit. */
export const DB_STORES = {
  /** Recording metadata, keyed by id. Small, so listing stays cheap. */
  recordings: 'recordings',
  /** Recording audio bytes, keyed by the same id. */
  recordingAudio: 'recording-audio',
  /** The original resume file, one record. */
  resumeFile: 'resume-file',
  /** The structured resume document, one record. */
  resumeDocument: 'resume-document',
} as const;

export type DbStoreName = (typeof DB_STORES)[keyof typeof DB_STORES];

/** The fixed key for single-record stores. */
export const SINGLE_RECORD_KEY = 'current';

export type LocalDbFailureReason = 'unavailable' | 'quota' | 'invalid' | 'failed';

export interface LocalDbFailure {
  ok: false;
  reason: LocalDbFailureReason;
  /** A sentence the interface can show as it is. */
  message: string;
}

export type LocalDbResult<T = undefined> = { ok: true; value: T } | LocalDbFailure;

const FAILURE_MESSAGES: Record<LocalDbFailureReason, string> = {
  unavailable:
    'This browser is not letting the site save files on this device. Private windows can block it.',
  quota: 'This device has no room left for saved files. Delete old recordings and try again.',
  invalid: 'That could not be saved because it is not in a form this browser can store.',
  failed: 'Could not save that on this device. Try again.',
};

export function failure(reason: LocalDbFailureReason): LocalDbFailure {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

export const success = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** Map a thrown or reported IndexedDB error to a failure reason. */
export function failureFrom(error: unknown): LocalDbFailure {
  const name =
    error && typeof error === 'object' && 'name' in error ? String(error.name) : undefined;
  if (name === 'QuotaExceededError') return failure('quota');
  if (name === 'DataCloneError' || name === 'DataError') return failure('invalid');
  return failure('failed');
}

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const recordings = db.createObjectStore(DB_STORES.recordings, { keyPath: 'id' });
    recordings.createIndex('createdAt', 'createdAt');
    db.createObjectStore(DB_STORES.recordingAudio);
    db.createObjectStore(DB_STORES.resumeFile);
    db.createObjectStore(DB_STORES.resumeDocument);
  }
  // Later versions add `if (oldVersion < 2) { ... }` blocks here.
}

let connection: Promise<IDBDatabase | null> | null = null;

function getFactory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
}

/**
 * Open (or reuse) the database. Resolves to null instead of rejecting when
 * IndexedDB is unavailable. A failed open is not cached, so the next call
 * tries again.
 */
export function openLocalDb(): Promise<IDBDatabase | null> {
  if (connection) return connection;
  const pending = new Promise<IDBDatabase | null>((resolve) => {
    const factory = getFactory();
    if (!factory) {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = (event) => {
      try {
        upgrade(request.result, event.oldVersion);
      } catch {
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab is upgrading: step aside so it is not blocked.
      db.onversionchange = () => {
        db.close();
        if (connection === pending) connection = null;
      };
      db.onclose = () => {
        if (connection === pending) connection = null;
      };
      resolve(db);
    };
    request.onerror = (event) => {
      event.preventDefault();
      resolve(null);
    };
  });
  connection = pending;
  pending.then((db) => {
    if (!db && connection === pending) connection = null;
  });
  return pending;
}

/** Close the connection. The next call opens it again. */
export async function closeLocalDb(): Promise<void> {
  const current = connection;
  connection = null;
  const db = current ? await current : null;
  db?.close();
}

/** True when the database can be opened in this browser. */
export async function isLocalDbAvailable(): Promise<boolean> {
  return (await openLocalDb()) !== null;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });
}

/**
 * Run `work` inside one transaction and resolve once it commits. `work` must
 * issue its requests synchronously (or only await IDB requests), since an
 * unrelated await lets the transaction close early. Rejects when the database
 * is unavailable or the transaction fails.
 */
export async function inTransaction<T>(
  stores: DbStoreName | DbStoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => T | Promise<T>
): Promise<T> {
  const db = await openLocalDb();
  if (!db) throw new DOMException('IndexedDB is unavailable', 'UnavailableError');
  const tx = db.transaction(stores, mode);
  const done = transactionDone(tx);
  let value: T;
  try {
    value = await work(tx);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    done.catch(() => {});
    throw error;
  }
  await done;
  return value;
}

/** A read that resolves to `fallback` whenever the database cannot answer. */
export async function readSoft<T>(
  stores: DbStoreName | DbStoreName[],
  work: (tx: IDBTransaction) => T | Promise<T>,
  fallback: T
): Promise<T> {
  try {
    if (!(await openLocalDb())) return fallback;
    return await inTransaction(stores, 'readonly', work);
  } catch {
    return fallback;
  }
}

/** A write that resolves to a typed result instead of throwing. */
export async function writeSoft<T>(
  stores: DbStoreName | DbStoreName[],
  work: (tx: IDBTransaction) => T | Promise<T>
): Promise<LocalDbResult<T>> {
  if (!(await openLocalDb())) return failure('unavailable');
  try {
    return success(await inTransaction(stores, 'readwrite', work));
  } catch (error) {
    return failureFrom(error);
  }
}

const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder();

/** UTF-8 byte length of a JSON-serializable value. */
export function jsonBytes(value: unknown): number {
  const text = JSON.stringify(value) ?? '';
  return encoder ? encoder.encode(text).byteLength : text.length;
}
