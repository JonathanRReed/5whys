import * as React from 'react';

import { buildBullet } from './analysis';
import { scoreBullet } from './scoring';
import { decodeEntities, uniqueId } from './text';
import type { BulletFields, BulletRecord, SignalReport, StoredResumeSession } from './types';

const SESSION_STORAGE_KEY = 'resume-game-session-v2';

const EMPTY_SIGNAL_REPORT: SignalReport = {
  visible: 0,
  hidden: 100,
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
  weakWordCount: 0,
  repetitiveVerbs: [],
  impactCoverage: 0,
  keywordDensity: [],
  benchmarkScore: 0,
  uniqueVerbCount: 0,
};

const EMPTY_SESSION: StoredResumeSession = {
  resumeText: '',
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

function normalizeSignalReport(value: unknown): SignalReport {
  if (!value || typeof value !== 'object') return { ...EMPTY_SIGNAL_REPORT };
  const data = value as Record<string, unknown>;
  const clamp = (num: unknown, min: number, max: number, fallback: number) => {
    if (typeof num !== 'number' || Number.isNaN(num)) return fallback;
    return Math.min(Math.max(num, min), max);
  };
  const toStrArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
    return [];
  };
  const toRepetitiveVerbArray = (v: unknown): { verb: string; count: number }[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        verb: typeof item.verb === 'string' ? item.verb : '',
        count: typeof item.count === 'number' ? item.count : 0,
      }))
      .filter((item) => item.verb && item.count > 0);
  };
  const toKeywordDensityArray = (v: unknown): { word: string; count: number }[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        word: typeof item.word === 'string' ? item.word : '',
        count: typeof item.count === 'number' ? item.count : 0,
      }))
      .filter((item) => item.word && item.count > 0);
  };
  const visible = clamp(data.visible, 0, 100, 0);
  const numbers = clamp(data.numbers, 0, 999, 0);
  const verbs = clamp(data.verbs, 0, 999, 0);
  const hidden = clamp(data.hidden, 0, 100, 100 - visible);
  return {
    visible,
    hidden,
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
    weakWordCount: clamp(data.weakWordCount, 0, 999, 0),
    repetitiveVerbs: toRepetitiveVerbArray(data.repetitiveVerbs),
    impactCoverage: clamp(data.impactCoverage, 0, 100, 0),
    keywordDensity: toKeywordDensityArray(data.keywordDensity),
    benchmarkScore: clamp(data.benchmarkScore, 0, 100, 0),
    uniqueVerbCount: clamp(data.uniqueVerbCount, 0, 999, 0),
    quantifiedBulletPercent: clamp(data.quantifiedBulletPercent, 0, 100, 0),
    avgBulletLength: clamp(data.avgBulletLength, 0, 200, 0),
    passiveVoicePercent: clamp(data.passiveVoicePercent, 0, 100, 0),
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
  const baselineScore =
    typeof data.baselineScore === 'number' ? data.baselineScore : scoreBullet(original || improved);
  const improvedScore =
    typeof data.improvedScore === 'number' ? data.improvedScore : scoreBullet(improved);
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
  const [session, setSession] = React.useState<StoredResumeSession>(EMPTY_SESSION);
  const [mounted, setMounted] = React.useState(false);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!isBrowser()) return;
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        setSession(normalizeStoredSession(parsed));
        return;
      }

      const legacy = window.localStorage.getItem('resume-game-text');
      if (legacy) {
        setSession(
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
    if (!mounted) return;
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
