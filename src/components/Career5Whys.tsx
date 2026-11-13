import * as React from 'react';
import { loadFeature, reportFeatureFailure } from '../lib/lazy-feature';
import { localDate } from '../lib/local-date';
import { readProfile } from '../lib/profile';
import { cn } from '../lib/utils';
import CareerHeader from './career-5whys/CareerHeader';
import ExportActions from './career-5whys/ExportActions';
import HistoryPanel from './career-5whys/HistoryPanel';
import {
  buildPrompts,
  type Career5WhysProps,
  createEmptySession,
  cryptoRandom,
  DEFAULT_HISTORY_LIMIT,
  downloadJson,
  ensureResponsesLength,
  HISTORY_KEY,
  HISTORY_LIMIT_KEY,
  HISTORY_LIMIT_OPTIONS,
  isBrowser,
  type Register,
  readStoredHistory,
  sameSnapshot,
  TRACKS,
  toSlug,
  trackSamples,
  useStoredSession,
  useSynthesis,
  type WhySnapshot,
} from './career-5whys/shared';
import WhyForm from './career-5whys/WhyForm';
import WhyStepper from './career-5whys/WhyStepper';
import WhySummary from './career-5whys/WhySummary';

export default function Career5Whys({
  showHeader = true,
  showFooter = true,
  className,
}: Career5WhysProps) {
  const { session, setSession, storageNotice } = useStoredSession();
  const [exampleOpen, setExampleOpen] = React.useState<Record<number, boolean>>({});
  const [status, setStatus] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<WhySnapshot[]>([]);
  const [historyLimit, setHistoryLimit] = React.useState<number>(DEFAULT_HISTORY_LIMIT);
  // Samples speak to students unless a saved profile says otherwise.
  const [register, setRegister] = React.useState<Register>('student');
  React.useEffect(() => {
    const profile = readProfile();
    if (profile && profile.stage !== 'student' && profile.stage !== 'early') {
      setRegister('professional');
    }
  }, []);
  const samples = trackSamples(session.track, register);

  // Offer model-written follow-ups only when the browser already has its own
  // model. This check never downloads anything.
  const [modelReady, setModelReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    void loadFeature(import('../lib/local-ai'))
      .then(async ({ getBrowserModelCapability }) => {
        const capability = await getBrowserModelCapability();
        if (!cancelled) setModelReady(capability.state === 'available');
      })
      .catch(reportFeatureFailure);
    return () => {
      cancelled = true;
    };
  }, []);
  const historyIsFull = history.length >= historyLimit;
  const {
    surface,
    root,
    chain,
    sequentialCount,
    progressPercent,
    isComplete,
    whyStatement,
    nextStep,
  } = useSynthesis(session.responses, session.topic, session.track, session.rootIndex);
  const prompts = React.useMemo(
    () => buildPrompts(session.track, session.topic, session.responses),
    [session.track, session.topic, session.responses]
  );

  const persistHistory = React.useCallback((entries: WhySnapshot[]) => {
    if (!isBrowser()) return true;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
      return true;
    } catch (err) {
      console.warn('Unable to persist why snapshot history', err);
      setStatus('Storage is full. Manage or export snapshots to continue saving.');
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (!storageNotice) return;
    setStatus(storageNotice);
  }, [storageNotice]);

  // Read the history and its limit together, so a saved limit of 24 is in
  // place before anything compares the history against it.
  React.useEffect(() => {
    if (!isBrowser()) return;
    try {
      const savedLimit = Number(window.localStorage.getItem(HISTORY_LIMIT_KEY));
      if (HISTORY_LIMIT_OPTIONS.includes(savedLimit as (typeof HISTORY_LIMIT_OPTIONS)[number])) {
        setHistoryLimit(savedLimit);
      }
    } catch (err) {
      console.warn('Unable to load snapshot preference', err);
    }
    const stored = readStoredHistory();
    if (stored === null) {
      setStatus('Unable to load snapshot history.');
      return;
    }
    setHistory(stored);
  }, []);

  // Another tab may save or delete snapshots. Show what is stored now, so
  // this tab never works from (or writes back) a stale list.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== HISTORY_KEY) return;
      const stored = readStoredHistory();
      if (stored) setHistory(stored);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The limit is written, and the history trimmed to it, only when the
  // visitor picks a limit. Doing either on load would write to a fresh
  // profile, and could trim a longer saved history before its limit loaded.
  // The trim works on the history as stored now, so snapshots saved in
  // another tab are not lost.
  const handleLimitChange = (limit: number) => {
    setHistoryLimit(limit);
    if (isBrowser()) {
      try {
        window.localStorage.setItem(HISTORY_LIMIT_KEY, String(limit));
      } catch (err) {
        console.warn('Unable to persist snapshot limit preference', err);
      }
    }
    const latest = readStoredHistory() ?? history;
    if (latest.length <= limit) {
      setHistory(latest);
      return;
    }
    const trimmed = latest.slice(0, limit);
    if (persistHistory(trimmed)) setHistory(trimmed);
  };

  React.useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const updateSession = React.useCallback(
    (partial: Partial<typeof session>) => {
      setSession((prev) => ({ ...prev, ...partial, updatedAt: new Date().toISOString() }));
    },
    [setSession]
  );

  const handleResponseChange = (index: number, value: string) => {
    const nextResponses = session.responses.map((response, i) => (i === index ? value : response));
    updateSession({ responses: nextResponses });
  };

  const handleSaveSnapshot = () => {
    if (!isBrowser()) return;
    // Every snapshot gets its own id, so deleting one never takes the other
    // snapshots of the same session with it.
    const payload: WhySnapshot = {
      id: `snapshot_${cryptoRandom()}${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      whyStatement,
      rootReason: root,
      nextStep,
      track: session.track,
      topic: session.topic,
      responses: [...session.responses],
      ...(session.rootIndex !== undefined ? { rootIndex: session.rootIndex } : {}),
      updatedAt: session.updatedAt,
      version: 3,
    };
    // Start from what is stored now: another tab may have saved since this
    // page loaded.
    const latest = readStoredHistory() ?? history;
    const nextHistory = [payload, ...latest].slice(0, historyLimit);
    if (persistHistory(nextHistory)) {
      setHistory(nextHistory);
      setStatus('Saved to local dashboard');
    }
  };

  const handleExport = () => {
    const exportPayload = {
      ...session,
      whyStatement,
      surfaceReason: surface,
      rootReason: root,
      chain,
      nextStep,
      createdAt: new Date().toISOString(),
    };
    const topicSlug = toSlug(session.topic || TRACKS[session.track].label) || session.track;
    downloadJson(`career-why-${topicSlug}-${localDate()}.json`, exportPayload);
    setStatus('Export ready. Check your downloads.');
  };

  const handleExportSnapshot = (snapshot: WhySnapshot) => {
    const topicSlug = toSlug(snapshot.topic || TRACKS[snapshot.track].label) || snapshot.track;
    downloadJson(
      `career-why-snapshot-${topicSlug}-${snapshot.timestamp.slice(0, 10)}.json`,
      snapshot
    );
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
      setStatus('No snapshots to export yet.');
      return;
    }
    downloadJson(`career-why-history-${localDate()}.json`, history);
    setStatus('History exported.');
  };

  const handleDeleteSnapshot = (snapshot: WhySnapshot) => {
    // Older snapshots of one session can share an id; the time tells them apart.
    const latest = readStoredHistory() ?? history;
    const nextHistory = latest.filter((entry) => !sameSnapshot(entry, snapshot));
    if (persistHistory(nextHistory)) {
      setHistory(nextHistory);
      setStatus('Snapshot removed.');
    }
  };

  const handleClearHistory = () => {
    if (history.length === 0) return;
    if (persistHistory([])) {
      setHistory([]);
      setStatus('Snapshot history cleared.');
    }
  };

  const handleRestoreSnapshot = (snapshot: WhySnapshot) => {
    const restored = createEmptySession(snapshot.track);
    setSession({
      ...restored,
      topic: snapshot.topic,
      responses: ensureResponsesLength(snapshot.responses),
      ...(snapshot.rootIndex !== undefined ? { rootIndex: snapshot.rootIndex } : {}),
      updatedAt: new Date().toISOString(),
    });
    setExampleOpen({});
    setStatus('Snapshot loaded into the editor.');
  };

  const handleReset = () => {
    updateSession(createEmptySession(session.track));
    setExampleOpen({});
    setStatus('Session cleared.');
  };

  // Changing the lens keeps what the visitor wrote; only the questions
  // change. Pressing the track already chosen does nothing. "Reset session"
  // is the one control that clears the work.
  const handleTrackChange = (track: 'career' | 'interest') => {
    if (track === session.track) return;
    setExampleOpen({});
    updateSession({ track });
    if (session.topic.trim() || session.responses.some((response) => response.trim())) {
      setStatus(`Switched to ${TRACKS[track].label}. Your answers are kept.`);
    }
  };

  return (
    <div className={cn('relative text-foreground', className)}>
      <div className={cn('mx-auto w-full max-w-6xl space-y-8 px-4 py-8', !showHeader && 'py-6')}>
        <CareerHeader
          showHeader={showHeader}
          track={session.track}
          topic={session.topic}
          sequentialCount={sequentialCount}
          progressPercent={progressPercent}
          onTrackChange={handleTrackChange}
          onTopicChange={(topic) => updateSession({ topic })}
          topicPlaceholder={samples.topicPlaceholder}
        />
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {status ? status : ''}
        </div>
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* On phones the questions come first; the tracker and logic tree repeat
              what the form already shows, so they only appear beside it on wide screens. */}
          <div className="hidden space-y-6 lg:block">
            <WhyStepper responses={session.responses} sequentialCount={sequentialCount} />
          </div>
          <div className="space-y-6">
            <WhyForm
              responses={session.responses}
              sequentialCount={sequentialCount}
              prompts={prompts}
              example={samples.example}
              exampleOpen={exampleOpen}
              sharper={modelReady ? { track: session.track, topic: session.topic } : undefined}
              onResponseChange={handleResponseChange}
              onToggleExample={(index) =>
                setExampleOpen((prev) => ({ ...prev, [index]: !prev[index] }))
              }
            />
            <WhySummary
              whyStatement={whyStatement}
              chain={chain}
              isComplete={isComplete}
              sequentialCount={sequentialCount}
              nextStep={nextStep}
              answers={session.responses}
              rootIndex={session.rootIndex}
              onRootChange={(rootIndex) =>
                setSession((previous) => ({
                  ...previous,
                  rootIndex,
                  updatedAt: new Date().toISOString(),
                }))
              }
            >
              <ExportActions
                onSaveSnapshot={handleSaveSnapshot}
                onExport={handleExport}
                onReset={handleReset}
                hasWork={!!session.topic.trim() || session.responses.some((r) => r.trim())}
                canExport={sequentialCount >= 4}
                status={status}
              />
            </WhySummary>
            <HistoryPanel
              history={history}
              historyLimit={historyLimit}
              historyIsFull={historyIsFull}
              onLimitChange={handleLimitChange}
              onExportHistory={handleExportHistory}
              onClearHistory={handleClearHistory}
              onRestoreSnapshot={handleRestoreSnapshot}
              onExportSnapshot={handleExportSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
            />
          </div>
        </div>
        {showFooter && (
          <footer className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
            <p>Insight is cumulative. Revisit your entries whenever your path evolves.</p>
          </footer>
        )}
      </div>
    </div>
  );
}
