import * as React from 'react';

import { buildBullet } from './analysis';
import { scoreBullet } from './scoring';
import { decodeEntities, uniqueId } from './text';
import type { BulletFields, BulletRecord, SignalReport, StoredResumeSession } from './types';

const SESSION_STORAGE_KEY = 'resume-game-session-v2';

// Optional details (hedging words, repetition, etc.) are intentionally
// absent here: they only exist once a real analysis has produced them.
const EMPTY_SIGNAL_REPORT: SignalReport = {
  numbers: 0,
  verbs: 0,
  wordCount: 0,
  bulletCount: 0,
  estimatedPages: 0,
  sections: [],
  hardSkills: [],
  softSkills: [],
  isOptimalLength: false,
  lengthRecommendation: '',
};

const EMPTY_SESSION: StoredResumeSession = {
  resumeText: '',
  needsRescan: false,
  bullets: [],
  selectedBulletId: null,
  lastAnalyzedAt: null,
  signalReport: EMPTY_SIGNAL_REPORT,
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeSignalReport(value: unknown): SignalReport {
  if (!value || typeof value !== 'object') return { ...EMPTY_SIGNAL_REPORT };
  const data = value as Record<string, unknown>;
  const clamp = (num: unknown, min: number, max: number, fallback: number) => {
    if (typeof num !== 'number' || Number.isNaN(num)) return fallback;
    return Math.min(Math.max(num, min), max);
  };
  // Optional deep metrics: preserve real stored values, but never invent a
  // value (like 0) when the stored session predates deep analysis.
  const clampOptional = (num: unknown, min: number, max: number): number | undefined => {
    if (typeof num !== 'number' || Number.isNaN(num)) return undefined;
    return Math.min(Math.max(num, min), max);
  };
  const toStrArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
    return [];
  };
  const toRepetitiveVerbArray = (v: unknown): { verb: string; count: number }[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        verb: typeof item.verb === 'string' ? item.verb : '',
        count: typeof item.count === 'number' ? item.count : 0,
      }))
      .filter((item) => item.verb && item.count > 0);
  };
  const toKeywordDensityArray = (v: unknown): { word: string; count: number }[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        word: typeof item.word === 'string' ? item.word : '',
        count: typeof item.count === 'number' ? item.count : 0,
      }))
      .filter((item) => item.word && item.count > 0);
  };
  const numbers = clamp(data.numbers, 0, 999, 0);
  const verbs = clamp(data.verbs, 0, 999, 0);
  // Retired composite numbers from older sessions ("visible", "hidden",
  // "benchmarkScore", "impactCoverage", and the percentages) are dropped here.
  return {
    numbers,
    verbs,
    wordCount: clamp(data.wordCount, 0, 10000, 0),
    bulletCount: clamp(data.bulletCount, 0, 500, 0),
    estimatedPages: clamp(data.estimatedPages, 0, 10, 0),
    sections: toStrArray(data.sections),
    hardSkills: toStrArray(data.hardSkills),
    softSkills: toStrArray(data.softSkills),
    isOptimalLength: typeof data.isOptimalLength === 'boolean' ? data.isOptimalLength : false,
    lengthRecommendation:
      typeof data.lengthRecommendation === 'string' ? data.lengthRecommendation : '',
    structureNote: typeof data.structureNote === 'string' ? data.structureNote : undefined,
    skippedLines: clampOptional(data.skippedLines, 0, 999),
    weakWordCount: clampOptional(data.weakWordCount, 0, 999),
    repetitiveVerbs: toRepetitiveVerbArray(data.repetitiveVerbs),
    keywordDensity: toKeywordDensityArray(data.keywordDensity),
  };
}

