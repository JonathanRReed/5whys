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

import { localDate } from './applications';
import { isLocalDbAvailable } from './local-db/db';
import { hasDownloadedModels } from './local-db/models';
import {
  countRecordings,
  deleteResumeDoc,
  getResumeDoc,
  getResumeFile,
  saveResumeDoc,
} from './local-db/records';
import { isFocus, isStage } from './profile';

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
  anchor.download = `5whys-career-studio-${localDate(new Date(backup.exportedAt))}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return backup;
}

/** LocalStorage commonly has a 5 MiB quota. Reject oversized text before parsing. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const BACKUP_SIZE_MESSAGE =
  'That file is larger than the 5 MiB backup limit for browser storage. Your saved work was not changed.';

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown) => typeof value === 'string';
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown) => typeof value === 'boolean';
const nullableText = (value: unknown) => value === null || isText(value);
const textArray = (value: unknown) => Array.isArray(value) && value.every(isText);
const objectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isObject);

/** Missing fields that older loaders supply are allowed. Present fields must have their shape. */
function fields(
  value: Record<string, unknown>,
  checks: Record<string, (value: unknown) => boolean>
): boolean {
  return Object.entries(checks).every(
    ([key, check]) => value[key] === undefined || check(value[key])
  );
}
const namedRecords = (value: unknown): value is Record<string, unknown>[] =>
  objectArray(value) &&
  value.every((entry: Record<string, unknown>) =>
    fields(entry, { id: isText, updatedAt: (v) => isText(v) || isNumber(v) })
  );
const reflection = (value: unknown) =>
  isObject(value) &&
  fields(value, {
    id: isText,
    topic: isText,
    track: (v) => v === 'career' || v === 'interest',
    responses: textArray,
    timestamp: isText,
    updatedAt: isText,
    version: isNumber,
    whyStatement: isText,
    rootReason: isText,
    nextStep: isText,
  });
/** Each entry is an object whose present fields pass `checks`. */
const each =
  (checks: Record<string, (value: unknown) => boolean>) =>
  (value: unknown): boolean =>
    objectArray(value) && value.every((entry) => fields(entry, checks));
const object =
  (checks: Record<string, (value: unknown) => boolean>) =>
  (value: unknown): boolean =>
    isObject(value) && fields(value, checks);
const nullable =
  (check: (value: unknown) => boolean) =>
  (value: unknown): boolean =>
    value === null || check(value);
/** An amount on the offer worksheet; its loader also reads a numeric string. */
const amountLike = (value: unknown) => value === null || isNumber(value) || isText(value);
const ratings = (value: unknown) => isObject(value) && Object.values(value).every(isNumber);
const notes = (value: unknown) => isObject(value) && Object.values(value).every(isText);

/** Small checks for the shapes each tool's loader accepts, without rewriting old saves. */
const STORE_CHECKS: Record<StudioStorageKey, (value: unknown) => boolean> = {
  'career-tools-profile': (v) =>
    isObject(v) &&
    isStage(v.stage) &&
    isFocus(v.focus) &&
    fields(v, { updatedAt: isText, firstJob: isBoolean }),
  'career-why-session-v2': (v) => reflection(v) && isObject(v) && isText(v.topic),
  'career-why-history': (v) => Array.isArray(v) && v.every(reflection),
  'career-why-history-limit': (v) => isNumber(v) && [6, 12, 24].includes(Number(v)),
  'resume-game-session-v2': (v) =>
    isObject(v) &&
    namedRecords(v.bullets) &&
    fields(v, {
      resumeText: isText,
      needsRescan: isBoolean,
      selectedBulletId: nullableText,
      lastAnalyzedAt: nullableText,
      signalReport: object({ hardSkills: textArray }),
    }) &&
    v.bullets.every((b: Record<string, unknown>) =>
      fields(b, {
        original: isText,
        improved: isText,
        fields: notes,
        baselineScore: isNumber,
        improvedScore: isNumber,
        edited: isBoolean,
      })
    ),
  'networking-practice-versions': (v) =>
    namedRecords(v) &&
    Array.isArray(v) &&
    v.every((entry) =>
      fields(entry, {
        title: isText,
        scenarioId: isText,
        who: isText,
        where: isText,
        what: isText,
        notes: isText,
      })
    ),
  'networking-practice-sessions': (v) =>
    namedRecords(v) &&
    Array.isArray(v) &&
    v.every((entry) =>
      fields(entry, {
        versionId: isText,
        scenarioId: isText,
        scenarioTitle: isText,
        createdAt: isText,
        what: isText,
        durationSeconds: isNumber,
        attempts: (a) =>
          namedRecords(a) &&
          Array.isArray(a) &&
          a.every((item) =>
            fields(item, {
              script: isText,
              label: isText,
              durationSeconds: isNumber,
              createdAt: isText,
            })
          ),
        ratings,
        reflection: notes,
        questionDraft: isText,
        affirmation: isText,
      })
    ),
  'networking-practice-draft': (v) =>
    isObject(v) &&
    isText(v.text) &&
    fields(v, {
      ratings,
      reflection: notes,
      ratingsTouched: isBoolean,
      ratingFormat: isNumber,
      versionId: nullableText,
      updatedAt: isText,
    }),
  'interview-glow-up-data': (v) =>
    isObject(v) &&
    namedRecords(v.roles) &&
    namedRecords(v.stories) &&
    namedRecords(v.packets) &&
    fields(v, { version: isNumber, currentRoleId: nullableText, currentPacketId: nullableText }) &&
    v.roles.every((role: Record<string, unknown>) =>
      fields(role, {
        jobTitle: isText,
        company: isText,
        rawJdText: isText,
        parsedJdText: isText,
        createdAt: isNumber,
        bullets: (b) =>
          namedRecords(b) &&
          each({
            text: isText,
            status: isText,
            primarySkillId: nullableText,
            secondarySkillIds: textArray,
            suggestion: each({ skillId: isText, matchedKeywords: textArray }),
            section: isText,
            sourceSpan: nullable(object({ start: isNumber, end: isNumber })),
            confirmed: isBoolean,
            origin: isText,
          })(b),
      })
    ) &&
    v.stories.every((story: Record<string, unknown>) =>
      fields(story, {
        primarySkillId: isText,
        trigger: isText,
        hook: isText,
        proofSnippet: isText,
        play: isText,
        proof: isText,
        confidence: isNumber,
        otherSkillIds: textArray,
        questionPrompts: textArray,
        tags: textArray,
      })
    ) &&
    // The dashboard and the interview tools walk each packet's lists.
    v.packets.every((packet: Record<string, unknown>) =>
      fields(packet, {
        roleId: isText,
        mode: isText,
        topStoryIds: textArray,
        customQuestions: textArray,
        notes: isText,
        panicAnswer: isText,
        aiQuestions: isText,
        companyIntel: object({ keywords: textArray, notes: isText, links: textArray }),
      })
    ),
  'career-applications': (v) =>
    isObject(v) &&
    namedRecords(v.applications) &&
    fields(v, { version: isNumber, activeId: nullableText }) &&
    v.applications.every(
      (app: Record<string, unknown>) =>
        fields(app, {
          title: isText,
          company: isText,
          deadline: nullableText,
          roleId: nullableText,
          sentOn: nullableText,
          createdAt: isNumber,
          updatedAt: isNumber,
        }) &&
        (isText(app.title) || isText(app.company))
    ),
  'career-application-desk': (v) =>
    isObject(v) &&
    isObject(v.desks) &&
    fields(v, { version: isNumber }) &&
    Object.values(v.desks).every(
      (desk) =>
        isObject(desk) &&
        fields(desk, {
          qualifications: (q) =>
            namedRecords(q) &&
            each({ requirementId: isText, status: isText, plan: isText, updatedAt: isNumber })(q),
          actionPlan: (a) =>
            namedRecords(a) &&
            each({ text: isText, due: nullableText, done: isBoolean, createdAt: isNumber })(a),
          bullets: object({
            experience: isText,
            impact: isText,
            reflection: isText,
            bullets: (slots) =>
              Array.isArray(slots) &&
              slots.every(
                (slot) =>
                  isText(slot) ||
                  object({ bulletId: nullableText, text: isText, included: isBoolean })(slot)
              ),
          }),
          letter: object({
            hook: isText,
            whyYou: isText,
            whyThem: isText,
            closingAsk: isText,
            recipient: isText,
            sender: isText,
            messages: (m) =>
              isObject(m) &&
              Object.values(m).every(
                nullable(object({ text: isText, source: isText, savedAt: isNumber }))
              ),
          }),
          checklist: (c) => isObject(c) && Object.values(c).every(isBoolean),
          offer: object({
            basePay: amountLike,
            payPeriod: nullableText,
            guaranteedBonus: amountLike,
            variablePay: amountLike,
            hoursPerWeek: amountLike,
            weeksPerYear: amountLike,
            overtimeHoursPerWeek: amountLike,
            notes: isText,
            wageSource: isText,
            wageSourceDate: nullableText,
            percentOfBase: (p) => isObject(p) && Object.values(p).every(amountLike),
            currency: isText,
          }),
          resumeSelection: nullable(
            (r) =>
              isObject(r) &&
              textArray(r.bulletIds) &&
              fields(r, { bulletTexts: textArray, updatedAt: isNumber })
          ),
          updatedAt: isNumber,
        })
    ),
};

/** The structured resume has no normalizer at read time. Check its top-level contract too. */
function validateResumeDocument(value: unknown): void {
  if (
    !isObject(value) ||
    !['pdf', 'docx', 'text'].includes(String(value.source)) ||
    !isObject(value.file) ||
    !isText(value.file.name) ||
    !isNumber(value.file.sizeBytes) ||
    !(value.file.pageCount === null || isNumber(value.file.pageCount)) ||
    !objectArray(value.pages) ||
    !value.pages.every((page) => isNumber(page.index)) ||
    !objectArray(value.lines) ||
    // The fields the resume tools read on every line without checking.
    !value.lines.every(
      (line) =>
        isText(line.id) &&
        isText(line.text) &&
        isNumber(line.pageIndex) &&
        isBoolean(line.bullet) &&
        isObject(line.origin) &&
        isText(line.origin.kind) &&
        isText(line.origin.part) &&
        (line.box === null || isObject(line.box)) &&
        objectArray(line.items) &&
        (line.continuationOf === undefined || isText(line.continuationOf))
    ) ||
    !textArray(value.extractionOrder) ||
    !textArray(value.geometricOrder) ||
    !objectArray(value.sections) ||
    !value.sections.every(
      (section) =>
        isText(section.id) &&
        isText(section.kind) &&
        isText(section.headingLineId) &&
        textArray(section.lineIds)
    ) ||
    !isObject(value.contact) ||
    !objectArray(value.contact.links) ||
    !isText(value.plainText) ||
    !objectArray(value.findings) ||
    !value.findings.every(
      (finding) => isText(finding.id) && isText(finding.claim) && textArray(finding.lineIds)
    )
  ) {
    throw new Error(
      `That file contains invalid data for "${RESUME_DOCUMENT_RECORD}". Your saved work was not changed.`
    );
  }
}

function validateStore(key: StudioStorageKey, value: unknown): void {
  if (!STORE_CHECKS[key](value)) {
    throw new Error(
      `That file contains invalid data for "${key}". Your saved work was not changed.`
    );
  }
}

/** Parse and validate a file the user picked. Throws a readable message. */
export function parseBackup(text: string): StudioBackup {
  if (
    text.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES
  ) {
    throw new Error(BACKUP_SIZE_MESSAGE);
  }
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
    if (isKey(key) && value !== undefined && value !== null) {
      validateStore(key, value);
      stores[key] = value;
    }
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
    if (doc !== undefined && doc !== null) {
      validateResumeDocument(doc);
      parsed.records = { [RESUME_DOCUMENT_RECORD]: doc };
    }
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
async function restoreValidatedBackup(
  backup: StudioBackup,
  replace: boolean
): Promise<RestoredStore[]> {
  if (typeof window === 'undefined') return [];
  if (!backup.stores || typeof backup.stores !== 'object' || Array.isArray(backup.stores)) {
    throw new Error('That file was not exported by 5 Whys Career Studio.');
  }
  for (const key of STUDIO_STORAGE_KEYS) {
    const value = backup.stores[key];
    if (value !== undefined && value !== null) validateStore(key, value);
  }
  const resumeDocument = backup.records?.[RESUME_DOCUMENT_RECORD];
  if (resumeDocument !== undefined && resumeDocument !== null)
    validateResumeDocument(resumeDocument);
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

let importing = false;

/** A second submission must not overlap a staged import or its rollback. */
export async function restoreBackup(
  backup: StudioBackup,
  replace: boolean
): Promise<RestoredStore[]> {
  if (importing) return [];
  importing = true;
  try {
    return await restoreValidatedBackup(backup, replace);
  } finally {
    importing = false;
  }
}
