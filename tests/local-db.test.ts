import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDb,
  countRecordings,
  deleteAllRecordings,
  deleteModels,
  deleteRecording,
  deleteResumeDoc,
  deleteResumeFile,
  getRecording,
  getResumeDoc,
  getResumeFile,
  hasDownloadedModels,
  isLocalDbAvailable,
  listRecordings,
  MODEL_CACHE_PREFIX,
  saveRecording,
  saveResumeDoc,
  saveResumeFile,
  storageReport,
  updateRecording,
} from '../src/lib/local-db';

const audio = (bytes: number[], type = 'audio/webm') => new Blob([new Uint8Array(bytes)], { type });

/** A minimal in-memory Cache API, enough for the report and the delete. */
function installFakeCaches(contents: Record<string, Record<string, string>>) {
  const store = new Map(
    Object.entries(contents).map(([name, entries]) => [name, new Map(Object.entries(entries))])
  );
  const cacheFor = (name: string) => {
    const entries = store.get(name) ?? new Map<string, string>();
    store.set(name, entries);
    return {
      keys: async () => [...entries.keys()].map((url) => new Request(`https://local.test${url}`)),
      match: async (request: Request) => {
        const body = entries.get(new URL(request.url).pathname);
        return body === undefined ? undefined : new Response(body);
      },
    };
  };
  const fake = {
    keys: async () => [...store.keys()],
    open: async (name: string) => cacheFor(name),
    delete: async (name: string) => store.delete(name),
  };
  vi.stubGlobal('caches', fake);
  return store;
}

beforeEach(async () => {
  await closeLocalDb();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
});

