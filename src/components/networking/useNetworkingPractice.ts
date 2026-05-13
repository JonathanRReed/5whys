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
import type { NetworkingPracticeSession, NetworkingPracticeVersion } from '../../utils/storage';
import { useTimer } from './useTimer';
import { useClipboard } from './useClipboard';

export type Scenario = (typeof scenarioData)[number];

export type Ratings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

const TOTAL_SECONDS = 120;
const defaultRatings: Ratings = { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 };
const NOTICE_RESET_MS = 3500;

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

export function useNetworkingPractice() {
  const scenarios: Scenario[] = scenarioData;
  const fallbackVersion = React.useMemo(
    () =>
      scenarioToVersion(
        scenarios[0] ?? {
          id: 'default',
          title: 'Default Scenario',
          who: 'You + Guest',
          where: 'Networking Event',
          what: ['Introduce yourself', 'Share goal', 'Ask a question'],
        }
      ),
    [scenarios]
  );

  const loadVersionsFromStorage = React.useCallback(() => {
    const existing = loadVersions();
    return existing.length ? existing : [fallbackVersion];
  }, [fallbackVersion]);

  const [versions, setVersions] = useHydratedState<NetworkingPracticeVersion[]>([fallbackVersion], loadVersionsFromStorage);
  const [sessions, setSessions] = useHydratedState<NetworkingPracticeSession[]>([], loadSessions);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = React.useState<string>(fallbackVersion.id);
  const [ratings, setRatings] = React.useState<Ratings>(defaultRatings);
  const [reflection, setReflection] = React.useState('');

  const { timer, resetTimer, startTimer, pauseTimer } = useTimer();
  const { copiedKey, handleCopy } = useClipboard();

  const currentVersion = React.useMemo(
    () => versions.find((v) => v.id === currentVersionId) ?? versions[0],
    [currentVersionId, versions]
  );
  const currentScenario = React.useMemo(
    () => scenarios.find((s) => s.id === currentVersion?.scenarioId) ?? scenarios[0],
    [currentVersion?.scenarioId, scenarios]
  );
  const scenarioSteps = currentScenario?.what ?? [];
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
    [currentVersion, scenarios]
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
    [currentVersion]
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
  }, [currentScenario, scenarios]);

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
  }, [currentVersion, currentVersionId, fallbackVersion]);

  const saveCurrentSession = React.useCallback(() => {
    if (!currentVersion) return;
    const scenario = scenarios.find((item) => item.id === currentVersion.scenarioId) ?? scenarios[0];
    const session: NetworkingPracticeSession = {
      id: generateId(),
      versionId: currentVersion.id,
      scenarioId: currentVersion.scenarioId,
      scenarioTitle: scenario?.title ?? currentVersion.title,
      attempts: [
        {
          id: generateId(),
          label: 'Round 1',
          script: currentVersion.what,
          durationSeconds: TOTAL_SECONDS - timer.remaining,
          createdAt: new Date().toISOString(),
        },
      ],
      ratings,
      reflection: {
        humanNote: reflection,
        nervesNote: '',
        nextFocus: '',
        wins: '',
      },
      createdAt: new Date().toISOString(),
    };
    const success = saveSession(session);
    if (!success) {
      setStorageNotice('Browser storage is full. Export or clear past sessions to keep saving.');
      return;
    }
    setSessions((prev) => [session, ...prev].slice(0, SESSION_LIMIT));
    setReflection('');
    setStorageNotice('Session saved to your local history.');
  }, [currentVersion, scenarios, timer.remaining, ratings, reflection]);

  const removeSession = React.useCallback((id: string) => {
    const success = deleteSession(id);
    if (!success) {
      setStorageNotice('Unable to update session history. Check storage permissions and try again.');
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const exportSessions = React.useCallback(() => {
    if (sessions.length === 0) {
      setStorageNotice('No sessions to export yet. Record a practice round first.');
      return;
    }
    const filename = `networking-practice-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json;charset=utf-8' });
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
  }, [sessions]);

  const handleRatingChange = React.useCallback((key: keyof Ratings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetReview = React.useCallback(() => {
    resetTimer();
    setRatings(defaultRatings);
    setReflection('');
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
    setReflection,
    copiedKey,
    currentVersion,
    currentScenario,
    scenarioSteps,
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
    handleResetReview,
  };
}
