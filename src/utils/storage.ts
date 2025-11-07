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
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

function loadCollection<T>(key: string): T[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(key);
  const parsed = parseJson<T[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function loadVersions(): NetworkingPracticeVersion[] {
  return loadCollection<NetworkingPracticeVersion>(VERSION_KEY);
}

export function saveVersion(version: NetworkingPracticeVersion) {
  const versions = loadVersions();
  const existingIndex = versions.findIndex((item) => item.id === version.id);
  if (existingIndex >= 0) {
    versions[existingIndex] = version;
  } else {
    versions.unshift(version);
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

export function saveSession(session: NetworkingPracticeSession) {
  const sessions = loadSessions();
  const existingIndex = sessions.findIndex((item) => item.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }
  persist(SESSION_KEY, sessions);
}

export function deleteSession(id: string) {
  const sessions = loadSessions().filter((session) => session.id !== id);
  persist(SESSION_KEY, sessions);
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `np-${Math.random().toString(36).slice(2, 10)}`;
}
