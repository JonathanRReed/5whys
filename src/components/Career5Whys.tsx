import * as React from 'react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import QuickStartTiles from './QuickStartTiles';
import { cn } from '../lib/utils';

const WHY_COUNT = 5;
const SESSION_KEY = 'career-why-session-v2';
const HISTORY_KEY = 'career-why-history';
const HISTORY_LIMIT_KEY = 'career-why-history-limit';
const HISTORY_LIMIT_OPTIONS = [6, 12, 24] as const;
const DEFAULT_HISTORY_LIMIT = 12;

type Career5WhysProps = {
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
};

const TRACKS = {
  career: {
    label: 'Career Path',
    description: 'Use this when you already have a target role or industry in mind.',
    topicLabel: 'Target role / path',
    topicPlaceholder: 'e.g., Senior UX Researcher, Product Ops Lead',
    prompts: [
      'What about this role is currently motivating you?',
      'Why does that motivation matter for the work you want to do?',
      'What changes for other people when you succeed at this role?',
      'Why is that impact personally significant to you?',
      'What is the underlying principle or value you refuse to compromise?',
    ],
    hints: [
      'Anchor on the most tangible pull: problems, responsibilities, or environment.',
      'Tie the previous answer to something you care about mastering or improving.',
      'Think about users, teams, or systems that benefit when you do this well.',
      'Connect the external change to an internal driver (curiosity, autonomy, rigor).',
      'Name the guiding principle that shows up even outside of work.',
    ],
  },
  interest: {
    label: 'Interest Path',
    description: 'Use this route when you are still mapping interests into possible careers.',
    topicLabel: 'Core interest or theme',
    topicPlaceholder: 'e.g., Urban mobility, ethical AI, adaptive learning',
    prompts: [
      'Which pattern or topic keeps surfacing in your work or curiosity?',
      'Why does it hold your attention when many other things do not?',
      'Who benefits if this interest becomes a project or product?',
      'Why do you feel responsible for pushing that benefit forward?',
      'What identity or value are you ultimately protecting or proving?',
    ],
    hints: [
      'Capture the motif, not the job title. Think domains or problems.',
      'Reference formative moments, frustrations, or obsessions.',
      'Consider communities, audiences, or even your future self.',
      'Focus on agency: why do you believe you should move first?',
      'What theme shows up in your decisions regardless of context?',
    ],
  },
} as const;

type Track = keyof typeof TRACKS;

type WhySnapshot = {
  id: string;
  timestamp: string;
  whyStatement: string;
  track: Track;
  topic: string;
  responses: string[];
  theme: string;
  alignment: string;
  updatedAt: string;
  version: number;
  userId?: string;
};

type Session = {
  id: string;
  track: Track;
  topic: string;
  responses: string[];
  theme: string;
  alignment: string;
  updatedAt: string;
};

const createEmptySession = (track: Track = 'career'): Session => ({
  id: `whySession_${cryptoRandom()}`,
  track,
  topic: '',
  responses: Array(WHY_COUNT).fill(''),
  theme: '',
  alignment: '',
  updatedAt: new Date().toISOString(),
});

