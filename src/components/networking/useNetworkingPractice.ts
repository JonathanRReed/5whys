import * as React from 'react';
import scenarioData from '../../data/networking-scenarios.json';
import { activeApplicationId, loadApplications } from '../../lib/applications';
import { localDate } from '../../lib/local-date';
import {
  completeRatings,
  joinLabels,
  missingRatingLabels,
  type PartialRatings,
  RATING_FIELDS,
} from '../../lib/networking-advice';
import { isStudentLike, readProfile } from '../../lib/profile';
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
import {
  applicationPrompts,
  customizeScenario,
  type FocusedApplication,
  MORE_SCENARIOS,
  repSeconds,
  repStep,
  repTitle,
} from './practice-model';
import { useClipboard } from './useClipboard';
import { DEFAULT_TIMER_SECONDS, SCENARIO_TIMER_SECONDS, useTimer } from './useTimer';

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

// Nothing is rated until the visitor rates it. A default of 3 used to show as
// an average and get saved as a real rating.
const unrated: PartialRatings = {};
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

// Format 2 stores only the ratings the visitor set. Older drafts stored all
// four, with a default of 3 for any the visitor never moved.
const DRAFT_RATING_FORMAT = 2;
const LEGACY_DEFAULT_RATING = 3;

type StoredDraft = {
  text: string;
  ratings: PartialRatings;
  /** Kept for older readers and backups: true when any rating is set. */
  ratingsTouched: boolean;
  ratingFormat?: number;
  reflection: PracticeReflection;
  versionId: string | null;
  updatedAt: string;
};

function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Reads the ratings out of a stored draft. A format 2 draft holds only what the
 * visitor set. An older draft cannot say which sliders were moved, so a value
 * of 3 (the old default) is treated as not rated; the others were moved.
 */
function readDraftRatings(data: Partial<StoredDraft>): PartialRatings {
  const raw = (data.ratings ?? {}) as Record<string, unknown>;
  const legacy = data.ratingFormat !== DRAFT_RATING_FORMAT;
  if (legacy && data.ratingsTouched !== true) return {};
  const ratings: PartialRatings = {};
  for (const { key } of RATING_FIELDS) {
    const value = raw[key];
    if (!isRating(value)) continue;
    if (legacy && value === LEGACY_DEFAULT_RATING) continue;
    ratings[key] = value;
  }
  return ratings;
}

