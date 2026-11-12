/**
 * The three kinds of record the site keeps in IndexedDB: rehearsal
 * recordings, the original resume file, and the structured resume document.
 *
 * Reads never write. Writes happen only through the explicit save, update,
 * and delete functions below, and each resolves to a `LocalDbResult` so the
 * interface can say what went wrong.
 */

import { generateId } from '../glowup-store';
import {
  DB_STORES,
  failure,
  type LocalDbResult,
  readSoft,
  requestResult,
  SINGLE_RECORD_KEY,
  writeSoft,
} from './db';

// ============================================================================
// Recordings
// ============================================================================

/** The tool a recording was made in. */
export type RecordingTool = 'networking-practice' | 'interview-glow-up' | 'application-desk';

const RECORDING_TOOLS: readonly RecordingTool[] = [
  'networking-practice',
  'interview-glow-up',
  'application-desk',
];

/** Everything about a recording except its audio. Cheap to list. */
export interface RecordingMeta {
  id: string;
  tool: RecordingTool;
  /** The tracked application this take belongs to, when there is one. */
  applicationId: string | null;
  /** The question or prompt that was answered. */
  question: string;
  /** Epoch milliseconds. */
  createdAt: number;
  durationMs: number;
  mimeType: string;
  /** On-device transcript, corrected by the student when they choose to. Empty when none. */
  transcript: string;
  /** Audio size in bytes. */
  size: number;
}

export interface Recording extends RecordingMeta {
  audio: Blob;
}

export interface NewRecording {
  tool: RecordingTool;
  applicationId?: string | null;
  question: string;
  durationMs: number;
  audio: Blob;
  /** Defaults to the blob's own type. */
  mimeType?: string;
  transcript?: string;
  /** Defaults to now. */
  createdAt?: number;
}

export interface RecordingFilter {
  tool?: RecordingTool;
  applicationId?: string | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Realm-safe check: a structured clone may hand back another realm's ArrayBuffer. */
const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === '[object ArrayBuffer]';

/** Tolerate records written by an older build or edited by hand. */
function normalizeMeta(value: unknown): RecordingMeta | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<RecordingMeta>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    tool: RECORDING_TOOLS.includes(raw.tool as RecordingTool)
      ? (raw.tool as RecordingTool)
      : 'interview-glow-up',
    applicationId: typeof raw.applicationId === 'string' ? raw.applicationId : null,
    question: typeof raw.question === 'string' ? raw.question : '',
    createdAt: isFiniteNumber(raw.createdAt) ? raw.createdAt : 0,
    durationMs: isFiniteNumber(raw.durationMs) && raw.durationMs >= 0 ? raw.durationMs : 0,
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : '',
    transcript: typeof raw.transcript === 'string' ? raw.transcript : '',
    size: isFiniteNumber(raw.size) && raw.size >= 0 ? raw.size : 0,
  };
}

async function toArrayBuffer(data: Blob | ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
  if (isArrayBuffer(data)) return data.slice(0);
  if (ArrayBuffer.isView(data)) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return copy.buffer;
  }
  if (typeof data.arrayBuffer === 'function') return data.arrayBuffer();
  // Older Blob implementations without arrayBuffer().
  return new Response(data).arrayBuffer();
}

/**
 * Keep a take. Audio is stored as bytes, not as a Blob, because some
 * browsers have refused Blobs in IndexedDB; it comes back as a Blob.
 */
export async function saveRecording(input: NewRecording): Promise<LocalDbResult<RecordingMeta>> {
  let bytes: ArrayBuffer;
  try {
    bytes = await toArrayBuffer(input.audio);
  } catch {
    return failure('invalid');
  }
  const meta: RecordingMeta = {
    id: generateId(),
    tool: input.tool,
    applicationId: input.applicationId ?? null,
    question: input.question,
    createdAt: input.createdAt ?? Date.now(),
    durationMs: Math.max(0, input.durationMs),
    mimeType: input.mimeType ?? input.audio.type ?? '',
    transcript: input.transcript ?? '',
    size: bytes.byteLength,
  };
  return writeSoft([DB_STORES.recordings, DB_STORES.recordingAudio], (tx) => {
    tx.objectStore(DB_STORES.recordings).put(meta);
    tx.objectStore(DB_STORES.recordingAudio).put(bytes, meta.id);
    return meta;
  });
}

