import * as React from 'react';

import { buildBullet, editBonus, fieldBonus } from './analysis';
import { scoreBullet } from './scoring';
import { decodeEntities, normalizeLine, uniqueId } from './text';
import type { BulletFields, BulletRecord, SignalReport, StoredResumeSession } from './types';

const SESSION_STORAGE_KEY = 'resume-game-session-v2';

const EMPTY_SIGNAL_REPORT: SignalReport = { visible: 0, hidden: 100, numbers: 0, verbs: 0 };

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
  const visible = clamp(data.visible, 0, 100, 0);
  const numbers = clamp(data.numbers, 0, 999, 0);
  const verbs = clamp(data.verbs, 0, 999, 0);
  const hidden = clamp(data.hidden, 0, 100, 100 - visible);
  return { visible, hidden, numbers, verbs };
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
  const baselineScore = typeof data.baselineScore === 'number' ? data.baselineScore : scoreBullet(original || improved);
  const improvedScore = typeof data.improvedScore === 'number' ? data.improvedScore : scoreBullet(improved);
  const id = typeof data.id === 'string' ? data.id : uniqueId('stored-bullet', index);
  return {
    id,
    original,
    fields,
    baselineScore,
    improved,
    improvedScore,
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
