import * as React from 'react';
import scenarioData from '../../data/networking-scenarios.json';
import {
  deleteSession,
  deleteVersion,
  clearSessions,
  generateId,
  loadSessions,
  loadVersions,
  SESSION_LIMIT,
  saveSession,
  saveVersion,
} from '../../utils/storage';
import type {
  NetworkingPracticeSession,
  NetworkingPracticeVersion,
  PracticeReflection,
} from '../../utils/storage';
import { useTimer } from './useTimer';
import { useClipboard } from './useClipboard';

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
    [scenarios]
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
  const [reflection, setReflection] = React.useState<PracticeReflection>(emptyReflection);
  const [draft, setDraftState] = React.useState('');

  const { timer, resetTimer, startTimer, pauseTimer } = useTimer();
  const { copiedKey, handleCopy } = useClipboard();

  const currentVersion = React.useMemo(
    () => versions.find((v) => v.id === currentVersionId) ?? versions[0],
    [currentVersionId, versions]
  );
  const currentScenario = React.useMemo(
    () => scenarios.find((s) => s.id === currentVersion?.scenarioId),
    [currentVersion?.scenarioId, scenarios]
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
      const updated: NetworkingPracticeVersion = {
        ...currentVersion,
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
    [currentVersion, scenarios, setVersions]
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
    const title = window.prompt('Name this practice version', `${scenario.title} Intro`);
    if (!title) return;
    const nextVersion = scenarioToVersion(scenario, title);
    saveVersion(nextVersion);
    setVersions((prev) => [nextVersion, ...prev]);
    setCurrentVersionId(nextVersion.id);
  }, [currentScenario, scenarios, setVersions]);

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
    setStorageNotice('Session saved to your local history. Your draft stays for the next rep.');
  }, [currentVersion, scenarios, draft, timer.elapsed, ratings, reflection, setSessions]);

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