function normalizeStoredBullet(entry: unknown, index: number): BulletRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const data = entry as Record<string, unknown>;
  const rawFields = (data.fields ?? {}) as Record<string, unknown>;
  const fields: BulletFields = {
    verb: sanitizeString(rawFields.verb),
    task: sanitizeString(rawFields.task),
    impact: sanitizeString(rawFields.impact),
    quantifier: sanitizeString(rawFields.quantifier),
  };
  const original = sanitizeString(data.original, '');
  const fallbackBullet = buildBullet(fields);
  const improved = sanitizeString(data.improved, fallbackBullet || original || fallbackBullet);
  // Scores are a pure function of the text, so they are recomputed on load:
  // a session saved under an older rubric shows the same numbers as a fresh
  // analysis of the same lines.
  const baselineScore = clampScore(scoreBullet(original || improved));
  const improvedScore = clampScore(scoreBullet(improved));
  const id = typeof data.id === 'string' ? data.id : uniqueId('stored-bullet', index);
  const toStrArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
    return [];
  };
  return {
    id,
    original,
    fields,
    baselineScore,
    improved,
    improvedScore,
    weakWords: toStrArray(data.weakWords),
    hasImpact: typeof data.hasImpact === 'boolean' ? data.hasImpact : false,
    edited: typeof data.edited === 'boolean' ? data.edited : improved !== original,
    isRepetitiveVerb: typeof data.isRepetitiveVerb === 'boolean' ? data.isRepetitiveVerb : false,
  };
}

function normalizeStoredSession(value: unknown): StoredResumeSession {
  if (!value || typeof value !== 'object') return { ...EMPTY_SESSION };
  const data = value as Record<string, unknown>;
  const resumeText = sanitizeString(data.resumeText, '');
  const rawBullets = Array.isArray(data.bullets) ? data.bullets : [];
  const bullets = rawBullets
    .map((entry, index) => normalizeStoredBullet(entry, index))
    .filter(Boolean) as BulletRecord[];
  let selectedBulletId = typeof data.selectedBulletId === 'string' ? data.selectedBulletId : null;
  if (!bullets.some((bullet) => bullet.id === selectedBulletId)) {
    selectedBulletId = bullets[0]?.id ?? null;
  }
  const lastAnalyzedAt = typeof data.lastAnalyzedAt === 'string' ? data.lastAnalyzedAt : null;
  const signalReport = normalizeSignalReport(data.signalReport);
  return {
    resumeText,
    // Older sessions did not record whether their saved text was re-analyzed.
    needsRescan: typeof data.needsRescan === 'boolean' ? data.needsRescan : Boolean(lastAnalyzedAt),
    bullets,
    selectedBulletId,
    lastAnalyzedAt,
    signalReport,
  };
}

function persistResumeSession(session: StoredResumeSession) {
  if (!isBrowser()) return true;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch (err) {
    console.warn('Unable to persist resume game session', err);
    return false;
  }
}

export function useResumeSession() {
  const [session, setLoaded] = React.useState<StoredResumeSession>(EMPTY_SESSION);
  const [mounted, setMounted] = React.useState(false);
  // True once the visitor has changed something. Opening the page only reads:
  // another tab, or an import on the dashboard, may have saved newer work, and
  // writing back the snapshot this tab loaded would destroy it.
  const changed = React.useRef(false);
  const setSession = React.useCallback<React.Dispatch<React.SetStateAction<StoredResumeSession>>>(
    (next) => {
      changed.current = true;
      setLoaded(next);
    },
    []
  );
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!isBrowser()) return;
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        setLoaded(normalizeStoredSession(parsed));
        return;
      }

      const legacy = window.localStorage.getItem('resume-game-text');
      if (legacy) {
        setLoaded(
          normalizeStoredSession({
            resumeText: decodeEntities(legacy),
          })
        );
      }
    } catch (err) {
      console.warn('Unable to restore resume game session', err);
      setStorageNotice('Previous resume session could not be restored from storage.');
    }
  }, []);

  React.useEffect(() => {
    if (!mounted || !changed.current) return;
    const success = persistResumeSession(session);
    if (!success) {
      setStorageNotice('Auto-save is paused because browser storage is unavailable.');
    } else if (storageNotice) {
      setStorageNotice(null);
    }
  }, [session, mounted, storageNotice]);

  return { session, setSession, storageNotice } as const;
}

export { EMPTY_SESSION, EMPTY_SIGNAL_REPORT, SESSION_STORAGE_KEY };
