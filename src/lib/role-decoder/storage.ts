export type ExperienceMapping = {
  id: string;
  skillKey: string;
  skillLabel: string;
  title: string;
  summary: string;
  evidence: string[];
  impact: string;
  confidence: number;
  updatedAt: string;
};

export type RoleDecoderSnapshot = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  fitCoverage: number;
  skillCount: number;
  experiences: ExperienceMapping[];
};

const STORAGE_KEY = 'role-decoder-snapshots-v1';
const EXPERIENCES_KEY = 'role-decoder-experiences-v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadSnapshots(): RoleDecoderSnapshot[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse<RoleDecoderSnapshot[]>(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((snapshot) => ({
    ...snapshot,
    experiences: Array.isArray(snapshot.experiences) ? snapshot.experiences : [],
  }));
}

export function saveSnapshot(snapshot: RoleDecoderSnapshot) {
  if (!isBrowser()) return;
  const snapshots = loadSnapshots();
  const existingIndex = snapshots.findIndex((item) => item.id === snapshot.id);
  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshot;
  } else {
    snapshots.unshift(snapshot);
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(0, 8)));
}

export function deleteSnapshot(id: string) {
  if (!isBrowser()) return;
  const snapshots = loadSnapshots().filter((item) => item.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

export function generateId(prefix = 'rd'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadExperiences(): ExperienceMapping[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(EXPERIENCES_KEY);
  const parsed = safeParse<ExperienceMapping[]>(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((experience) => ({
    ...experience,
    evidence: Array.isArray(experience.evidence) ? experience.evidence : [],
    confidence: typeof experience.confidence === 'number' ? experience.confidence : 3,
  }));
}

export function saveExperiences(experiences: ExperienceMapping[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(EXPERIENCES_KEY, JSON.stringify(experiences));
}
