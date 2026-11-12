/**
 * One export and one import for everything the tools keep in this browser.
 * The privacy model means nothing syncs; this is how a student moves their
 * work from a school laptop to their phone, or keeps a copy before clearing
 * site data.
 *
 * Every key listed here is written by a tool; the source of truth for each is
 * named next to it. Adding a store to a tool means adding its key here.
 *
 * Version 2 adds the structured resume document from IndexedDB, which makes
 * export and import asynchronous. The original resume file, recordings, and
 * downloaded models are never carried: they are large, and a recording is the
 * student's voice. `backupExclusions` reports what was left behind so the
 * export dialog can say so. Files of every earlier version import unchanged.
 */

import { isLocalDbAvailable } from './local-db/db';
import { hasDownloadedModels } from './local-db/models';
import {
  countRecordings,
  deleteResumeDoc,
  getResumeDoc,
  getResumeFile,
  saveResumeDoc,
} from './local-db/records';

export const STUDIO_STORAGE_KEYS = [
  'career-tools-profile', // src/lib/profile.ts
  'career-why-session-v2', // src/components/career-5whys/shared.ts
  'career-why-history', // src/components/career-5whys/shared.ts
  'career-why-history-limit', // src/components/career-5whys/shared.ts
  'resume-game-session-v2', // src/lib/resume-game/session.ts
  'networking-practice-versions', // src/utils/storage.ts
  'networking-practice-sessions', // src/utils/storage.ts
  'networking-practice-draft', // src/components/networking/useNetworkingPractice.ts
  'interview-glow-up-data', // src/lib/glowup-store.ts
  'career-applications', // src/lib/applications.ts
  'career-application-desk', // src/lib/application-desk.ts
] as const;

export type StudioStorageKey = (typeof STUDIO_STORAGE_KEYS)[number];

export const BACKUP_FORMAT = '5whys-career-studio';
/**
 * 1: localStorage stores only.
 * 2: adds `records` with the structured resume document from IndexedDB.
 */
export const BACKUP_VERSION = 2;

/** The IndexedDB record a backup can carry. */
export const RESUME_DOCUMENT_RECORD = 'resume-document';

/** Everything an import can write: a localStorage key or the resume document. */
export type RestoredStore = StudioStorageKey | typeof RESUME_DOCUMENT_RECORD;

export interface StudioBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Raw stored JSON per key, exactly as the tool wrote it. */
  stores: Partial<Record<StudioStorageKey, unknown>>;
  /** IndexedDB records, version 2 and later. Absent in older files. */
  records?: { [RESUME_DOCUMENT_RECORD]?: unknown };
}

export interface BackupSummary {
  reflections: number;
  resumeBullets: number;
  practiceRounds: number;
  stories: number;
  applications: number;
  /** Applications with any desk work saved. */
  applicationDesks: number;
  hasProfile: boolean;
  hasResumeDocument: boolean;
}

/** What an export leaves on this device, for the export dialog. */
export interface BackupExclusions {
  recordings: number;
  hasResumeFile: boolean;
  hasModels: boolean;
}

const isKey = (value: string): value is StudioStorageKey =>
  (STUDIO_STORAGE_KEYS as readonly string[]).includes(value);

export async function collectBackup(): Promise<StudioBackup> {
  const stores: StudioBackup['stores'] = {};
  if (typeof window !== 'undefined') {
    for (const key of STUDIO_STORAGE_KEYS) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) stores[key] = JSON.parse(raw);
      } catch {
        /* an unreadable store is skipped rather than failing the whole export */
      }
    }
  }
  const backup: StudioBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
  // An unavailable or unreadable database leaves the record out, as an
  // unreadable localStorage store is left out above.
  const resumeDoc = await getResumeDoc();
  if (resumeDoc) backup.records = { [RESUME_DOCUMENT_RECORD]: resumeDoc.doc };
  return backup;
}

/** Count what an export will not carry. Reads only. */
export async function backupExclusions(): Promise<BackupExclusions> {
  const [recordings, resumeFile, hasModels] = await Promise.all([
    countRecordings(),
    getResumeFile(),
    hasDownloadedModels(),
  ]);
  return { recordings, hasResumeFile: resumeFile !== null, hasModels };
}

/**
 * One sentence naming what stays behind, or null when nothing does:
 * "Not included: 2 recordings, the original resume file, downloaded models."
 */