/** One recording with its audio, or null when it is missing or unreadable. */
export async function getRecording(id: string): Promise<Recording | null> {
  return readSoft(
    [DB_STORES.recordings, DB_STORES.recordingAudio],
    async (tx) => {
      const [metaRaw, bytes] = await Promise.all([
        requestResult(tx.objectStore(DB_STORES.recordings).get(id)),
        requestResult(tx.objectStore(DB_STORES.recordingAudio).get(id)),
      ]);
      const meta = normalizeMeta(metaRaw);
      if (!meta || !isArrayBuffer(bytes)) return null;
      return { ...meta, audio: new Blob([bytes], { type: meta.mimeType }) };
    },
    null
  );
}

/** Recording metadata, newest first, without loading any audio. */
export async function listRecordings(filter: RecordingFilter = {}): Promise<RecordingMeta[]> {
  const all = await readSoft(
    DB_STORES.recordings,
    (tx) => requestResult(tx.objectStore(DB_STORES.recordings).getAll()),
    [] as unknown[]
  );
  return all
    .map(normalizeMeta)
    .filter((meta): meta is RecordingMeta => meta !== null)
    .filter((meta) => !filter.tool || meta.tool === filter.tool)
    .filter(
      (meta) => filter.applicationId === undefined || meta.applicationId === filter.applicationId
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function countRecordings(): Promise<number> {
  return readSoft(
    DB_STORES.recordings,
    (tx) => requestResult(tx.objectStore(DB_STORES.recordings).count()),
    0
  );
}

/** Correct a transcript or relabel the question. Fails with `invalid` when the take is gone. */
export async function updateRecording(
  id: string,
  changes: Partial<Pick<RecordingMeta, 'transcript' | 'question'>>
): Promise<LocalDbResult<RecordingMeta>> {
  const result = await writeSoft(DB_STORES.recordings, async (tx) => {
    const store = tx.objectStore(DB_STORES.recordings);
    const current = normalizeMeta(await requestResult(store.get(id)));
    if (!current) return null;
    const next: RecordingMeta = {
      ...current,
      ...(typeof changes.transcript === 'string' ? { transcript: changes.transcript } : {}),
      ...(typeof changes.question === 'string' ? { question: changes.question } : {}),
    };
    store.put(next);
    return next;
  });
  if (result.ok && result.value === null) return failure('invalid');
  return result as LocalDbResult<RecordingMeta>;
}

export async function deleteRecording(id: string): Promise<LocalDbResult> {
  return writeSoft([DB_STORES.recordings, DB_STORES.recordingAudio], (tx) => {
    tx.objectStore(DB_STORES.recordings).delete(id);
    tx.objectStore(DB_STORES.recordingAudio).delete(id);
    return undefined;
  });
}

/** Delete every recording. Resolves with how many were removed. */
export async function deleteAllRecordings(): Promise<LocalDbResult<number>> {
  return writeSoft([DB_STORES.recordings, DB_STORES.recordingAudio], async (tx) => {
    const meta = tx.objectStore(DB_STORES.recordings);
    const count = await requestResult(meta.count());
    meta.clear();
    tx.objectStore(DB_STORES.recordingAudio).clear();
    return count;
  });
}

// ============================================================================
// The original resume file
// ============================================================================

export interface ResumeFileRecord {
  name: string;
  /** MIME type as the browser reported it. */
  type: string;
  /** Size in bytes. */
  size: number;
  bytes: ArrayBuffer;
  /** Epoch milliseconds. */
  savedAt: number;
}

export interface ResumeFileInput {
  name: string;
  type: string;
  bytes: Blob | ArrayBuffer | ArrayBufferView;
}

/** Keep the uploaded file so the machine view can show it beside what was read. */
export async function saveResumeFile(
  input: ResumeFileInput | File
): Promise<LocalDbResult<Omit<ResumeFileRecord, 'bytes'>>> {
  let bytes: ArrayBuffer;
  try {
    // Not `'bytes' in input`: Blob.prototype.bytes() exists in current browsers.
    bytes = await toArrayBuffer(
      typeof Blob !== 'undefined' && input instanceof Blob
        ? input
        : (input as ResumeFileInput).bytes
    );
  } catch {
    return failure('invalid');
  }
  const record: ResumeFileRecord = {
    name: input.name,
    type: input.type,
    size: bytes.byteLength,
    bytes,
    savedAt: Date.now(),
  };
  return writeSoft(DB_STORES.resumeFile, (tx) => {
    tx.objectStore(DB_STORES.resumeFile).put(record, SINGLE_RECORD_KEY);
    return { name: record.name, type: record.type, size: record.size, savedAt: record.savedAt };
  });
}

function normalizeResumeFile(value: unknown): ResumeFileRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ResumeFileRecord>;
  if (!isArrayBuffer(raw.bytes)) return null;
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    type: typeof raw.type === 'string' ? raw.type : '',
    size: raw.bytes.byteLength,
    bytes: raw.bytes,
    savedAt: isFiniteNumber(raw.savedAt) ? raw.savedAt : 0,
  };
}

