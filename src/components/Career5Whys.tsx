import * as React from 'react';
import { cn } from '../lib/utils';
import {
  WHY_COUNT,
  TRACKS,
  HISTORY_KEY,
  HISTORY_LIMIT_KEY,
  HISTORY_LIMIT_OPTIONS,
  DEFAULT_HISTORY_LIMIT,
  createEmptySession,
  isBrowser,
  ensureResponsesLength,
  toSlug,
  downloadJson,
  normalizeSnapshot,
  useStoredSession,
  useSynthesis,
  type WhySnapshot,
  type Career5WhysProps,
} from './career-5whys/shared';
import CareerHeader from './career-5whys/CareerHeader';
import WhyStepper from './career-5whys/WhyStepper';
import WhyForm from './career-5whys/WhyForm';
import WhySummary from './career-5whys/WhySummary';
import ExportActions from './career-5whys/ExportActions';
import HistoryPanel from './career-5whys/HistoryPanel';

export default function Career5Whys({ showHeader = true, showFooter = true, className }: Career5WhysProps) {
  const { session, setSession, storageNotice } = useStoredSession();
  const [hintOpen, setHintOpen] = React.useState<Record<number, boolean>>({});
  const [status, setStatus] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<WhySnapshot[]>([]);
  const [historyLimit, setHistoryLimit] = React.useState<number>(DEFAULT_HISTORY_LIMIT);
  const activeTrack = TRACKS[session.track];
  const historyIsFull = history.length >= historyLimit;
  const {
    theme: synthesizedTheme,
    alignment: synthesizedAlignment,
    sequentialCount,
    sequentialConfidence,
  } = useSynthesis(session.responses, session.topic, session.track);
  const progressPercent = Math.round((sequentialCount / WHY_COUNT) * 100);
  const derivedTheme = session.theme.trim() || synthesizedTheme;
  const derivedAlignment = session.alignment.trim() || synthesizedAlignment;
  const t = session.track;
  const themeText = derivedTheme.trim();
  const alignText = derivedAlignment.trim();
  const topicText = session.topic.trim();
  const whyStatement =
    t === 'career'
      ? `You're pursuing ${topicText || 'this path'} because it aligns with ${alignText || 'what matters to you'} you're driven by ${themeText || 'a clear theme you are uncovering'}.`
      : `You're motivated by ${themeText || 'this interest'} because it aligns with ${alignText || 'your values'} in the context of ${topicText || 'your core interest'}.`;

  const persistHistory = React.useCallback(
    (entries: WhySnapshot[]) => {
      if (!isBrowser()) return true;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
        return true;
      } catch (err) {
        console.warn('Unable to persist why snapshot history', err);
        setStatus('Storage is full-manage or export snapshots to continue saving.');
        return false;
      }
    },
    [setStatus]
  );

  React.useEffect(() => {
    if (!storageNotice) return;
    setStatus(storageNotice);
  }, [storageNotice]);

  React.useEffect(() => {
    if (!isBrowser()) return;
    try {
      const savedLimit = window.localStorage.getItem(HISTORY_LIMIT_KEY);
      if (!savedLimit) return;
      const parsed = Number(savedLimit);
      if (HISTORY_LIMIT_OPTIONS.includes(parsed as (typeof HISTORY_LIMIT_OPTIONS)[number])) {
        setHistoryLimit(parsed);
      }
    } catch (err) {
      console.warn('Unable to load snapshot preference', err);
    }
  }, []);

  React.useEffect(() => {
    if (!isBrowser()) return;
    try {
      const stored = window.localStorage.getItem(HISTORY_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map((entry) => normalizeSnapshot(entry)).filter(Boolean) as WhySnapshot[];
      setHistory(normalized);
    } catch (err) {
      console.warn('Unable to load why snapshot history', err);
      setHistory([]);
      setStatus('Unable to load snapshot history.');
    }
  }, []);

  React.useEffect(() => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(HISTORY_LIMIT_KEY, String(historyLimit));
    } catch (err) {
      console.warn('Unable to persist snapshot limit preference', err);
    }
  }, [historyLimit]);

  React.useEffect(() => {
    setHistory((previous) => {
      if (previous.length <= historyLimit) return previous;
      const trimmed = previous.slice(0, historyLimit);
      persistHistory(trimmed);
      return trimmed;
    });
  }, [historyLimit, persistHistory]);

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
    const payload: WhySnapshot = {
      id: session.id,
      userId: 'local-user',
      timestamp: new Date().toISOString(),
      whyStatement,
      track: session.track,
      topic: session.topic,
      responses: [...session.responses],
      theme: session.theme,
      alignment: session.alignment,
      updatedAt: session.updatedAt,
      version: 1,
    };
    const nextHistory = [payload, ...history].slice(0, historyLimit);
    if (persistHistory(nextHistory)) {
      setHistory(nextHistory);
      setStatus('Saved to local dashboard');
    }
  };

  const handleExport = () => {
    const exportPayload = { ...session, whyStatement, createdAt: new Date().toISOString() };
    const topicSlug = toSlug(session.topic || TRACKS[session.track].label) || session.track;
    downloadJson(`career-why-${topicSlug}-${new Date().toISOString().slice(0, 10)}.json`, exportPayload);
    setStatus('Export ready. Check your downloads.');
  };

  const handleExportSnapshot = (snapshot: WhySnapshot) => {
    const topicSlug = toSlug(snapshot.topic || TRACKS[snapshot.track].label) || snapshot.track;
    downloadJson(`career-why-snapshot-${topicSlug}-${snapshot.timestamp.slice(0, 10)}.json`, snapshot);
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
      setStatus('No snapshots to export yet.');
      return;
    }
    downloadJson(`career-why-history-${new Date().toISOString().slice(0, 10)}.json`, history);
    setStatus('History exported.');
  };

  const handleDeleteSnapshot = (id: string) => {
    const nextHistory = history.filter((entry) => entry.id !== id);
    if (persistHistory(nextHistory)) {
      setHistory(nextHistory);
      setStatus('Snapshot removed.');
    }
  };

  const handleClearHistory = () => {
    if (history.length === 0) return;
    if (!window.confirm('Clear all saved snapshots from this device?')) return;
    if (persistHistory([])) {
      setHistory([]);
      setStatus('Snapshot history cleared.');
    }
  };

  const handleRestoreSnapshot = (snapshot: WhySnapshot) => {
    const restored = createEmptySession(snapshot.track);
    setSession({
      ...restored,
      id: snapshot.id,
      topic: snapshot.topic,
      responses: ensureResponsesLength(snapshot.responses),
      theme: snapshot.theme,
      alignment: snapshot.alignment,
      updatedAt: new Date().toISOString(),
    });
    setHintOpen({});
    setStatus('Snapshot loaded into the editor.');
  };

  const handleReset = () => updateSession(createEmptySession(session.track));

  const handleTrackChange = (track: 'career' | 'interest') => {
    setHintOpen({});
    updateSession(createEmptySession(track));
  };

  return (
    <div className={cn('relative text-[hsl(var(--foreground))]', className)}>
      <div className={cn('mx-auto w-full max-w-6xl space-y-8 px-4 py-8', !showHeader && 'py-6')}>
        <CareerHeader
          showHeader={showHeader}
          track={session.track}
          topic={session.topic}
          sequentialCount={sequentialCount}
          progressPercent={progressPercent}
          onTrackChange={handleTrackChange}
          onTopicChange={(topic) => updateSession({ topic })}
        />
        <div className="grid gap-8 lg:grid-cols-[320px,minmax(0,1fr)]">
          <div className="space-y-6">
            <WhyStepper responses={session.responses} sequentialCount={sequentialCount} />
          </div>
          <div className="space-y-6">
            <WhyForm
              responses={session.responses}
              sequentialCount={sequentialCount}
              prompts={activeTrack.prompts}
              hints={activeTrack.hints}
              hintOpen={hintOpen}
              onResponseChange={handleResponseChange}
              onToggleHint={(index) => setHintOpen((prev) => ({ ...prev, [index]: !prev[index] }))}
            />
            <WhySummary
              whyStatement={whyStatement}
              sequentialConfidence={sequentialConfidence}
              theme={session.theme}
              alignment={session.alignment}
              derivedTheme={derivedTheme}
              derivedAlignment={derivedAlignment}
              onThemeChange={(theme) => updateSession({ theme })}
              onAlignmentChange={(alignment) => updateSession({ alignment })}
            >
              <ExportActions
                onSaveSnapshot={handleSaveSnapshot}
                onExport={handleExport}
                onReset={handleReset}
                canExport={sequentialCount >= 4}
                status={status}
              />
            </WhySummary>
            <HistoryPanel
              history={history}
              historyLimit={historyLimit}
              historyIsFull={historyIsFull}
              onLimitChange={setHistoryLimit}
              onExportHistory={handleExportHistory}
              onClearHistory={handleClearHistory}
              onRestoreSnapshot={handleRestoreSnapshot}
              onExportSnapshot={handleExportSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
            />
          </div>
        </div>
        {showFooter && (
          <footer className="border-t border-[hsl(var(--border)/0.5)] pt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>Insight is cumulative. Revisit your entries whenever your path evolves.</p>
          </footer>
        )}
      </div>
    </div>
  );
}
