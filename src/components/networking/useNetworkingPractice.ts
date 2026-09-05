import * as React from 'react';
import scenarioData from '../../data/networking-scenarios.json';
import type {
  NetworkingPracticeSession,
  NetworkingPracticeVersion,
  PracticeReflection,
} from '../../utils/storage';
import {
  clearSessions,
  deleteSession,
  deleteVersion,
  generateId,
  loadSessions,
  loadVersions,
  SESSION_LIMIT,
  saveSession,
  saveVersion,
} from '../../utils/storage';
import { useClipboard } from './useClipboard';
import { useTimer } from './useTimer';

export type ScenarioIngredient = {
  id: string;
  label: string;
  line: string;
};

export type QuestionTemplate = {
  id: string;
  label: string;
  prompt: string;
};

export type Scenario = {
  id: string;
  title: string;
  mode: string;
  focus: string;
  audience: string;
  who: string;
  where: string;
  what: string[];
  ingredients: ScenarioIngredient[];
  rapportSamples: string[];
  questionTemplates: QuestionTemplate[];
};

export type Ratings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

const defaultRatings: Ratings = { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 };
const emptyReflection: PracticeReflection = {
  humanNote: '',
  nervesNote: '',
  nextFocus: '',
  wins: '',
};
const NOTICE_RESET_MS = 3500;
const DRAFT_MAX_LENGTH = 1500;

// The in-progress rep: the draft, the ratings, and the reflection notes. It
// used to live only in React state, so a reload lost the intro. Now it is
// written on every change and restored on load. career-bridge reads this
// key too, to tell a drafted-but-never-practiced intro from a blank one.
export const DRAFT_STORAGE_KEY = 'networking-practice-draft';

type StoredDraft = {
  text: string;
  ratings: Ratings;
  ratingsTouched: boolean;
  reflection: PracticeReflection;
  versionId: string | null;
  updatedAt: string;
};

function readStoredDraft(): StoredDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredDraft>;
    const ratings = (data.ratings ?? {}) as Partial<Ratings>;
    const reflection = (data.reflection ?? {}) as Partial<PracticeReflection>;
    return {
      text: typeof data.text === 'string' ? data.text.slice(0, DRAFT_MAX_LENGTH) : '',
      ratings: {
        confidence: typeof ratings.confidence === 'number' ? ratings.confidence : 3,
        clarity: typeof ratings.clarity === 'number' ? ratings.clarity : 3,
        rapport: typeof ratings.rapport === 'number' ? ratings.rapport : 3,
        authenticity: typeof ratings.authenticity === 'number' ? ratings.authenticity : 3,
      },
      ratingsTouched: data.ratingsTouched === true,
      reflection: {
        humanNote: typeof reflection.humanNote === 'string' ? reflection.humanNote : '',
        nervesNote: typeof reflection.nervesNote === 'string' ? reflection.nervesNote : '',
        nextFocus: typeof reflection.nextFocus === 'string' ? reflection.nextFocus : '',
        wins: typeof reflection.wins === 'string' ? reflection.wins : '',
      },
      versionId: typeof data.versionId === 'string' ? data.versionId : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStoredDraft(draft: StoredDraft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable: the rep still works for this visit */
  }
}

function scenarioToVersion(scenario: Scenario, title?: string): NetworkingPracticeVersion {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title ?? scenario.title,
    scenarioId: scenario.id,
    who: scenario.who,
    where: scenario.where,
    what: scenario.what.join('\n'),
    notes: '',
    updatedAt: now,
  };
}

function useHydratedState<T>(initial: T, loader: () => T) {
  const [state, setState] = React.useState(initial);
  React.useEffect(() => {
    setState(loader());
  }, [loader]);
  return [state, setState] as const;
}

const FALLBACK_SCENARIO: Scenario = {
  id: 'default',
  title: 'Default Scenario',
  mode: 'Practice',
  focus: 'Clarity',
  audience: 'student',
  who: 'You + Guest',
  where: 'Networking Event',
  what: ['Introduce yourself', 'Share your goal', 'Ask a question'],
  ingredients: [],
  rapportSamples: [],
  questionTemplates: [],
};