export function describeExclusions(exclusions: BackupExclusions): string | null {
  const parts: string[] = [];
  if (exclusions.recordings > 0) {
    parts.push(
      `${exclusions.recordings} ${exclusions.recordings === 1 ? 'recording' : 'recordings'}`
    );
  }
  if (exclusions.hasResumeFile) parts.push('the original resume file');
  if (exclusions.hasModels) parts.push('downloaded models');
  return parts.length ? `Not included: ${parts.join(', ')}.` : null;
}

export function summarizeBackup(backup: StudioBackup): BackupSummary {
  const s = backup.stores;
  const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const glow = s['interview-glow-up-data'] as { stories?: unknown[] } | undefined;
  const resume = s['resume-game-session-v2'] as { bullets?: unknown[] } | undefined;
  const apps = s['career-applications'] as { applications?: unknown[] } | undefined;
  const desks = s['career-application-desk'] as { desks?: unknown } | undefined;
  const deskCount =
    desks?.desks && typeof desks.desks === 'object' && !Array.isArray(desks.desks)
      ? Object.keys(desks.desks).length
      : 0;
  const resumeDocument = backup.records?.[RESUME_DOCUMENT_RECORD];
  return {
    reflections: count(s['career-why-history']),
    resumeBullets: count(resume?.bullets),
    practiceRounds: count(s['networking-practice-sessions']),
    stories: count(glow?.stories),
    applications: count(apps?.applications),
    applicationDesks: deskCount,
    hasProfile: !!s['career-tools-profile'],
    hasResumeDocument: resumeDocument !== undefined && resumeDocument !== null,
  };
}

