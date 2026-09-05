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
    typeof candidate.stores !== 'object'
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
 * Write a backup into this browser. `replace` clears the studio's own keys
 * first; otherwise stores in the file overwrite only the keys they contain.
 */
export function restoreBackup(backup: StudioBackup, replace: boolean): StudioStorageKey[] {
  if (typeof window === 'undefined') return [];
  const written: StudioStorageKey[] = [];
  if (replace) {
    for (const key of STUDIO_STORAGE_KEYS) window.localStorage.removeItem(key);
  }
  for (const key of STUDIO_STORAGE_KEYS) {
    const value = backup.stores[key];
    if (value === undefined) continue;
    window.localStorage.setItem(key, JSON.stringify(value));
    written.push(key);
  }
  return written;
}