function cryptoRandom() {
  if (typeof window === 'undefined' || !window.crypto?.randomUUID) {
    return Date.now().toString(36);
  }
  return window.crypto.randomUUID().split('-')[0];
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function ensureResponsesLength(responses: unknown): string[] {
  const sanitized = Array.isArray(responses)
    ? responses.map((response) => (typeof response === 'string' ? response : '')).slice(0, WHY_COUNT)
    : [];
  while (sanitized.length < WHY_COUNT) {
    sanitized.push('');
  }
  return sanitized;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSnapshotTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizeSnapshot(entry: unknown): WhySnapshot | null {
  if (!entry || typeof entry !== 'object') return null;
  const data = entry as Record<string, unknown>;
  const track = data.track === 'career' || data.track === 'interest' ? (data.track as Track) : 'career';
  return {
    id: typeof data.id === 'string' ? data.id : `snapshot_${cryptoRandom()}`,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    whyStatement: typeof data.whyStatement === 'string' ? data.whyStatement : '',
    track,
    topic: typeof data.topic === 'string' ? data.topic : '',
    responses: ensureResponsesLength((data.responses as unknown) ?? []),
    theme: typeof data.theme === 'string' ? data.theme : '',
    alignment: typeof data.alignment === 'string' ? data.alignment : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    version: typeof data.version === 'number' ? data.version : 1,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
  } satisfies WhySnapshot;
}

function useStoredSession() {
  const [session, setSession] = React.useState<Session>(() => createEmptySession());
  const [mounted, setMounted] = React.useState(false);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!isBrowser()) return;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const fallback = createEmptySession();
        const parsed = JSON.parse(stored) as Session;
        setSession({ ...fallback, ...parsed });
      }
    } catch (err) {
      console.warn('Unable to load saved 5 Whys session', err);
      setStorageNotice('Previous progress could not be restored from storage.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!mounted || !isBrowser()) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Unable to persist 5 Whys session', err);
      setStorageNotice('Auto-save is paused because browser storage is unavailable.');
    }
  }, [session, mounted]);

  return { session, setSession, storageNotice } as const;
}