export function useNetworkingPractice() {
  const scenarios = scenarioData as Scenario[];
  const fallbackVersion = React.useMemo(
    () => scenarioToVersion(scenarios[0] ?? FALLBACK_SCENARIO),
    []
  );

  const loadVersionsFromStorage = React.useCallback(() => {
    const existing = loadVersions();
    return existing.length ? existing : [fallbackVersion];
  }, [fallbackVersion]);

  const [versions, setVersions] = useHydratedState<NetworkingPracticeVersion[]>(
    [fallbackVersion],
    loadVersionsFromStorage
  );
  const [sessions, setSessions] = useHydratedState<NetworkingPracticeSession[]>([], loadSessions);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = React.useState<string>(fallbackVersion.id);
  const [ratings, setRatings] = React.useState<Ratings>(defaultRatings);
  const [ratingsTouched, setRatingsTouched] = React.useState(false);
  const [reflection, setReflection] = React.useState<PracticeReflection>(emptyReflection);
  const [draft, setDraftState] = React.useState('');
  const [draftHydrated, setDraftHydrated] = React.useState(false);

  const { timer, resetTimer, startTimer, pauseTimer } = useTimer();
  const { copiedKey, handleCopy } = useClipboard();

  // Restore the in-progress rep once. The intro it belonged to is re-selected
  // in a second step, after the saved intros have loaded from storage.
  const [pendingVersionId, setPendingVersionId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const stored = readStoredDraft();
    if (stored) {
      setDraftState(stored.text);
      setRatings(stored.ratings);
      setRatingsTouched(stored.ratingsTouched);
      setReflection(stored.reflection);
      setPendingVersionId(stored.versionId);
    }
    setDraftHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!pendingVersionId) return;
    if (versions.some((v) => v.id === pendingVersionId)) {
      setCurrentVersionId(pendingVersionId);
      setPendingVersionId(null);
    }
  }, [pendingVersionId, versions]);

  React.useEffect(() => {
    if (!draftHydrated) return;
    writeStoredDraft({
      text: draft,
      ratings,
      ratingsTouched,
      reflection,
      versionId: currentVersionId,
      updatedAt: new Date().toISOString(),
    });
  }, [draft, ratings, ratingsTouched, reflection, currentVersionId, draftHydrated]);

  const currentVersion = React.useMemo(
    () => versions.find((v) => v.id === currentVersionId) ?? versions[0],
    [currentVersionId, versions]
  );
  const currentScenario = React.useMemo(
    () => scenarios.find((s) => s.id === currentVersion?.scenarioId),
    [currentVersion?.scenarioId]
  );
  const scenarioSteps = currentScenario?.what ?? [];
  const ingredients = currentScenario?.ingredients ?? [];
  const rapportSamples = currentScenario?.rapportSamples ?? [];
  const questionTemplates = currentScenario?.questionTemplates ?? [];

  React.useEffect(() => {
    if (!currentVersion && versions.length) {
      setCurrentVersionId(versions[0].id);
    }
  }, [currentVersion, versions]);

  React.useEffect(() => {
    if (!storageNotice) return;
    const timeout = window.setTimeout(() => setStorageNotice(null), NOTICE_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [storageNotice]);

  const setDraft = React.useCallback((value: string) => {
    setDraftState(value.slice(0, DRAFT_MAX_LENGTH));
  }, []);

  const handleScenarioChange = React.useCallback(
    (scenarioId: string) => {
      if (!currentVersion) return;
      const scenario = scenarios.find((item) => item.id === scenarioId);
      if (!scenario) return;
      // Only rename the version when the user never gave it a custom name.
      // Otherwise the version label keeps pointing at the old scenario.
      const previousScenario = scenarios.find((item) => item.id === currentVersion.scenarioId);
      const usesDefaultTitle =
        !currentVersion.title.trim() || currentVersion.title === previousScenario?.title;
      const updated: NetworkingPracticeVersion = {
        ...currentVersion,
        title: usesDefaultTitle ? scenario.title : currentVersion.title,
        scenarioId: scenario.id,
        who: scenario.who,
        where: scenario.where,
        what: scenario.what.join('\n'),
        updatedAt: new Date().toISOString(),
      };
      setVersions((existing) => {
        const next = existing.map((item) => (item.id === updated.id ? updated : item));
        saveVersion(updated);
        return next;
      });
    },
    [currentVersion, setVersions]
  );

  const handleFieldChange = React.useCallback(
    (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => {
      if (!currentVersion) return;
      const updated: NetworkingPracticeVersion = {
        ...currentVersion,
        [field]: value,
        updatedAt: new Date().toISOString(),
      };
      setVersions((existing) => {
        const next = existing.map((item) => (item.id === updated.id ? updated : item));
        saveVersion(updated);
        return next;
      });
    },
    [currentVersion, setVersions]
  );

  const createNewVersion = React.useCallback(() => {
    const scenario = currentScenario ?? scenarios[0];
    if (!scenario) return;
    // Name it automatically; the "Name this intro" field renames it inline.
    const existing = versions.filter((v) => v.scenarioId === scenario.id).length;
    const title =
      existing > 0 ? `${scenario.title} intro ${existing + 1}` : `${scenario.title} intro`;
    const nextVersion = scenarioToVersion(scenario, title);
    saveVersion(nextVersion);
    setVersions((prev) => [nextVersion, ...prev]);
    setCurrentVersionId(nextVersion.id);
    setStorageNotice(`Started "${title}". Rename it below if you like.`);
  }, [currentScenario, versions, setVersions]);

  const deleteCurrentVersion = React.useCallback(() => {
    if (!currentVersion) return;
    if (!window.confirm('Delete this practice version?')) return;
    const idToDelete = currentVersion.id;
    deleteVersion(idToDelete);
    setVersions((prev) => {
      const filtered = prev.filter((v) => v.id !== idToDelete);
      const next = filtered.length ? filtered : [fallbackVersion];
      if (idToDelete === currentVersionId) {
        setCurrentVersionId(next[0].id);
      }
      return next;
    });
  }, [currentVersion, currentVersionId, fallbackVersion, setVersions]);

  const saveCurrentSession = React.useCallback(() => {
    if (!currentVersion) return;
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      setStorageNotice(
        'Write your intro draft before saving. The history tracks your actual words, not the sample lines.'
      );
      return;
    }
    if (!ratingsTouched) {
      setStorageNotice(
        'Rate the rep first. Move at least one slider so the history reflects how it actually went.'
      );
      return;
    }
    const scenario =
      scenarios.find((item) => item.id === currentVersion.scenarioId) ?? scenarios[0];
    const session: NetworkingPracticeSession = {
      id: generateId(),
      versionId: currentVersion.id,
      scenarioId: currentVersion.scenarioId,
      scenarioTitle: scenario?.title ?? currentVersion.title,
      attempts: [
        {
          id: generateId(),
          label: 'Rep',
          script: trimmedDraft,
          durationSeconds: Math.min(timer.elapsed, 600),
          createdAt: new Date().toISOString(),
        },
      ],
      ratings,
      reflection: {
        humanNote: reflection.humanNote.trim(),
        nervesNote: reflection.nervesNote.trim(),
        nextFocus: reflection.nextFocus.trim(),
        wins: reflection.wins.trim(),
      },
      createdAt: new Date().toISOString(),
    };
    const success = saveSession(session);
    if (!success) {
      setStorageNotice(
        `You've saved ${SESSION_LIMIT} sessions. Export or delete old ones to save new practice rounds.`
      );
      return;
    }
    setSessions((prev) => [session, ...prev].slice(0, SESSION_LIMIT));
    setReflection(emptyReflection);
    setRatings(defaultRatings);
    setRatingsTouched(false);
    resetTimer();
    setStorageNotice('Rep saved to your local history. Your draft stays for the next one.');
  }, [
    currentVersion,
    draft,
    timer.elapsed,
    ratings,
    ratingsTouched,
    reflection,
    resetTimer,
    setSessions,
  ]);

  const removeSession = React.useCallback(
    (id: string) => {
      const success = deleteSession(id);
      if (!success) {
        setStorageNotice(
          'Unable to update session history. Check storage permissions and try again.'
        );
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [setSessions]
  );

  const exportSessions = React.useCallback(() => {
    if (sessions.length === 0) {
      setStorageNotice('No sessions to export yet. Record a practice round first.');
      return;
    }
    const filename = `networking-practice-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setStorageNotice('Sessions exported. Check your downloads.');
  }, [sessions]);

  const clearSessionHistory = React.useCallback(() => {
    if (sessions.length === 0) return;
    if (!window.confirm('Clear all saved networking practice sessions from this device?')) return;
    const success = clearSessions();
    if (!success) {
      setStorageNotice('Unable to clear history. Check storage permissions and try again.');
      return;
    }
    setSessions([]);
    setStorageNotice('Session history cleared.');
  }, [sessions, setSessions]);

  const handleRatingChange = React.useCallback((key: keyof Ratings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
    setRatingsTouched(true);
  }, []);

  const handleReflectionField = React.useCallback(
    (key: keyof PracticeReflection, value: string) => {
      setReflection((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetReview = React.useCallback(() => {
    resetTimer();
    setRatings(defaultRatings);
    setRatingsTouched(false);
    setReflection(emptyReflection);
  }, [resetTimer]);

  const sessionsAtCapacity = sessions.length >= SESSION_LIMIT;

  return {
    scenarios,
    versions,
    sessions,
    storageNotice,
    currentVersionId,
    setCurrentVersionId,
    timer,
    ratings,
    ratingsTouched,
    reflection,
    draft,
    setDraft,
    copiedKey,
    currentVersion,
    currentScenario,
    scenarioSteps,
    ingredients,
    rapportSamples,
    questionTemplates,
    sessionsAtCapacity,
    handleCopy,
    handleScenarioChange,
    handleFieldChange,
    createNewVersion,
    deleteCurrentVersion,
    resetTimer,
    startTimer,
    pauseTimer,
    saveCurrentSession,
    removeSession,
    exportSessions,
    clearSessionHistory,
    handleRatingChange,
    handleReflectionField,
    handleResetReview,
  };
}
