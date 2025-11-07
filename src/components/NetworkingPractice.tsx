import * as React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import scenarioData from '../data/networking-scenarios.json';
import {
  deleteSession,
  deleteVersion,
  generateId,
  loadSessions,
  loadVersions,
  saveSession,
  saveVersion,
} from '../utils/storage';
import type { NetworkingPracticeSession, NetworkingPracticeVersion } from '../utils/storage';

const TOTAL_SECONDS = 120;

type Scenario = (typeof scenarioData)[number];

type TimerState = {
  remaining: number;
  isRunning: boolean;
  startedAt: number | null;
};

type Ratings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

const defaultRatings: Ratings = { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 };

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
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

function computeFeedbackColor(value: number) {
  if (value >= 4) return 'text-[hsl(var(--love))]';
  if (value >= 3) return 'text-[hsl(var(--gold))]';
  return 'text-[hsl(var(--destructive))]';
}

function useHydratedState<T>(initial: T, loader: () => T) {
  const [state, setState] = React.useState(initial);

  React.useEffect(() => {
    setState(loader());
  }, [loader]);

  return [state, setState] as const;
}

export default function NetworkingPractice() {
  const scenarios: Scenario[] = scenarioData;
  const fallbackVersion = React.useMemo(() => scenarioToVersion(scenarios[0] ?? {
    id: 'default',
    title: 'Default Scenario',
    who: 'You + Guest',
    where: 'Networking Event',
    what: ['Introduce yourself', 'Share goal', 'Ask a question'],
  }), [scenarios]);

  const [versions, setVersions] = useHydratedState<NetworkingPracticeVersion[]>(
    [fallbackVersion],
    () => {
      const existing = loadVersions();
      return existing.length ? existing : [fallbackVersion];
    }
  );

  const [sessions, setSessions] = useHydratedState<NetworkingPracticeSession[]>([], loadSessions);

  const [currentVersionId, setCurrentVersionId] = React.useState<string>(fallbackVersion.id);
  const currentVersion = React.useMemo(
    () => versions.find((version) => version.id === currentVersionId) ?? versions[0],
    [currentVersionId, versions]
  );

  React.useEffect(() => {
    if (!currentVersion && versions.length) {
      setCurrentVersionId(versions[0].id);
    }
  }, [currentVersion, versions]);

  const [timer, setTimer] = React.useState<TimerState>({ remaining: TOTAL_SECONDS, isRunning: false, startedAt: null });
  const [ratings, setRatings] = React.useState<Ratings>(defaultRatings);
  const [reflection, setReflection] = React.useState('');

  React.useEffect(() => {
    if (!timer.isRunning) return;

    const tick = () => {
      setTimer((prev) => {
        if (!prev.isRunning) return prev;
        const nextRemaining = Math.max(prev.remaining - 1, 0);
        if (nextRemaining === 0) {
          return { remaining: 0, isRunning: false, startedAt: prev.startedAt };
        }
        return { ...prev, remaining: nextRemaining };
      });
    };

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  const progress = (TOTAL_SECONDS - timer.remaining) / TOTAL_SECONDS;
  const ringStyle = {
    background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, hsl(var(--border)/0.3) 0deg)`,
  };

  const handleScenarioChange = (scenarioId: string) => {
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

    updateVersion(updated);
  };

  const handleFieldChange = (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => {
    if (!currentVersion) return;
    const updated: NetworkingPracticeVersion = {
      ...currentVersion,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    updateVersion(updated);
  };

  function updateVersion(updated: NetworkingPracticeVersion) {
    setVersions((existing) => {
      const next = existing.map((item) => (item.id === updated.id ? updated : item));
      saveVersion(updated);
      return next;
    });
  }

  const createNewVersion = () => {
    const scenario = scenarios[0];
    if (!scenario) return;
    const title = window.prompt('Name this practice version', `${scenario.title} Intro`);
    if (!title) return;

    const nextVersion = scenarioToVersion(scenario, title);
    saveVersion(nextVersion);
    setVersions((prev) => [nextVersion, ...prev]);
    setCurrentVersionId(nextVersion.id);
  };

  const deleteCurrentVersion = () => {
    if (!currentVersion) return;
    if (!window.confirm('Delete this practice version?')) return;
    deleteVersion(currentVersion.id);
    setVersions((prev) => prev.filter((version) => version.id !== currentVersion.id));
  };

  const resetTimer = () => {
    setTimer({ remaining: TOTAL_SECONDS, isRunning: false, startedAt: null });
  };

  const startTimer = () => {
    setTimer((prev) => ({ remaining: prev.remaining === 0 ? TOTAL_SECONDS : prev.remaining, isRunning: true, startedAt: Date.now() }));
  };

  const pauseTimer = () => {
    setTimer((prev) => ({ ...prev, isRunning: false }));
  };

  const averageRating = React.useMemo(() => {
    const total = ratings.confidence + ratings.clarity + ratings.rapport + ratings.authenticity;
    return total / 4;
  }, [ratings]);

  const saveCurrentSession = () => {
    if (!currentVersion) return;

    const scenario = scenarios.find((item) => item.id === currentVersion.scenarioId) ?? scenarios[0];
    const session: NetworkingPracticeSession = {
      id: generateId(),
      versionId: currentVersion.id,
      scenarioId: currentVersion.scenarioId,
      scenarioTitle: scenario?.title ?? currentVersion.title,
      attempts: [{
        id: generateId(),
        label: 'Round 1',
        script: currentVersion.what,
        durationSeconds: TOTAL_SECONDS - timer.remaining,
        createdAt: new Date().toISOString(),
      }],
      ratings,
      reflection: {
        humanNote: reflection,
        nervesNote: '',
        nextFocus: '',
        wins: '',
      },
      createdAt: new Date().toISOString(),
    };

    saveSession(session);
    setSessions((prev) => [session, ...prev]);
    setReflection('');
  };

  const removeSession = (id: string) => {
    deleteSession(id);
    setSessions((prev) => prev.filter((session) => session.id !== id));
  };

  const scenarioPills = scenarios.map((scenario) => {
    const isActive = scenario.id === currentVersion?.scenarioId;
    return (
      <button
        key={scenario.id}
        onClick={() => handleScenarioChange(scenario.id)}
        className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
          isActive ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary-foreground))]' : 'border-transparent bg-[hsl(var(--overlay)/0.3)] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]'
        }`}
      >
        <div className="text-sm font-semibold">{scenario.title}</div>
        <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{scenario.where}</div>
      </button>
    );
  });

  return (
    <div className="min-h-screen text-[hsl(var(--foreground))]">
      <div className="max-w-6xl px-4 py-12 mx-auto">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-3xl bg-gradient-to-br from-[hsl(var(--love))] to-[hsl(var(--iris))]">
            <svg className="w-9 h-9 text-[hsl(var(--background))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5.121 17.804A3 3 0 017 17h10a3 3 0 012.879 2.804L20 21H4l1.121-3.196zM12 14a5 5 0 100-10 5 5 0 000 10z" />
            </svg>
          </div>
          <p className="text-sm uppercase tracking-[0.4em] text-[hsl(var(--muted-foreground))]">Career Tools Suite</p>
          <h1 className="mt-4 text-4xl font-bold text-[hsl(var(--gold))]">Networking Practice Studio</h1>
          <p className="max-w-3xl mx-auto mt-4 text-base text-[hsl(var(--muted-foreground))]">
            Craft confident introductions for career fairs, conferences, and outreach. Practice your Who / Where / What openings, pace yourself with a two-minute timer, and capture reflections to keep improving.
          </p>
        </header>

        <section className="grid gap-6 p-6 mb-10 rounded-3xl bg-[hsl(var(--overlay)/0.3)] shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">{scenarioPills}</div>
            <div className="flex items-center gap-2">
              <Button onClick={createNewVersion} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.8)]">
                New Version
              </Button>
              {versions.length > 1 ? (
                <Button variant="outline" className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]" onClick={deleteCurrentVersion}>
                  Delete Version
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,_200px)_1fr]">
            <div className="space-y-3">
              <Label htmlFor="version">Practice Version</Label>
              <select
                id="version"
                value={currentVersion?.id ?? ''}
                onChange={(event) => setCurrentVersionId(event.target.value)}
                className="w-full rounded-lg border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id} className="bg-[hsl(var(--overlay)/0.3)]">
                    {version.title}
                  </option>
                ))}
              </select>
              <Input
                value={currentVersion?.title ?? ''}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                placeholder="Version title"
                className="bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))]"
              />
              <Textarea
                value={currentVersion?.notes ?? ''}
                onChange={(event) => handleFieldChange('notes', event.target.value)}
                placeholder="Session notes or goals"
                className="h-24 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
                    <span className="text-2xl">🧑‍💼</span>
                    WHO
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    value={currentVersion?.who ?? ''}
                    onChange={(event) => handleFieldChange('who', event.target.value)}
                    className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--gold)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--gold))]"
                  />
                </CardContent>
              </Card>

              <Card className="border-[hsl(var(--love)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-[hsl(var(--love))]">
                    <span className="text-2xl">📍</span>
                    WHERE
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    value={currentVersion?.where ?? ''}
                    onChange={(event) => handleFieldChange('where', event.target.value)}
                    className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--love)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--love))]"
                  />
                </CardContent>
              </Card>

              <Card className="border-[hsl(var(--foam)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-[hsl(var(--foam))]">
                    <span className="text-2xl">⏳</span>
                    WHAT
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    value={currentVersion?.what ?? ''}
                    onChange={(event) => handleFieldChange('what', event.target.value)}
                    className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--foam)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--foam))]"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-6 mb-10 md:grid-cols-[minmax(0,_320px)_1fr]">
          <Card className="border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
            <CardHeader className="text-center">
              <CardTitle className="text-[hsl(var(--primary))]">Two-Minute Timer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center w-48 h-48 rounded-full border border-[hsl(var(--border)/0.6)]">
                <div
                  className="absolute inset-1 rounded-full"
                  style={ringStyle as React.CSSProperties}
                />
                <div className="relative flex flex-col items-center justify-center w-40 h-40 rounded-full bg-[hsl(var(--overlay)/0.3)] text-3xl font-semibold">
                  {formatTime(timer.remaining)}
                  <span className="mt-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">remaining</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={startTimer} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.8)]">
                  {timer.isRunning ? 'Running' : 'Start'}
                </Button>
                <Button onClick={pauseTimer} variant="outline" className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]">
                  Pause
                </Button>
                <Button onClick={resetTimer} variant="outline" className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]">
                  Reset
                </Button>
              </div>
              <p className="text-sm text-center text-[hsl(var(--muted-foreground))]">
                Practice aloud or time your typed intro. Aim for a confident 90–120 second pitch.
              </p>
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--iris))]">Self-Review</CardTitle>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Slide to score this round. Target green across the board.</p>
            </CardHeader>
            <CardContent className="grid gap-6">
              {(
                [
                  { key: 'confidence', label: 'Confidence' },
                  { key: 'clarity', label: 'Clarity' },
                  { key: 'rapport', label: 'Rapport' },
                  { key: 'authenticity', label: 'Authenticity' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className={`font-semibold ${computeFeedbackColor(ratings[key])}`}>{ratings[key]}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={ratings[key]}
                    onChange={(event) =>
                      setRatings((prev) => ({ ...prev, [key]: Number(event.target.value) as Ratings[keyof Ratings] }))
                    }
                    className="w-full accent-[hsl(var(--iris))]"
                  />
                </div>
              ))}

              <div className="rounded-xl bg-[hsl(var(--overlay)/0.3)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
                <div className="mb-1 text-xs uppercase tracking-[0.3em] text-[hsl(var(--iris))]">Average</div>
                <div className={`text-2xl font-semibold ${computeFeedbackColor(averageRating)}`}>
                  {averageRating.toFixed(1)}/5
                </div>
                <p className="mt-2">
                  {averageRating >= 4
                    ? 'Polished! Consider experimenting with different openers.'
                    : averageRating >= 3
                    ? 'Solid foundation—refine pacing and emphasis next round.'
                    : 'Revisit your structure and energy. Try one more round while it’s fresh.'}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reflection">Reflection</Label>
                <Textarea
                  id="reflection"
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="Notes to future you…"
                  className="min-h-[100px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--iris))]"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={saveCurrentSession} className="bg-[hsl(var(--gold))] text-[hsl(var(--background))] hover:bg-[hsl(var(--gold)/0.8)]">
                  Save Session
                </Button>
                <Button
                  variant="outline"
                  className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]"
                  onClick={() => {
                    resetTimer();
                    setRatings(defaultRatings);
                    setReflection('');
                  }}
                >
                  Reset Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-[hsl(var(--gold))]">Recent Sessions</h2>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Stored locally in your browser</span>
          </div>

          {sessions.length === 0 ? (
            <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
              <CardContent className="py-10 text-center text-[hsl(var(--muted-foreground))]">
                No saved sessions yet. Finish a practice round and tap <strong className="font-semibold text-[hsl(var(--foreground))]">Save Session</strong> to start your streak.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id} className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
                  <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                        {new Date(session.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[hsl(var(--foreground))]">{session.scenarioTitle}</div>
                      <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                        {session.attempts[0]?.script.split('\n').map((line: string, index: number) => (
                          <div key={index}>• {line}</div>
                        ))}
                      </div>
                      {session.reflection?.humanNote ? (
                        <p className="mt-3 text-sm text-[#C4A7E7]">"{session.reflection.humanNote}"</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#9CCFD8]">
                          {(session.attempts[0]?.durationSeconds ? (session.attempts[0].durationSeconds / 60).toFixed(1) : '0.0')}m
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[#908CAA]">Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-[#F6C177]">
                          {(
                            (session.ratings.confidence +
                              session.ratings.clarity +
                              session.ratings.rapport +
                              session.ratings.authenticity) /
                            4
                          ).toFixed(1)}
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[#908CAA]">Avg</div>
                      </div>
                      <Button
                        variant="outline"
                        className="border-[#6E6A86] text-[#E0DEF4]"
                        onClick={() => removeSession(session.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
