/**
 * One export and one import for everything the four tools keep in this
 * browser. The privacy model means nothing syncs; this is how a student moves
 * their work from a school laptop to their phone, or keeps a copy before
 * clearing site data.
 *
 * Every key listed here is written by a tool; the source of truth for each is
 * named next to it. Adding a store to a tool means adding its key here.
 */

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
] as const;

export type StudioStorageKey = (typeof STUDIO_STORAGE_KEYS)[number];

export const BACKUP_FORMAT = '5whys-career-studio';
export const BACKUP_VERSION = 1;

export interface StudioBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Raw stored JSON per key, exactly as the tool wrote it. */
  stores: Partial<Record<StudioStorageKey, unknown>>;
}

export interface BackupSummary {
  reflections: number;
  resumeBullets: number;
  practiceRounds: number;
  stories: number;
  hasProfile: boolean;
}

const isKey = (value: string): value is StudioStorageKey =>
  (STUDIO_STORAGE_KEYS as readonly string[]).includes(value);

export function collectBackup(): StudioBackup {
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
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

export function summarizeBackup(backup: StudioBackup): BackupSummary {
  const s = backup.stores;
  const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const glow = s['interview-glow-up-data'] as { stories?: unknown[] } | undefined;
  const resume = s['resume-game-session-v2'] as { bullets?: unknown[] } | undefined;
  return {
    reflections: count(s['career-why-history']),
    resumeBullets: count(resume?.bullets),
    practiceRounds: count(s['networking-practice-sessions']),
    stories: count(glow?.stories),
    hasProfile: !!s['career-tools-profile'],
  };
}

export function downloadBackup(): StudioBackup {
  const backup = collectBackup();
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
  return {
    format: BACKUP_FORMAT,
    version: candidate.version ?? BACKUP_VERSION,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    stores,
  };
}

/**
 * Stage the imported values and originals before changing saved work. Replace
 * removes omitted studio keys only after every imported store has saved.
 * Recovery is best effort: localStorage has no transaction across keys or tabs.
 */
export function restoreBackup(backup: StudioBackup, replace: boolean): StudioStorageKey[] {
  if (typeof window === 'undefined') return [];
  if (!backup.stores || typeof backup.stores !== 'object' || Array.isArray(backup.stores)) {
    throw new Error('That file was not exported by 5 Whys Career Studio.');
  }
  const staged = new Map<StudioStorageKey, string>();
  try {
    for (const key of STUDIO_STORAGE_KEYS) {
      const value = backup.stores[key];
      if (value === undefined || value === null) continue;
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('Unserializable store');
      staged.set(key, serialized);
    }
  } catch (cause) {
    throw new Error(
      'That file contains data this browser could not save. Your saved work was not changed.',
      { cause }
    );
  }
  // An empty export is not an instruction to erase the studio.
  if (staged.size === 0) return [];

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
    throw new Error(
      recovered
        ? 'Could not save that file in this browser. Your previous saved work was restored. Try again or use another browser.'
        : 'Could not finish importing that file or restore all previous saved work. Some saved work may have changed. Keep your backup file and export what is here before trying again.',
      { cause }
    );
  }
  return [...staged.keys()];
}