export async function getResumeFile(): Promise<ResumeFileRecord | null> {
  const raw = await readSoft(
    DB_STORES.resumeFile,
    (tx) => requestResult(tx.objectStore(DB_STORES.resumeFile).get(SINGLE_RECORD_KEY)),
    null as unknown
  );
  return normalizeResumeFile(raw);
}

export async function deleteResumeFile(): Promise<LocalDbResult> {
  return writeSoft(DB_STORES.resumeFile, (tx) => {
    tx.objectStore(DB_STORES.resumeFile).delete(SINGLE_RECORD_KEY);
    return undefined;
  });
}

// ============================================================================
// The structured resume document
// ============================================================================

/**
 * The stored wrapper. The document's own shape belongs to the resume
 * document engine; this layer only promises it round-trips as JSON.
 */
export interface ResumeDocRecord<T> {
  doc: T;
  /** Epoch milliseconds. */
  savedAt: number;
}

/**
 * Save the structured resume. The value is copied through JSON first, so
 * what is stored is exactly what a backup file will carry; a value that
 * cannot be written as JSON fails with `invalid` and nothing is saved.
 */
export async function saveResumeDoc<T>(doc: T): Promise<LocalDbResult<ResumeDocRecord<T>>> {
  let copy: T;
  try {
    const text = JSON.stringify(doc);
    if (text === undefined) return failure('invalid');
    copy = JSON.parse(text) as T;
  } catch {
    return failure('invalid');
  }
  const record: ResumeDocRecord<T> = { doc: copy, savedAt: Date.now() };
  return writeSoft(DB_STORES.resumeDocument, (tx) => {
    tx.objectStore(DB_STORES.resumeDocument).put(record, SINGLE_RECORD_KEY);
    return record;
  });
}

/**
 * The stored document, or null. The caller owns validation of `T`; this
 * layer cannot know the shape and does not pretend to.
 */
export async function getResumeDoc<T = unknown>(): Promise<ResumeDocRecord<T> | null> {
  const raw = await readSoft(
    DB_STORES.resumeDocument,
    (tx) => requestResult(tx.objectStore(DB_STORES.resumeDocument).get(SINGLE_RECORD_KEY)),
    null as unknown
  );
  if (!raw || typeof raw !== 'object' || !('doc' in raw)) return null;
  const record = raw as Partial<ResumeDocRecord<T>>;
  if (record.doc === undefined || record.doc === null) return null;
  return { doc: record.doc, savedAt: isFiniteNumber(record.savedAt) ? record.savedAt : 0 };
}

export async function deleteResumeDoc(): Promise<LocalDbResult> {
  return writeSoft(DB_STORES.resumeDocument, (tx) => {
    tx.objectStore(DB_STORES.resumeDocument).delete(SINGLE_RECORD_KEY);
    return undefined;
  });
}