function readStoredDraft(): StoredDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredDraft>;
    const reflection = (data.reflection ?? {}) as Partial<PracticeReflection>;
    return {
      text: typeof data.text === 'string' ? data.text.slice(0, DRAFT_MAX_LENGTH) : '',
      ratings: readDraftRatings(data),
      ratingsTouched: data.ratingsTouched === true,
      ratingFormat: DRAFT_RATING_FORMAT,
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

const SCENARIOS: Scenario[] = [...(scenarioData as Scenario[]), ...MORE_SCENARIOS];

/**
 * The first situation for a visitor with no saved intro. Students start at
 * the career fair; a saved profile past school starts somewhere that fits.
 */
function firstScenarioFor(stage: string | undefined): Scenario | undefined {
  if (stage === 'transition') return SCENARIOS.find((s) => s.id === 'career-changer');
  if (stage === 'mid' || stage === 'senior') {
    return SCENARIOS.find((s) => s.id === 'reconnect-colleague');
  }
  return undefined;
}

/** The application in focus on the dashboard, or null. Only reads. */
function readFocusedApplication(): FocusedApplication | null {
  try {
    const data = loadApplications();
    const id = activeApplicationId(data);
    const app = data.applications.find((item) => item.id === id);
    return app ? { title: app.title, company: app.company } : null;
  } catch {
    return null;
  }
}

export function useNetworkingPractice() {
  const scenarios = SCENARIOS;
  const fallbackVersion = React.useMemo(
    () => scenarioToVersion(scenarios[0] ?? FALLBACK_SCENARIO),
    []
  );
  // Read once on load: a visitor past school sees work-register guidance.
  const [studentLike, setStudentLike] = React.useState(true);
  const [focusedApplication, setFocusedApplication] = React.useState<FocusedApplication | null>(
    null
  );
  React.useEffect(() => {
    setStudentLike(isStudentLike(readProfile()));
    setFocusedApplication(readFocusedApplication());
  }, []);

  const loadVersionsFromStorage = React.useCallback(() => {
    const existing = loadVersions();
    if (existing.length) return existing;
    const first = firstScenarioFor(readProfile()?.stage);
    // Not saved until the visitor changes something.
    return [first ? { ...scenarioToVersion(first), id: fallbackVersion.id } : fallbackVersion];
  }, [fallbackVersion]);

  const [versions, setVersions] = useHydratedState<NetworkingPracticeVersion[]>(
    [fallbackVersion],
    loadVersionsFromStorage
  );
  const [sessions, setSessions] = useHydratedState<NetworkingPracticeSession[]>([], loadSessions);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);
  const [currentVersionId, setCurrentVersionIdState] = React.useState<string>(fallbackVersion.id);
  const [ratings, setRatings] = React.useState<PartialRatings>(unrated);
  const [reflection, setReflection] = React.useState<PracticeReflection>(emptyReflection);
  const [draft, setDraftState] = React.useState('');
  const [draftHydrated, setDraftHydrated] = React.useState(false);
  // Seconds of the take recorded for this rep, so a rep recorded without the
  // timer still saves how long it ran.
  const [recordedSeconds, setRecordedSeconds] = React.useState(0);

  // The draft is written only after the visitor changes something. Opening the
  // page and reading the stored draft must not write a fresh one, or another
  // tab's newer draft could be overwritten.
  const draftChangedRef = React.useRef(false);
  const markDraftChanged = React.useCallback(() => {
    draftChangedRef.current = true;
  }, []);
  const setCurrentVersionId = React.useCallback((id: string) => {
    draftChangedRef.current = true;
    setCurrentVersionIdState(id);
  }, []);

  const { timer, resetTimer, startTimer, pauseTimer, setTimerLength } = useTimer();
  const { copiedKey, handleCopy } = useClipboard();

  // Restore the in-progress rep once. The intro it belonged to is re-selected
  // in a second step, after the saved intros have loaded from storage.
  const [pendingVersionId, setPendingVersionId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const stored = readStoredDraft();
    if (stored) {
      setDraftState(stored.text);
      setRatings(stored.ratings);
      setReflection(stored.reflection);
      setPendingVersionId(stored.versionId);
    }
    setDraftHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!pendingVersionId) return;
    if (versions.some((v) => v.id === pendingVersionId)) {
      setCurrentVersionIdState(pendingVersionId);
      setPendingVersionId(null);
    }
  }, [pendingVersionId, versions]);

  React.useEffect(() => {
    if (!draftHydrated || !draftChangedRef.current) return;
    writeStoredDraft({
      text: draft,
      ratings,
      ratingsTouched: Object.keys(ratings).length > 0,
      ratingFormat: DRAFT_RATING_FORMAT,
      reflection,
      versionId: currentVersionId,
      updatedAt: new Date().toISOString(),
    });
  }, [draft, ratings, reflection, currentVersionId, draftHydrated]);

  const currentVersion = React.useMemo(
    () => versions.find((v) => v.id === currentVersionId) ?? versions[0],
    [currentVersionId, versions]
  );
  const presetScenario = React.useMemo(
    () => scenarios.find((s) => s.id === currentVersion?.scenarioId),
    [currentVersion?.scenarioId]
  );
  const fromApplication = React.useMemo(
    () => applicationPrompts(focusedApplication),
    [focusedApplication]
  );
  const currentScenario = React.useMemo(() => {
    if (!presetScenario || !currentVersion) return undefined;
    const customized = customizeScenario(presetScenario, currentVersion);
    if (!fromApplication) return customized;
    return {
      ...customized,
      questionTemplates: [...fromApplication.questions, ...customized.questionTemplates],
    };
  }, [presetScenario, currentVersion, fromApplication]);
  // Each scenario rehearses at its own length until the visitor picks one.
  const lengthPinnedRef = React.useRef(false);
  const pinTimerLength = React.useCallback(
    (seconds: number) => {
      lengthPinnedRef.current = true;
      setTimerLength(seconds);
    },
    [setTimerLength]
  );
  const scenarioId = currentScenario?.id;
  React.useEffect(() => {
    if (lengthPinnedRef.current || !scenarioId) return;
    setTimerLength(SCENARIO_TIMER_SECONDS[scenarioId] ?? DEFAULT_TIMER_SECONDS);
  }, [scenarioId, setTimerLength]);

  const scenarioSteps = currentScenario?.what ?? [];
  const ingredients = currentScenario?.ingredients ?? [];
  const rapportSamples = currentScenario?.rapportSamples ?? [];
  const questionTemplates = currentScenario?.questionTemplates ?? [];

  React.useEffect(() => {
    if (!currentVersion && versions.length) {
      setCurrentVersionIdState(versions[0].id);
    }
  }, [currentVersion, versions]);

  React.useEffect(() => {
    if (!storageNotice) return;
    const timeout = window.setTimeout(() => setStorageNotice(null), NOTICE_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [storageNotice]);

  const setDraft = React.useCallback((value: string) => {
    draftChangedRef.current = true;
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

  /**
   * Each saved intro keeps its own words. Before the page moves to another
   * intro, the words on screen are stored with the one being left.
   */
  const keepDraftWithCurrentVersion = React.useCallback(() => {
    if (!currentVersion || (currentVersion.draft ?? '') === draft) return;
    const kept: NetworkingPracticeVersion = { ...currentVersion, draft };
    saveVersion(kept);
    setVersions((existing) => existing.map((item) => (item.id === kept.id ? kept : item)));
  }, [currentVersion, draft, setVersions]);

  const selectVersion = React.useCallback(
    (id: string) => {
      if (id === currentVersion?.id) return;
      const target = versions.find((item) => item.id === id);
      if (!target) return;
      keepDraftWithCurrentVersion();
      setCurrentVersionId(id);
      setDraftState(target.draft ?? '');
    },
    [currentVersion?.id, versions, keepDraftWithCurrentVersion, setCurrentVersionId]
  );

  const createNewVersion = React.useCallback(() => {
    const scenario = presetScenario ?? scenarios[0];
    if (!scenario) return;
    keepDraftWithCurrentVersion();
    // Name it automatically; the "Name this intro" field renames it inline.
    const existing = versions.filter((v) => v.scenarioId === scenario.id).length;
    const title =
      existing > 0 ? `${scenario.title} intro ${existing + 1}` : `${scenario.title} intro`;
    const nextVersion = { ...scenarioToVersion(scenario, title), draft: '' };
    saveVersion(nextVersion);
    setVersions((prev) => [nextVersion, ...prev]);
    setCurrentVersionId(nextVersion.id);
    setDraftState('');
    setStorageNotice(
      `Started "${title}" with a blank draft. Your other intro keeps its words under Saved intros.`
    );
  }, [presetScenario, versions, setVersions, setCurrentVersionId, keepDraftWithCurrentVersion]);

  const deleteCurrentVersion = React.useCallback(() => {
    if (!currentVersion) return;
    const idToDelete = currentVersion.id;
    deleteVersion(idToDelete);
    const filtered = versions.filter((v) => v.id !== idToDelete);
    const next = filtered.length ? filtered : [fallbackVersion];
    setVersions(next);
    setCurrentVersionId(next[0].id);
    // The deleted intro's words go with it; show the words of the one now open.
    setDraftState(next[0].draft ?? '');
  }, [currentVersion, versions, fallbackVersion, setVersions, setCurrentVersionId]);

  const saveCurrentSession = React.useCallback(() => {
    if (!currentVersion) return;
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      setStorageNotice(
        'Write your intro draft before saving. The history tracks your actual words, not the sample lines.'
      );
      return;
    }
    const rated = completeRatings(ratings);
    if (!rated) {
      setStorageNotice(
        `Rate the rep first. ${joinLabels(missingRatingLabels(ratings))} ${
          missingRatingLabels(ratings).length === 1 ? 'is' : 'are'
        } not rated yet.`
      );
      return;
    }
    const scenario =
      scenarios.find((item) => item.id === currentVersion.scenarioId) ?? scenarios[0];
    const session: NetworkingPracticeSession = {
      id: generateId(),
      versionId: currentVersion.id,
      scenarioId: currentVersion.scenarioId,
      scenarioTitle: scenario
        ? repTitle(scenario, currentVersion.title, currentVersion.who)
        : currentVersion.title,
      attempts: [
        {
          id: generateId(),
          label: 'Rep',
          script: trimmedDraft,
          durationSeconds: repSeconds(timer.elapsed, recordedSeconds),
          createdAt: new Date().toISOString(),
        },
      ],
      ratings: rated,
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
    markDraftChanged();
    setReflection(emptyReflection);
    setRatings(unrated);
    resetTimer();
    setRecordedSeconds(0);
    setStorageNotice(
      'Rep saved to your local history. Its next step is under "Last rep", above your draft.'
    );
  }, [
    currentVersion,
    draft,
    timer.elapsed,
    recordedSeconds,
    ratings,
    reflection,
    resetTimer,
    setSessions,
    markDraftChanged,
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
    const filename = `networking-practice-sessions-${localDate()}.json`;
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
    const success = clearSessions();
    if (!success) {
      setStorageNotice('Unable to clear history. Check storage permissions and try again.');
      return;
    }
    setSessions([]);
    setStorageNotice('Session history cleared.');
  }, [sessions, setSessions]);

  const handleRatingChange = React.useCallback((key: keyof Ratings, value: number) => {
    draftChangedRef.current = true;
    setRatings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReflectionField = React.useCallback(
    (key: keyof PracticeReflection, value: string) => {
      draftChangedRef.current = true;
      setReflection((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Recording is a way of saying the rep out loud, so it runs the clock too.
  const handleRecordingStart = React.useCallback(() => {
    if (!timer.isRunning) startTimer();
  }, [timer.isRunning, startTimer]);
  const handleRecordingStop = React.useCallback(
    (durationMs: number) => {
      pauseTimer();
      setRecordedSeconds(durationMs / 1000);
    },
    [pauseTimer]
  );

  const handleResetReview = React.useCallback(() => {
    draftChangedRef.current = true;
    setRecordedSeconds(0);
    resetTimer();
    setRatings(unrated);
    setReflection(emptyReflection);
  }, [resetTimer]);

  const missingRatings = React.useMemo(() => missingRatingLabels(ratings), [ratings]);
  const activeRepStep = repStep({
    hasDraft: draft.trim().length > 0,
    practiced: timer.elapsed > 0 || recordedSeconds > 0,
    rated: missingRatings.length === 0,
  });

  const sessionsAtCapacity = sessions.length >= SESSION_LIMIT;

  return {
    scenarios,
    studentLike,
    fromApplication,
    focusedApplication,
    activeRepStep,
    recordedSeconds,
    handleRecordingStart,
    handleRecordingStop,
    versions,
    sessions,
    storageNotice,
    currentVersionId,
    setCurrentVersionId: selectVersion,
    timer,
    ratings,
    missingRatings,
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
    setTimerLength: pinTimerLength,
    saveCurrentSession,
    removeSession,
    exportSessions,
    clearSessionHistory,
    handleRatingChange,
    handleReflectionField,
    handleResetReview,
  };
}
