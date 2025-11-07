import * as React from 'react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { cn } from '../lib/utils';

const WHY_COUNT = 5;
const SESSION_KEY = 'career-why-session-v2';
const HISTORY_KEY = 'career-why-history';

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

function useStoredSession() {
  const [session, setSession] = React.useState<Session>(() => {
    const fallback = createEmptySession();
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Session;
        return { ...fallback, ...parsed };
      }
    } catch (err) {
      console.warn('Unable to load saved 5 Whys session', err);
    }
    return fallback;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Unable to persist 5 Whys session', err);
    }
  }, [session]);

  return [session, setSession] as const;
}

export default function Career5Whys() {
  const [session, setSession] = useStoredSession();
  const [hintOpen, setHintOpen] = React.useState<Record<number, boolean>>({});
  const [status, setStatus] = React.useState<string | null>(null);

  const progress = session.responses.filter((response) => response.trim().length > 0).length;
  const progressPercent = Math.round((progress / WHY_COUNT) * 100);
  const activeTrack = TRACKS[session.track];

  const derivedTheme =
    session.theme.trim() ||
    session.responses
      .slice()
      .reverse()
      .find((response) => response.trim().length > 0) ||
    session.topic ||
    'earning clarity on the work that matters';

  const derivedAlignment =
    session.alignment.trim() ||
    session.responses
      .slice(0, WHY_COUNT - 1)
      .reverse()
      .find((response) => response.trim().length > 0) ||
    'how you want to invest your focus';

  const whyStatement = `You’re motivated by ${derivedTheme.trim()} because it aligns with ${derivedAlignment.trim()}.`;

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
    if (typeof window === 'undefined') return;
    const payload = {
      id: session.id,
      userId: 'local-user',
      timestamp: new Date().toISOString(),
      whyStatement,
      track: session.track,
      topic: session.topic,
      responses: session.responses,
    };
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as typeof payload[];
      localStorage.setItem(HISTORY_KEY, JSON.stringify([payload, ...history].slice(0, 12)));
      setStatus('Saved to local dashboard');
    } catch (err) {
      console.warn('Unable to store why session history', err);
      setStatus('Storage unavailable');
    }
  };

  const handleExport = () => {
    const exportPayload = {
      ...session,
      whyStatement,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${session.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => updateSession(createEmptySession(session.track));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f15] via-[#15121f] to-[#1e1a2a] text-slate-100">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 space-y-10">
          <header className="text-center space-y-4">
            <p className="text-cyan-300 uppercase tracking-[0.3em] text-xs">Career Lab</p>
            <h1 className="text-4xl font-semibold">Discover Your Why</h1>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Guided reasoning for uncovering the motivation behind your next career move. Choose a track,
              document five layers of reasoning, and leave with a statement you can reuse across resume, interview,
              and networking prep.
            </p>
          </header>

          <Card className="bg-white/5 border-white/10 text-slate-100 backdrop-blur-md shadow-[0_20px_80px_rgba(15,23,42,0.35)]">
            <CardHeader className="space-y-6">
              <div>
                <CardTitle className="text-2xl font-semibold">Select your track</CardTitle>
                <p className="text-sm text-slate-400">
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
                      onClick={() =>
                        updateSession({
                          track: key as Track,
                        })
                      }
                      className={cn(
                        'flex-1 rounded-2xl border px-4 py-5 text-left transition-all',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400',
                        isActive
                          ? 'border-cyan-400/80 bg-cyan-400/10 shadow-inner text-white'
                          : 'border-white/10 bg-white/0 text-slate-300 hover:border-white/30'
                      )}
                    >
                      <p className="text-sm font-semibold">{config.label}</p>
                      <p className="text-xs text-slate-400 mt-2">{config.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {activeTrack.topicLabel}
                  </Label>
                  <Input
                    value={session.topic}
                    onChange={(event) => updateSession({ topic: event.target.value })}
                    placeholder={activeTrack.topicPlaceholder}
                    className="mt-2 bg-black/30 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Progress</Label>
                  <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-400/10 text-lg font-semibold text-white">
                      {progress}
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">
                        {progress === WHY_COUNT ? 'Depth unlocked' : 'Reasoning depth'}
                      </p>
                      <p className="text-xs text-slate-500">{progressPercent}% complete</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-8 lg:grid-cols-[320px,minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="bg-white/5 border-white/10 text-slate-100 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-white">Depth tracker</CardTitle>
                  <p className="text-sm text-slate-400">Each layer validates the one above it.</p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-3">
                    {Array.from({ length: WHY_COUNT }).map((_, index) => {
                      const isFilled = index < progress;
                      const isCurrent = index === progress;
                      return (
                        <React.Fragment key={index}>
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                              isFilled
                                ? 'border-cyan-300 bg-cyan-400/20 text-white'
                                : isCurrent
                                ? 'border-purple-300 text-purple-200'
                                : 'border-white/10 text-slate-500'
                            )}
                          >
                            {index + 1}
                          </div>
                          {index < WHY_COUNT - 1 && (
                            <div
                              className={cn(
                                'w-px flex-1',
                                isFilled ? 'bg-gradient-to-b from-cyan-300 via-cyan-500/50 to-transparent' : 'bg-white/10'
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

              <Card className="bg-white/5 border-white/10 text-slate-100 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">Logic tree</CardTitle>
                  <p className="text-sm text-slate-400">See how each answer branches from the previous one.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {session.responses.map((response, index) => {
                    const previous = session.responses[index - 1];
                    const isFocus = index === progress - 1 && response.trim().length > 0;
                    return (
                      <div key={index} className="relative pl-6">
                        {index !== 0 && (
                          <span className="absolute left-2 top-0 h-full w-px bg-white/10" aria-hidden />
                        )}
                        <div className="relative rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                            Why {index + 1}
                          </p>
                          <p className="mt-2 text-sm text-slate-200">
                            {response.trim().length ? response : 'Awaiting insight'}
                          </p>
                          {isFocus && (
                            <span className="absolute -top-2 right-3 rounded-full border border-cyan-400/60 bg-cyan-400/20 px-3 py-0.5 text-[10px] uppercase tracking-widest text-cyan-200">
                              current node
                            </span>
                          )}
                          {previous && !response && (
                            <span className="absolute -bottom-2 left-4 text-[10px] uppercase tracking-wide text-purple-200/80">
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
                return (
                  <Card
                    key={index}
                    className="bg-white/5 border-white/10 text-slate-100 backdrop-blur-md shadow-inner shadow-black/20"
                  >
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Depth {index + 1}</p>
                        <CardTitle className="text-lg text-white">{prompt}</CardTitle>
                      </div>
                      <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-slate-400">
                        {response.trim().length ? 'Captured' : 'Pending'}
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={response}
                        onChange={(event) => handleResponseChange(index, event.target.value)}
                        placeholder="Document your reasoning. Be specific and concrete."
                        className="min-h-[120px] resize-none bg-black/30 border-white/10 text-slate-100 placeholder:text-slate-500"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setHintOpen((prev) => ({
                            ...prev,
                            [index]: !prev[index],
                          }))
                        }
                        className="w-full justify-between border border-white/10 bg-white/0 text-slate-300 hover:bg-white/10"
                      >
                        Show example reasoning
                        <span aria-hidden>{isHintVisible ? '−' : '+'}</span>
                      </Button>
                      {isHintVisible && (
                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm text-slate-200">
                          {hint}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="bg-gradient-to-br from-purple-600/20 via-transparent to-cyan-500/20 border-white/10 text-slate-100 backdrop-blur-lg">
                <CardHeader>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Completion summary</p>
                  <CardTitle className="text-2xl font-semibold text-white">Why Statement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-lg leading-relaxed text-white">
                    {whyStatement}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Theme</Label>
                      <Input
                        value={session.theme}
                        onChange={(event) => updateSession({ theme: event.target.value })}
                        placeholder={derivedTheme}
                        className="mt-2 bg-black/30 border-white/10 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Alignment</Label>
                      <Input
                        value={session.alignment}
                        onChange={(event) => updateSession({ alignment: event.target.value })}
                        placeholder={derivedAlignment}
                        className="mt-2 bg-black/30 border-white/10 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Button
                      type="button"
                      onClick={handleSaveSnapshot}
                      className="h-12 rounded-xl border border-cyan-400/60 bg-cyan-500/20 text-white hover:bg-cyan-500/40"
                    >
                      Save snapshot
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExport}
                      className="h-12 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20"
                    >
                      Export JSON
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleReset}
                      className="h-12 rounded-xl border border-white/5 text-slate-300 hover:bg-white/10"
                    >
                      Reset session
                    </Button>
                  </div>

                  {status && (
                    <p className="text-center text-sm text-cyan-200" role="status">
                      {status}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <footer className="border-t border-white/10 pt-8 text-center text-sm text-slate-500">
            <p>Insight is cumulative. Revisit your entries whenever your path evolves.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