afterEach(async () => {
  await closeLocalDb();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recordings', () => {
  it('saves a take with its metadata and returns the audio as a Blob', async () => {
    const saved = await saveRecording({
      tool: 'interview-glow-up',
      applicationId: 'app-1',
      question: 'Tell me about a time you led a group.',
      durationMs: 61_500,
      audio: audio([1, 2, 3, 4]),
      transcript: 'I led the food bank drive.',
      createdAt: 1000,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value).toMatchObject({ size: 4, mimeType: 'audio/webm', applicationId: 'app-1' });

    const loaded = await getRecording(saved.value.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.question).toBe('Tell me about a time you led a group.');
    expect(loaded?.durationMs).toBe(61_500);
    expect(loaded?.audio.type).toBe('audio/webm');
    expect([...new Uint8Array(await (loaded as { audio: Blob }).audio.arrayBuffer())]).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('lists newest first without audio, filtered by tool or application', async () => {
    await saveRecording({
      tool: 'networking-practice',
      question: 'Intro',
      durationMs: 30_000,
      audio: audio([1]),
      createdAt: 1,
    });
    await saveRecording({
      tool: 'interview-glow-up',
      applicationId: 'app-1',
      question: 'Q1',
      durationMs: 1,
      audio: audio([1, 2]),
      createdAt: 3,
    });
    await saveRecording({
      tool: 'interview-glow-up',
      applicationId: 'app-2',
      question: 'Q2',
      durationMs: 1,
      audio: audio([1, 2, 3]),
      createdAt: 2,
    });

    const all = await listRecordings();
    expect(all.map((r) => r.question)).toEqual(['Q1', 'Q2', 'Intro']);
    expect(all.every((r) => !('audio' in r))).toBe(true);
    expect((await listRecordings({ tool: 'networking-practice' })).map((r) => r.question)).toEqual([
      'Intro',
    ]);
    expect((await listRecordings({ applicationId: 'app-2' })).map((r) => r.question)).toEqual([
      'Q2',
    ]);
    expect((await listRecordings({ applicationId: null })).map((r) => r.question)).toEqual([
      'Intro',
    ]);
    expect(await countRecordings()).toBe(3);
  });

  it('corrects a transcript and deletes one take or all of them', async () => {
    const first = await saveRecording({
      tool: 'interview-glow-up',
      question: 'Q',
      durationMs: 1,
      audio: audio([1]),
    });
    await saveRecording({
      tool: 'interview-glow-up',
      question: 'R',
      durationMs: 1,
      audio: audio([2]),
    });
    if (!first.ok) throw new Error('save failed');

    const updated = await updateRecording(first.value.id, { transcript: 'Corrected words' });
    expect(updated.ok && updated.value.transcript).toBe('Corrected words');
    expect((await getRecording(first.value.id))?.transcript).toBe('Corrected words');
    expect(await updateRecording('missing', { transcript: 'x' })).toMatchObject({
      ok: false,
      reason: 'invalid',
    });

    expect(await deleteRecording(first.value.id)).toEqual({ ok: true, value: undefined });
    expect(await getRecording(first.value.id)).toBeNull();
    expect(await countRecordings()).toBe(1);

    expect(await deleteAllRecordings()).toEqual({ ok: true, value: 1 });
    expect(await listRecordings()).toEqual([]);
  });
});

describe('the resume file and the structured resume', () => {
  it('keeps one original file, replacing it on save', async () => {
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'resume.pdf', {
      type: 'application/pdf',
    });
    const saved = await saveResumeFile(file);
    expect(saved).toMatchObject({ ok: true, value: { name: 'resume.pdf', size: 4 } });

    await saveResumeFile({
      name: 'resume.docx',
      type: 'application/x-test',
      bytes: new Uint8Array([9, 9]),
    });
    const loaded = await getResumeFile();
    expect(loaded?.name).toBe('resume.docx');
    expect(loaded?.size).toBe(2);
    expect([...new Uint8Array(loaded?.bytes ?? new ArrayBuffer(0))]).toEqual([9, 9]);

    await deleteResumeFile();
    expect(await getResumeFile()).toBeNull();
  });

  it('stores the structured resume as JSON and rejects what JSON cannot carry', async () => {
    type Doc = { sections: { heading: string; lines: string[] }[] };
    const doc: Doc = { sections: [{ heading: 'Experience', lines: ['Led a fundraiser.'] }] };
    const saved = await saveResumeDoc(doc);
    expect(saved.ok).toBe(true);
    expect((await getResumeDoc<Doc>())?.doc).toEqual(doc);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(await saveResumeDoc(circular)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await saveResumeDoc(undefined)).toMatchObject({ ok: false, reason: 'invalid' });
    expect((await getResumeDoc<Doc>())?.doc).toEqual(doc);

    await deleteResumeDoc();
    expect(await getResumeDoc()).toBeNull();
  });
});

describe('when IndexedDB is unavailable', () => {
  beforeEach(async () => {
    await closeLocalDb();
    vi.stubGlobal('indexedDB', undefined);
  });

  it('reads return empty and writes return a failure the interface can show', async () => {
    expect(await isLocalDbAvailable()).toBe(false);
    expect(await listRecordings()).toEqual([]);
    expect(await getRecording('x')).toBeNull();
    expect(await getResumeFile()).toBeNull();
    expect(await getResumeDoc()).toBeNull();
    expect(await countRecordings()).toBe(0);

    const result = await saveRecording({
      tool: 'networking-practice',
      question: 'Q',
      durationMs: 1,
      audio: audio([1]),
    });
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    if (!result.ok) {
      expect(result.message).toMatch(/private windows/i);
      expect(result.message).not.toMatch(/[!—]/);
    }
    expect(await saveResumeDoc({ a: 1 })).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await deleteAllRecordings()).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('fails soft when opening the database throws', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    expect(await isLocalDbAvailable()).toBe(false);
    expect(await listRecordings()).toEqual([]);
    expect(await saveResumeDoc({ a: 1 })).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});

describe('storage report and model deletion', () => {
  it('measures localStorage, each IndexedDB store, and the model caches', async () => {
    localStorage.setItem('career-why-history', '[]');
    localStorage.setItem('career-tools-theme', 'dawn');
    await saveRecording({
      tool: 'networking-practice',
      question: 'Q',
      durationMs: 1,
      audio: audio([1, 2, 3, 4, 5]),
    });
    await saveResumeFile({ name: 'r.pdf', type: 'application/pdf', bytes: new Uint8Array(10) });
    await saveResumeDoc({ text: 'hello' });
    installFakeCaches({
      [`${MODEL_CACHE_PREFIX}whisper`]: { '/models/a.bin': 'abcd', '/models/b.bin': 'ef' },
      'shell-v1': { '/index.html': 'not a model' },
    });

    const report = await storageReport();
    expect(report.localStorage.available).toBe(true);
    expect(report.localStorage.entries).toEqual([
      { key: 'career-tools-theme', bytes: ('career-tools-theme'.length + 4) * 2, inBackup: false },
      { key: 'career-why-history', bytes: ('career-why-history'.length + 2) * 2, inBackup: true },
    ]);
    expect(report.indexedDb.available).toBe(true);
    expect(report.indexedDb.stores.recordings.count).toBe(1);
    expect(report.indexedDb.stores.recordings.bytes).toBeGreaterThan(5);
    expect(report.indexedDb.stores.resumeFile).toMatchObject({ count: 1 });
    expect(report.indexedDb.stores.resumeFile.bytes).toBeGreaterThanOrEqual(10);
    expect(report.indexedDb.stores.resumeDocument.count).toBe(1);
    expect(report.models).toEqual({
      available: true,
      bytes: 6,
      caches: [{ name: `${MODEL_CACHE_PREFIX}whisper`, entries: 2, bytes: 6 }],
    });
    expect(report.totalBytes).toBe(
      report.localStorage.bytes + report.indexedDb.bytes + report.models.bytes
    );
  });

  it('deletes only model caches', async () => {
    const store = installFakeCaches({
      [`${MODEL_CACHE_PREFIX}kokoro`]: { '/m': 'x' },
      [`${MODEL_CACHE_PREFIX}whisper`]: { '/m': 'y' },
      'shell-v1': { '/': 'z' },
    });
    expect(await hasDownloadedModels()).toBe(true);
    expect(await deleteModels()).toEqual({ ok: true, value: 2 });
    expect([...store.keys()]).toEqual(['shell-v1']);
    expect(await hasDownloadedModels()).toBe(false);
  });

  it('reports empty sections when nothing is available', async () => {
    await closeLocalDb();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('caches', undefined);
    const report = await storageReport();
    expect(report.indexedDb).toMatchObject({ available: false, bytes: 0 });
    expect(report.models).toEqual({ available: false, bytes: 0, caches: [] });
    expect(await deleteModels()).toEqual({ ok: true, value: 0 });
  });
});

describe('reading never creates the database', () => {
  const databaseNames = async () =>
    (await (indexedDB as IDBFactory).databases()).map((info) => info.name);

  it('returns empty reads on a fresh profile and leaves no database behind', async () => {
    expect(await getResumeDoc()).toBeNull();
    expect(await getResumeFile()).toBeNull();
    expect(await listRecordings()).toEqual([]);
    expect(await countRecordings()).toBe(0);
    const report = await storageReport();
    expect(report.indexedDb.bytes).toBe(0);
    expect(await databaseNames()).toEqual([]);
  });

  it('still finds nothing to create when the browser has no databases() list', async () => {
    const factory = new IDBFactory();
    Object.defineProperty(factory, 'databases', { value: undefined });
    vi.stubGlobal('indexedDB', factory);
    expect(await getResumeDoc()).toBeNull();
    expect(await listRecordings()).toEqual([]);
    expect(await new IDBFactory().databases.call(factory)).toEqual([]);
  });

  it('reads what was saved once the database exists', async () => {
    await saveResumeDoc({ name: 'Jordan' });
    await closeLocalDb();
    expect((await getResumeDoc<{ name: string }>())?.doc).toEqual({ name: 'Jordan' });
  });
});
