import * as React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import type { NetworkingPracticeSession } from '../../utils/storage';

type Props = {
  sessions: NetworkingPracticeSession[];
  onExport: () => void;
  onClearHistory: () => void;
  onRemoveSession: (id: string) => void;
};

function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

function averageRating(session: NetworkingPracticeSession) {
  const { confidence, clarity, rapport, authenticity } = session.ratings;
  return ((confidence + clarity + rapport + authenticity) / 4).toFixed(1);
}

const REFLECTION_LABELS = [
  { key: 'wins' as const, label: 'Worked' },
  { key: 'nervesNote' as const, label: 'Nerves' },
  { key: 'nextFocus' as const, label: 'Next fix' },
  { key: 'humanNote' as const, label: 'Notes' },
];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)]">
        <svg
          className="h-6 w-6 text-[hsl(var(--gold))]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">
        No saved sessions yet
      </p>
      <p className="mt-1 max-w-md text-sm text-[hsl(var(--muted-foreground))]">
        Draft your intro, run a rep, and tap{' '}
        <strong className="font-semibold text-[hsl(var(--foreground))]">Save Session</strong>. Each
        entry stores the exact words you practiced, so you can watch the intro evolve.
      </p>
    </div>
  );
}

export default function SessionHistory({
  sessions,
  onExport,
  onClearHistory,
  onRemoveSession,
}: Props) {
  return (
    <section className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-[hsl(var(--gold))]">Recent Sessions</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
          <span>Stored locally in your browser</span>
          <Button
            type="button"
            variant="outline"
            className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            onClick={onExport}
          >
            Export sessions JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            onClick={onClearHistory}
          >
            Clear history
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
          <CardContent>
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const draft = session.attempts?.[0]?.script ?? '';
            const reflectionEntries = REFLECTION_LABELS.map(({ key, label }) => ({
              key,
              label,
              value: session.reflection?.[key]?.trim() ?? '',
            })).filter((entry) => entry.value.length > 0);

            return (
              <Card
                key={session.id}
                className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]"
              >
                <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                      {new Date(session.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[hsl(var(--foreground))]">
                      {session.scenarioTitle}
                    </div>
                    {draft ? (
                      <div className="mt-3 rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.5)] p-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--gold))]">
                          Intro draft
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm text-[hsl(var(--foreground))]">
                          {draft}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                        No draft captured for this rep.
                      </p>
                    )}
                    {reflectionEntries.length > 0 ? (
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {reflectionEntries.map((entry) => (
                          <div key={entry.key} className="min-w-0">
                            <dt className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--iris))]">
                              {entry.label}
                            </dt>
                            <dd className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                              {entry.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:shrink-0">
                    <div className="flex-1 text-center sm:min-w-[100px]">
                      <div className="text-3xl font-bold text-[hsl(var(--foam))]">
                        {formatDuration(session.attempts?.[0]?.durationSeconds)}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                        Practiced
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:min-w-[100px]">
                      <div className="text-3xl font-bold text-[hsl(var(--gold))]">
                        {averageRating(session)}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                        Avg
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[hsl(var(--border))] text-[hsl(var(--foreground))] sm:w-auto focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                      onClick={() => onRemoveSession(session.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
