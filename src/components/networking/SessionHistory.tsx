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

export default function SessionHistory({ sessions, onExport, onClearHistory, onRemoveSession }: Props) {
  return (
    <section className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-[hsl(var(--gold))]">Recent Sessions</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
          <span>Stored locally in your browser</span>
          <Button
            type="button"
            variant="outline"
            className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]"
            onClick={onExport}
          >
            Export sessions JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
            onClick={onClearHistory}
          >
            Clear history
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
          <CardContent className="py-10 text-center text-[hsl(var(--muted-foreground))]">
            No saved sessions yet. Run a practice rep and tap{' '}
            <strong className="font-semibold text-[hsl(var(--foreground))]">Save Session</strong> to begin your history.
            Revisit saved runs to spot growth over time.
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
                    <p className="mt-3 text-sm text-[hsl(var(--iris))]">&quot;{session.reflection.humanNote}&quot;</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="sm:min-w-[120px] flex-1 text-center">
                    <div className="text-3xl font-bold text-[hsl(var(--foam))]">
                      {session.attempts[0]?.durationSeconds ? (session.attempts[0].durationSeconds / 60).toFixed(1) : '0.0'}m
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">Time</div>
                  </div>
                  <div className="sm:min-w-[120px] flex-1 text-center">
                    <div className="text-3xl font-bold text-[hsl(var(--gold))]">
                      {(
                        (session.ratings.confidence +
                          session.ratings.clarity +
                          session.ratings.rapport +
                          session.ratings.authenticity) /
                        4
                      ).toFixed(1)}
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">Avg</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[hsl(var(--border))] text-[hsl(var(--foreground))] sm:w-auto"
                    onClick={() => onRemoveSession(session.id)}
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
  );
}
