import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDb,
  getResumeDoc,
  MODEL_CACHE_PREFIX,
  saveRecording,
  saveResumeDoc,
  saveResumeFile,
} from '../src/lib/local-db';
import { fromText } from '../src/lib/resume-doc/model';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupExclusions,
  collectBackup,
  describeExclusions,
  parseBackup,
  RESUME_DOCUMENT_RECORD,
  restoreBackup,
  STUDIO_STORAGE_KEYS,
  type StudioBackup,
  summarizeBackup,
} from '../src/lib/studio-backup';

const fixture = (name: string): string =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'backups', name), 'utf8');

const RESUME = fromText('Experience\n- Led a club fundraiser.');
const DESK = { version: 1, desks: { 'app-1': { checklist: { 'someone-read-it': true } } } };

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

describe('backup version 2', () => {
  it('lists the desk key, which the bridge and the desk share', () => {
    expect(STUDIO_STORAGE_KEYS).toContain('career-application-desk');
    expect(BACKUP_VERSION).toBe(2);
  });

  it('carries the desk and the structured resume, and summarizes them', async () => {
    localStorage.setItem('career-application-desk', JSON.stringify(DESK));
    await saveResumeDoc(RESUME);
    const backup = await collectBackup();
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: 2 });
    expect(backup.stores['career-application-desk']).toEqual(DESK);
    expect(backup.records).toEqual({ [RESUME_DOCUMENT_RECORD]: RESUME });
    expect(summarizeBackup(backup)).toMatchObject({ applicationDesks: 1, hasResumeDocument: true });
  });

  it('never carries the original resume file, recordings, or models', async () => {
    await saveResumeFile({ name: 'resume.pdf', type: 'application/pdf', bytes: new Uint8Array(8) });
    await saveRecording({
      tool: 'interview-glow-up',
      question: 'Q',
      durationMs: 1,
      audio: new Blob([new Uint8Array([1])]),
    });
    const backup = await collectBackup();
    const text = JSON.stringify(backup);
    expect(backup.records).toBeUndefined();
    expect(text).not.toContain('resume.pdf');
    expect(text).not.toContain('interview-glow-up');
  });

  it('names what an export leaves behind', async () => {
    expect(describeExclusions(await backupExclusions())).toBeNull();

    await saveResumeFile({ name: 'resume.pdf', type: 'application/pdf', bytes: new Uint8Array(8) });
    for (const question of ['Q1', 'Q2']) {
      await saveRecording({
        tool: 'interview-glow-up',
        question,
        durationMs: 1,
        audio: new Blob([new Uint8Array([1])]),
      });
    }
    vi.stubGlobal('caches', {
      keys: async () => [`${MODEL_CACHE_PREFIX}whisper`],
      open: async () => ({ keys: async () => [new Request('https://local.test/m')] }),
    });
    const exclusions = await backupExclusions();
    expect(exclusions).toEqual({ recordings: 2, hasResumeFile: true, hasModels: true });
    expect(describeExclusions(exclusions)).toBe(
      'Not included: 2 recordings, the original resume file, downloaded models.'
    );
    expect(describeExclusions({ recordings: 1, hasResumeFile: false, hasModels: false })).toBe(
      'Not included: 1 recording.'
    );
  });

  it('round-trips the desk and the structured resume to another device', async () => {
    localStorage.setItem('career-application-desk', JSON.stringify(DESK));
    await saveResumeDoc(RESUME);
    const text = JSON.stringify(await collectBackup());

    // A fresh device.
    await closeLocalDb();
    vi.stubGlobal('indexedDB', new IDBFactory());
    localStorage.clear();

    const restored = await restoreBackup(parseBackup(text), false);
    expect(restored).toEqual(['career-application-desk', RESUME_DOCUMENT_RECORD]);
    expect(JSON.parse(localStorage.getItem('career-application-desk') ?? 'null')).toEqual(DESK);
    expect((await getResumeDoc())?.doc).toEqual(RESUME);
  });

  it('ignores unknown records and keeps only the resume document', () => {
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 2,
        stores: {},
        records: { [RESUME_DOCUMENT_RECORD]: RESUME, recordings: [{ id: 'x' }] },
      })
    );
    expect(backup.records).toEqual({ [RESUME_DOCUMENT_RECORD]: RESUME });
    expect(
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 2, stores: {}, records: [] }))
        .records
    ).toBeUndefined();
  });

  it('a version 1 file added to a device keeps its structured resume', async () => {
    await saveResumeDoc(RESUME);
    await restoreBackup(parseBackup(fixture('v1-minimal.json')), false);
    expect((await getResumeDoc())?.doc).toEqual(RESUME);
  });

  it('a version 1 file replacing everything also clears the structured resume', async () => {
    await saveResumeDoc(RESUME);
    const restored = await restoreBackup(parseBackup(fixture('v1-full.json')), true);
    expect(restored).not.toContain(RESUME_DOCUMENT_RECORD);
    expect(await getResumeDoc()).toBeNull();
    expect(localStorage.getItem('career-applications')).toContain('County Water Lab');
  });

  it('rolls back saved work when the resume cannot be written', async () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    await saveResumeDoc({ old: true });
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 2,
        stores: {
          'career-why-history': [{ id: 'imported-reflection' }],
          'career-tools-profile': { stage: 'student', focus: 'resume' },
        },
        records: { [RESUME_DOCUMENT_RECORD]: RESUME },
      })
    );
    for (const replace of [false, true]) {
      await expect(restoreBackup(backup, replace)).rejects.toThrow(
        /previous saved work was restored/i
      );
      expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
      expect(localStorage.getItem('career-tools-profile')).toBeNull();
      expect((await getResumeDoc())?.doc).toEqual({ old: true });
    }
  });

  it('changes nothing when the file holds a resume this browser cannot store', async () => {
    await closeLocalDb();
    vi.stubGlobal('indexedDB', undefined);
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 2,
        stores: { 'career-tools-profile': { stage: 'student', focus: 'resume' } },
        records: { [RESUME_DOCUMENT_RECORD]: RESUME },
      })
    );
    await expect(restoreBackup(backup, true)).rejects.toThrow(/saved work was not changed/i);
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
    expect(localStorage.getItem('career-tools-profile')).toBeNull();
  });

  it('imports localStorage work without IndexedDB when the file holds no resume', async () => {
    await closeLocalDb();
    vi.stubGlobal('indexedDB', undefined);
    const backup = await collectBackup();
    expect(backup.records).toBeUndefined();
    const restored = await restoreBackup(parseBackup(fixture('v1-full.json')), true);
    expect(restored).toContain('career-applications');
  });

  it('rejects a resume record JSON cannot carry before changing anything', async () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 2,
          exportedAt: '',
          stores: { 'career-tools-profile': { stage: 'student' } },
          records: { [RESUME_DOCUMENT_RECORD]: () => 'not data' },
        },
        true
      )
    ).rejects.toThrow(/not changed/);
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });
});

it('refuses a malformed resume document before changing either storage system', async () => {
  localStorage.setItem('career-why-history', '[{"id":"saved"}]');
  await saveResumeDoc(RESUME);
  const invalid: StudioBackup = {
    format: BACKUP_FORMAT,
    version: 2,
    exportedAt: '',
    stores: { 'career-why-history': [] },
    records: { [RESUME_DOCUMENT_RECORD]: 'x' },
  };
  const message =
    'That file contains invalid data for "resume-document". Your saved work was not changed.';
  expect(() => parseBackup(JSON.stringify(invalid))).toThrow(new Error(message));
  await expect(restoreBackup(invalid, true)).rejects.toThrow(new Error(message));
  expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved"}]');
  expect((await getResumeDoc())?.doc).toEqual(RESUME);
});
