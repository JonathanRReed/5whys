import scenarioData from '../data/networking-scenarios.json';

export type NetworkingPracticeVersion = {
  id: string;
  title: string;
  scenarioId: string;
  who: string;
  where: string;
  what: string;
  notes?: string;
  updatedAt: string;
};

export type PracticeRatings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

export type PracticeReflection = {
  humanNote: string;
  nervesNote: string;
  nextFocus: string;
  wins: string;
};

export type PracticeAttempt = {
  id: string;
  label: string;
  script: string;
  durationSeconds: number;
  createdAt: string;
};

export type NetworkingPracticeSession = {
  id: string;
  versionId: string;
  scenarioId: string;
  scenarioTitle: string;
  attempts: PracticeAttempt[];
  ratings: PracticeRatings;
  reflection: PracticeReflection;
  questionDraft?: string;
  affirmation?: string;
  createdAt: string;
};

const VERSION_KEY = 'networking-practice-versions';
const SESSION_KEY = 'networking-practice-sessions';
export const SESSION_LIMIT = 60;
const TITLE_FIXES = new Map([['Career Fair – Recruiter Chatt', 'Career Fair – Recruiter Chat']]);
const SCENARIO_TITLE_BY_ID = new Map((scenarioData as { id: string; title: string }[]).map((scenario) => [scenario.id, scenario.title]));

function isBrowser() {
  return typeof window !== 'undefined';
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const emptyReflection: PracticeReflection = {
  humanNote: '',
  nervesNote: '',
  nextFocus: '',
  wins: '',
};

function normalizeRatings(raw: unknown): PracticeRatings {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    confidence: clamp(input.confidence as number, 1, 5, 3),
    clarity: clamp(input.clarity as number, 1, 5, 3),
    rapport: clamp((input as Record<string, number>).rapport ?? (input as Record<string, number>).flow, 1, 5, 3),
    authenticity: clamp((input as Record<string, number>).authenticity ?? (input as Record<string, number>).conciseness, 1, 5, 3),
  };
}

function normalizeReflection(raw: unknown): PracticeReflection {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    humanNote: typeof input.humanNote === 'string' ? input.humanNote : '',
    nervesNote: typeof input.nervesNote === 'string' ? input.nervesNote : '',
    nextFocus: typeof input.nextFocus === 'string' ? input.nextFocus : '',
    wins: typeof input.wins === 'string' ? input.wins : '',
  };
}

function normalizeVersionTitle(value: unknown, scenarioId: string) {
  const fallback = SCENARIO_TITLE_BY_ID.get(scenarioId) ?? 'Practice Version';
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return TITLE_FIXES.get(trimmed) ?? trimmed;
}

function normalizeStringField(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function normalizeVersion(raw: unknown): NetworkingPracticeVersion | null {
  if (!raw) return null;
  const data = raw as Record<string, unknown>;
  const scenarioId = typeof data.scenarioId === 'string' ? data.scenarioId : 'custom';
  return {
    id: typeof data.id === 'string' ? data.id : generateId(),
    title: normalizeVersionTitle(data.title, scenarioId),
    scenarioId,
    who: normalizeStringField(data.who),
    where: normalizeStringField(data.where),
    what: normalizeStringField(data.what),
    notes: normalizeStringField(data.notes),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };
}

function normalizeAttempts(raw: unknown): PracticeAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((attempt) => {
      const data = attempt as Record<string, unknown>;
      const script = typeof data.script === 'string' ? data.script : '';
      if (!script.trim()) return null;
      return {
        id: typeof data.id === 'string' ? data.id : generateId(),
        label: typeof data.label === 'string' ? data.label : 'Attempt',
        script,
        durationSeconds: clamp(data.durationSeconds as number, 0, 600, 0),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
      } satisfies PracticeAttempt;
    })
    .filter(Boolean) as PracticeAttempt[];
}

function upgradeSession(session: unknown): NetworkingPracticeSession | null {
  const data = (session ?? {}) as Record<string, unknown>;
  const scenarioId = typeof data.scenarioId === 'string' ? data.scenarioId : 'unknown';
  const attempts = normalizeAttempts(data.attempts ?? [
    {
      id: generateId(),
      label: 'Round 1',
      script: typeof data.what === 'string' ? data.what : '',
      durationSeconds: clamp(data.durationSeconds as number, 0, 600, 0),
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    },
  ]);

  return {
    id: typeof data.id === 'string' ? data.id : generateId(),
    versionId: typeof data.versionId === 'string' ? data.versionId : 'unknown-version',
    scenarioId,
    scenarioTitle: typeof data.scenarioTitle === 'string' ? data.scenarioTitle : 'Networking Practice',
    attempts,
    ratings: normalizeRatings(data.ratings),
    reflection: normalizeReflection(data.reflection ?? emptyReflection),
    questionDraft: typeof data.questionDraft === 'string' ? data.questionDraft : '',
    affirmation: typeof data.affirmation === 'string' ? data.affirmation : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
  } satisfies NetworkingPracticeSession;
}

function persist<T>(key: string, payload: T) {
  if (!isBrowser()) return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn(`Unable to persist key "${key}"`, err);
    return false;
  }
}

function loadCollection<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = parseJson<T[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Unable to load collection for key "${key}"`, err);
    return [];
  }
}

export function loadVersions(): NetworkingPracticeVersion[] {
  const raw = loadCollection<unknown>(VERSION_KEY);
  return raw
    .map((version) => normalizeVersion(version))
    .filter(Boolean) as NetworkingPracticeVersion[];
}

export function saveVersion(version: NetworkingPracticeVersion) {
  const normalized = normalizeVersion(version);
  if (!normalized) return;
  const versions = loadVersions();
  const existingIndex = versions.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    versions[existingIndex] = normalized;
  } else {
    versions.unshift(normalized);
  }
  persist(VERSION_KEY, versions);
}

export function deleteVersion(id: string) {
  const versions = loadVersions().filter((version) => version.id !== id);
  persist(VERSION_KEY, versions);
}

export function loadSessions(): NetworkingPracticeSession[] {
  const raw = loadCollection<unknown>(SESSION_KEY);
  return raw
    .map((session) => upgradeSession(session))
    .filter(Boolean) as NetworkingPracticeSession[];
}

export function saveSession(session: NetworkingPracticeSession, limit = SESSION_LIMIT) {
  const sessions = loadSessions();
  const existingIndex = sessions.findIndex((item) => item.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }
  const trimmed = sessions.slice(0, Math.max(1, limit));
  return persist(SESSION_KEY, trimmed);
}

export function deleteSession(id: string) {
  const sessions = loadSessions().filter((session) => session.id !== id);
  return persist(SESSION_KEY, sessions);
}

export function clearSessions() {
  return persist(SESSION_KEY, []);
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `np-${Math.random().toString(36).slice(2, 10)}`;
}