export async function downloadBackup(): Promise<StudioBackup> {
  const backup = await collectBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `5whys-career-studio-${backup.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return backup;
}

/** Parse and validate a file the user picked. Throws a readable message. */
export function parseBackup(text: string): StudioBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON. Pick the file this page exported.');
  }
  if (!data || typeof data !== 'object') throw new Error('That file has no studio data in it.');
  const candidate = data as Partial<StudioBackup>;
  if (
    candidate.format !== BACKUP_FORMAT ||
    !candidate.stores ||
    typeof candidate.stores !== 'object' ||
    Array.isArray(candidate.stores)
  ) {
    throw new Error('That file was not exported by 5 Whys Career Studio.');
  }
  if (typeof candidate.version === 'number' && candidate.version > BACKUP_VERSION) {
    throw new Error('That file came from a newer version of the studio. Update this page first.');
  }
  const stores: StudioBackup['stores'] = {};
  for (const [key, value] of Object.entries(candidate.stores)) {
    if (isKey(key) && value !== undefined && value !== null) stores[key] = value;
  }
  const parsed: StudioBackup = {
    format: BACKUP_FORMAT,
    version: candidate.version ?? BACKUP_VERSION,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    stores,
  };
  // Only the known record is kept; anything else in `records` is ignored.
  const records = candidate.records;
  if (records && typeof records === 'object' && !Array.isArray(records)) {
    const doc = (records as Record<string, unknown>)[RESUME_DOCUMENT_RECORD];
    if (doc !== undefined && doc !== null) parsed.records = { [RESUME_DOCUMENT_RECORD]: doc };
  }
  return parsed;
}

const RESTORED_MESSAGE =
  'Could not save that file in this browser. Your previous saved work was restored. Try again or use another browser.';
const UNRECOVERED_MESSAGE =
  'Could not finish importing that file or restore all previous saved work. Some saved work may have changed. Keep your backup file and export what is here before trying again.';

/**
 * Put back every localStorage key the import changed. Returns false when any
 * key could not be restored, or held a newer value from another tab.
 */
function rollbackLocal(
  storage: Storage,
  changed: StudioStorageKey[],
  originals: Map<StudioStorageKey, string | null>,
  staged: Map<StudioStorageKey, string>
): boolean {
  let recovered = true;
  // Free new stores and shrink overwritten values before restoring lost space.
  const rollbackKeys = [
    ...changed.filter((key) => originals.get(key) === null),
    ...changed
      .filter((key) => originals.get(key) !== null)
      .sort(
        (a, b) =>
          (originals.get(a)?.length ?? 0) -
          (staged.get(a)?.length ?? 0) -
          ((originals.get(b)?.length ?? 0) - (staged.get(b)?.length ?? 0))
      ),
  ];
  for (const key of rollbackKeys) {
    try {
      // Avoid replacing a newer value observed from another tab. This check
      // cannot make the following write atomic with that tab's writes.
      if (storage.getItem(key) !== (staged.get(key) ?? null)) {
        recovered = false;
        continue;
      }
      const original = originals.get(key);
      if (original === null) storage.removeItem(key);
      else if (original !== undefined) storage.setItem(key, original);
    } catch {
      recovered = false;
    }
  }
  return recovered;
}

/**
 * Stage the imported values and originals before changing saved work. Replace
 * removes omitted studio keys only after every imported store has saved.
 * The resume document is written last, in one IndexedDB transaction; if that
 * fails, the localStorage changes are rolled back. Recovery is best effort:
 * localStorage has no transaction across keys or tabs.
 */
export async function restoreBackup(
  backup: StudioBackup,
  replace: boolean
): Promise<RestoredStore[]> {
  if (typeof window === 'undefined') return [];
  if (!backup.stores || typeof backup.stores !== 'object' || Array.isArray(backup.stores)) {
    throw new Error('That file was not exported by 5 Whys Career Studio.');
  }
  const staged = new Map<StudioStorageKey, string>();
  let stagedDoc: { value: unknown; json: string } | null = null;
  try {
    for (const key of STUDIO_STORAGE_KEYS) {
      const value = backup.stores[key];
      if (value === undefined || value === null) continue;
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('Unserializable store');
      staged.set(key, serialized);
    }
    const doc = backup.records?.[RESUME_DOCUMENT_RECORD];
    if (doc !== undefined && doc !== null) {
      const json = JSON.stringify(doc);
      if (json === undefined) throw new Error('Unserializable record');
      stagedDoc = { value: JSON.parse(json), json };
    }
  } catch (cause) {
    throw new Error(
      'That file contains data this browser could not save. Your saved work was not changed.',
      { cause }
    );
  }
  // An empty export is not an instruction to erase the studio.
  if (staged.size === 0 && !stagedDoc) return [];

  // Settle what the database needs before any write, so the localStorage
  // section below stays synchronous and nothing changes if the database
  // cannot take the resume.
  let dbChange: 'save' | 'delete' | null = null;
  if (stagedDoc || replace) {
    const dbAvailable = await isLocalDbAvailable();
    if (stagedDoc && !dbAvailable) {
      throw new Error(
        'This browser cannot save the resume in that file, so nothing was imported. Your saved work was not changed. Try a regular window or another browser.'
      );
    }
    if (dbAvailable) {
      const current = await getResumeDoc();
      if (stagedDoc) {
        dbChange = current && JSON.stringify(current.doc) === stagedDoc.json ? null : 'save';
      } else if (current) {
        dbChange = 'delete';
      }
    }
  }

  let storage: Storage;
  const originals = new Map<StudioStorageKey, string | null>();
  try {
    storage = window.localStorage;
    for (const key of replace ? STUDIO_STORAGE_KEYS : staged.keys()) {
      originals.set(key, storage.getItem(key));
    }
  } catch (cause) {
    throw new Error(
      'Could not save that file in this browser. Your saved work was not changed. Try again or use another browser.',
      { cause }
    );
  }

  const changed: StudioStorageKey[] = [];
  try {
    for (const [key, value] of staged) {
      if (originals.get(key) === value) continue;
      storage.setItem(key, value);
      changed.push(key);
    }
    if (replace) {
      for (const [key, original] of originals) {
        if (staged.has(key) || original === null) continue;
        storage.removeItem(key);
        changed.push(key);
      }
    }
  } catch (cause) {
    const recovered = rollbackLocal(storage, changed, originals, staged);
    throw new Error(recovered ? RESTORED_MESSAGE : UNRECOVERED_MESSAGE, { cause });
  }

  if (dbChange) {
    const result =
      dbChange === 'save' && stagedDoc
        ? await saveResumeDoc(stagedDoc.value)
        : await deleteResumeDoc();
    if (!result.ok) {
      const recovered = rollbackLocal(storage, changed, originals, staged);
      throw new Error(recovered ? RESTORED_MESSAGE : UNRECOVERED_MESSAGE, { cause: result });
    }
  }

  const restored: RestoredStore[] = [...staged.keys()];
  if (stagedDoc) restored.push(RESUME_DOCUMENT_RECORD);
  return restored;
}