export default function Career5Whys({ showHeader = true, showFooter = true, className }: Career5WhysProps) {
  const { session, setSession, storageNotice } = useStoredSession();
  const [hintOpen, setHintOpen] = React.useState<Record<number, boolean>>({});
  const [status, setStatus] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<WhySnapshot[]>([]);
  const [historyLimit, setHistoryLimit] = React.useState<number>(DEFAULT_HISTORY_LIMIT);

  const totalFilled = session.responses.filter((response) => response.trim().length > 0).length;
  const firstEmptyIndex = session.responses.findIndex((r) => r.trim().length === 0);
  const sequentialCount = firstEmptyIndex === -1 ? WHY_COUNT : firstEmptyIndex;
  const progressPercent = Math.round((sequentialCount / WHY_COUNT) * 100);
  const activeTrack = TRACKS[session.track];

  const persistHistory = React.useCallback(
    (entries: WhySnapshot[]) => {
      if (!isBrowser()) return true;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
        return true;
      } catch (err) {
        console.warn('Unable to persist why snapshot history', err);
        setStatus('Storage is full—manage or export snapshots to continue saving.');
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

  // Lightweight keyword synthesis to consider ALL steps
  const STOPWORDS = React.useMemo(
    () =>
      new Set([
        'the','and','for','with','that','this','from','into','your','you','are','our','was','were','will','would','could','should','about','when','what','how','why','who','whom','to','of','in','on','at','by','as','it','its','is','be','an','a','or','but','if','than','then','so','we','i','me','my','mine','their','theirs','them','they','us','we','do','did','done','doing','because'
      ]),
    []
  );

  const extractKeywords = React.useCallback(
    (text: string, max = 5) => {
      const counts = new Map<string, number>();
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
        .forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([w]) => w);
    },
    [STOPWORDS]
  );

  const computeSynthesis = React.useCallback(
    (responses: string[], topic: string, track: Track) => {
      const cleaned = responses.map((r) => r.trim()).filter(Boolean);
      const coverage = Math.min(100, Math.round((cleaned.length / WHY_COUNT) * 100));

      // If no answers yet, do not manufacture theme/alignment from topic for both sides
      if (cleaned.length === 0) {
        return { theme: '', alignment: '', confidence: coverage } as const;
      }

      const mid = Math.max(1, Math.floor(cleaned.length / 2));
      const early = cleaned.slice(0, mid).join(' ');
      const late = cleaned.slice(mid).join(' ');
      const lateKeys = extractKeywords(late, 3);
      const earlyKeys = extractKeywords(early, 3);
      const title = (arr: string[]) => arr.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

      // Defaults from responses, not topic
      let theme = title(lateKeys) || cleaned[cleaned.length - 1] || '';
      let alignment = title(earlyKeys) || cleaned[0] || '';

      // Track-specific topic fallback (only for one side to avoid identical outputs)
      if (!theme && track === 'interest') theme = topic || theme;
      if (!alignment && track === 'career') alignment = topic || alignment;

      return { theme, alignment, confidence: coverage } as const;
    },
    [extractKeywords]
  );

  const synthesized = computeSynthesis(session.responses, session.topic, session.track);
  const sequentialConfidence = Math.round((sequentialCount / WHY_COUNT) * 100);

  const derivedTheme = session.theme.trim() || synthesized.theme;
  const derivedAlignment = session.alignment.trim() || synthesized.alignment;

  const t = session.track;
  const themeText = derivedTheme.trim();
  const alignText = derivedAlignment.trim();
  const topicText = session.topic.trim();
  const whyStatement =
    t === 'career'
      ? `You’re pursuing ${topicText || 'this path'} because it aligns with ${alignText || 'what matters to you'} — driven by ${themeText || 'a clear theme you are uncovering'}.`
      : `You’re motivated by ${themeText || 'this interest'} because it aligns with ${alignText || 'your values'} in the context of ${topicText || 'your core interest'}.`;

  React.useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const updateSession = React.useCallback(
    (partial: Partial<Session>) => {
      setSession((prev) => ({
        ...prev,
        ...partial,
        updatedAt: new Date().toISOString(),
      }));
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
    const exportPayload = {
      ...session,
      whyStatement,
      createdAt: new Date().toISOString(),
    };
    const topicSlug = toSlug(session.topic || TRACKS[session.track].label) || session.track;
    const filename = `career-why-${topicSlug}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(filename, exportPayload);
    setStatus('Export ready. Check your downloads.');
  };

  const handleExportSnapshot = (snapshot: WhySnapshot) => {
    const topicSlug = toSlug(snapshot.topic || TRACKS[snapshot.track].label) || snapshot.track;
    const filename = `career-why-snapshot-${topicSlug}-${snapshot.timestamp.slice(0, 10)}.json`;
    downloadJson(filename, snapshot);
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
      setStatus('No snapshots to export yet.');
      return;
    }
    const filename = `career-why-history-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(filename, history);
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

  const historyIsFull = history.length >= historyLimit;

  return (
    <div className={cn('relative text-[hsl(var(--foreground))]', className)}>
      <div className={cn('mx-auto w-full max-w-6xl space-y-10 px-4 py-12', !showHeader && 'pt-6')}>
        {showHeader && (
          <header className="space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--foam))]">Career Lab</p>
            <h1 className="text-4xl font-semibold">Discover Your Why</h1>
            <p className="mx-auto max-w-2xl text-[hsl(var(--muted-foreground))]">
              Guided reasoning for uncovering the motivation behind your next career move. Choose a track, document five
              layers of reasoning, and leave with a statement you can reuse across resume, interview, and networking prep.
            </p>
            <QuickStartTiles
              className="max-w-4xl"
              items={[
                {
                  title: 'Pick your lens',
                  body: 'Select “Career” when you’re validating a defined role, or “Interest” when you’re still exploring themes.'
                },
                {
                  title: 'Answer sequentially',
                  body: 'Move down the prompts in order—the sidebar tracks depth so you can spot gaps quickly.'
                },
                {
                  title: 'Save or export',
                  body: 'Capture snapshots as you go, then export a JSON bundle once you land on language that resonates.'
                }
              ]}
            />
          </header>
        )}

        <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur-md shadow-[0_20px_80px_hsl(var(--background)/0.35)]">
          <CardHeader className="space-y-6">
              <div>
                <CardTitle className="text-2xl font-semibold">Select your track</CardTitle>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  The prompts adapt to how defined your path currently is.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                {Object.entries(TRACKS).map(([key, config]) => {
                  const isActive = session.track === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setHintOpen({});
                        updateSession(createEmptySession(key as Track));
                      }}
                      className={cn(
                        'flex-1 rounded-2xl border px-4 py-5 text-left transition-all',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--primary))]',
                        isActive
                          ? 'border-[hsl(var(--primary)/0.8)] bg-[hsl(var(--primary)/0.1)] shadow-inner text-[hsl(var(--primary-foreground))]'
                          : 'border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--border)/0.7)]'
                      )}
                    >
                      <p className="text-sm font-semibold">{config.label}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{config.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                    {activeTrack.topicLabel}
                  </Label>
                  <Input
                    value={session.topic}
                    onChange={(event) => updateSession({ topic: event.target.value })}
                    placeholder={activeTrack.topicPlaceholder}
                    className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Progress</Label>
                  <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.1)] text-lg font-semibold text-[hsl(var(--primary-foreground))]">
                      {sequentialCount}
                    </div>
                    <div>
                      <p className="text-sm text-[hsl(var(--foreground))]">{sequentialCount === WHY_COUNT ? 'Depth unlocked' : 'Reasoning depth'}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{progressPercent}% complete</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-8 lg:grid-cols-[320px,minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-[hsl(var(--foreground))]">Depth tracker</CardTitle>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Each layer validates the one above it.</p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-3">
                    {Array.from({ length: WHY_COUNT }).map((_, index) => {
                      const isFilled = index < sequentialCount;
                      const isCurrent = index === sequentialCount;
                      return (
                        <React.Fragment key={index}>
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                              isFilled
                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary-foreground))]'
                                : isCurrent
                                ? 'border-[hsl(var(--iris))] text-[hsl(var(--iris))]'
                                : 'border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))]'
                            )}
                          >
                            {index + 1}
                          </div>
                          {index < WHY_COUNT - 1 && (
                            <div
                              className={cn(
                                'w-px flex-1',
                                isFilled ? 'bg-gradient-to-b from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.5)] to-transparent' : 'bg-[hsl(var(--border)/0.5)]'
                              )}
                              style={{ minHeight: '32px' }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">Logic tree</CardTitle>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">See how each answer branches from the previous one.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {session.responses.map((response, index) => {
                    const previous = session.responses[index - 1];
                    const isFocus = index === sequentialCount - 1 && response.trim().length > 0;
                    return (
                      <div key={index} className="relative pl-6">
                        {index !== 0 && (
                          <span className="absolute left-2 top-0 h-full w-px bg-[hsl(var(--border)/0.5)]" aria-hidden />
                        )}
                        <div className="relative rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                            Why {index + 1}
                          </p>
                          <p className="mt-2 text-sm text-[hsl(var(--foreground))]">
                            {response.trim().length ? response : 'Awaiting insight'}
                          </p>
                          {isFocus && (
                            <span className="absolute -top-2 right-3 rounded-full border border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.2)] px-3 py-0.5 text-[10px] uppercase tracking-widest text-[hsl(var(--primary))]">
                              current node
                            </span>
                          )}
                          {previous && !response && (
                            <span className="mt-2 block text-[10px] uppercase tracking-wide text-[hsl(var(--iris))/0.8]">
                              add continuation
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {session.responses.map((response, index) => {
                const hint = activeTrack.hints[index];
                const prompt = activeTrack.prompts[index];
                const isHintVisible = hintOpen[index];
                const locked = index > sequentialCount;
                return (
                  <Card
                    key={index}
                    className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur-md shadow-inner shadow-[hsl(var(--background)/0.2)]"
                  >
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Depth {index + 1}</p>
                        <CardTitle className="text-lg text-[hsl(var(--foreground))]">{prompt}</CardTitle>
                      </div>
                      <span className="rounded-full border border-[hsl(var(--border)/0.5)] px-4 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {response.trim().length ? 'Captured' : 'Pending'}
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {index > 0 && session.responses[index - 1].trim().length > 0 && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Build on: {session.responses[index - 1]}</p>
                      )}
                      <Textarea
                        value={response}
                        onChange={(event) => handleResponseChange(index, event.target.value)}
                        placeholder="Document your reasoning. Be specific and concrete."
                        disabled={locked}
                        className="min-h-[120px] resize-none bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-60"
                      />
                      {locked && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Complete the previous depth before continuing.</p>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setHintOpen((prev) => ({
                            ...prev,
                            [index]: !prev[index],
                          }))
                        }
                        className="w-full justify-between border border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                      >
                        Show example reasoning
                        <span aria-hidden>{isHintVisible ? '−' : '+'}</span>
                      </Button>
                      {isHintVisible && (
                        <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] p-4 text-sm text-[hsl(var(--foreground))]">
                          {hint}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="bg-gradient-to-br from-[hsl(var(--iris)/0.2)] via-transparent to-[hsl(var(--primary)/0.2)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur-lg">
                <CardHeader>
                  <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Completion summary</p>
                  <CardTitle className="text-2xl font-semibold text-[hsl(var(--foreground))]">Why Statement</CardTitle>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Confidence {sequentialConfidence}%</div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-5 text-lg leading-relaxed text-[hsl(var(--foreground))]">
                    {whyStatement}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Theme</Label>
                      <Input
                        value={session.theme}
                        onChange={(event) => updateSession({ theme: event.target.value })}
                        placeholder={derivedTheme}
                        className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Alignment</Label>
                      <Input
                        value={session.alignment}
                        onChange={(event) => updateSession({ alignment: event.target.value })}
                        placeholder={derivedAlignment}
                        className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Button
                      type="button"
                      onClick={handleSaveSnapshot}
                      disabled={sequentialCount < 4}
                      className="h-12 rounded-xl border border-[hsl(var(--love)/0.6)] bg-[hsl(var(--love)/0.2)] text-[hsl(var(--love-foreground))] hover:bg-[hsl(var(--love)/0.4)]"
                    >
                      Save snapshot
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExport}
                      disabled={sequentialCount < 4}
                      className="h-12 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.2)]"
                    >
                      Export JSON
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleReset}
                      className="h-12 rounded-xl border border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                    >
                      Reset session
                    </Button>
                  </div>

                  {status && (
                    <p className="text-center text-sm text-[hsl(var(--primary))]" role="status">
                      {status}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[hsl(var(--card)/0.4)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur">
                <CardHeader className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Snapshots</p>
                    <CardTitle className="text-xl">History dashboard</CardTitle>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Stored locally on this device. Up to {historyLimit} entries are kept. New saves will replace the oldest entries
                      automatically.
                    </p>
                    {historyIsFull ? (
                      <p className="text-xs text-[hsl(var(--gold))]">History is at capacity. Export or clear older snapshots to keep space free.</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <label htmlFor="history-limit" className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                        History limit
                      </label>
                      <select
                        id="history-limit"
                        value={historyLimit}
                        onChange={(event) => {
                          const nextLimit = Number(event.target.value);
                          if (HISTORY_LIMIT_OPTIONS.includes(nextLimit as (typeof HISTORY_LIMIT_OPTIONS)[number])) {
                            setHistoryLimit(nextLimit);
                          }
                        }}
                        className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-3 py-2 text-xs uppercase tracking-[0.3em] text-[hsl(var(--foreground))]"
                      >
                        {HISTORY_LIMIT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleExportHistory}
                        disabled={history.length === 0}
                        className="h-10 rounded-xl border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                      >
                        Export all snapshots
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearHistory}
                        disabled={history.length === 0}
                        className="h-10 rounded-xl border border-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]"
                      >
                        Clear history
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {history.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                      Save a completed reflection to populate your personal archive. Snapshots stay on this browser only.
                    </div>
                  ) : (
                    history.map((entry) => (
                      <div
                        key={`${entry.id}-${entry.timestamp}`}
                        className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                              {formatSnapshotTime(entry.timestamp)} • {TRACKS[entry.track].label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                              {entry.topic || 'Untitled session'}
                            </p>
                            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{entry.whyStatement || 'Snapshot saved without a summary.'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRestoreSnapshot(entry)}
                              className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.2)]"
                            >
                              Load snapshot
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportSnapshot(entry)}
                              className="rounded-lg border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                            >
                              Export
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSnapshot(entry.id)}
                              className="rounded-lg border border-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
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
