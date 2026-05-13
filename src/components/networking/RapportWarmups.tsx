import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

type Props = {
  rapportSamples: string[];
  scenarioId: string | undefined;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

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
            d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
          />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No scenario selected</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Select a scenario above to generate rapport warm-ups.
      </p>
    </div>
  );
}

export default function RapportWarmups({ rapportSamples, scenarioId, onCopy, copiedKey }: Props) {
  if (!scenarioId) {
    return (
      <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-[hsl(var(--gold))]">Rapport warm-ups</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Steal a line or tweak it for your voice.
          </p>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--gold))]">Rapport warm-ups</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Steal a line or tweak it for your voice.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rapportSamples.length ? (
          rapportSamples.map((sample, index) => {
            const key = `rapport-${scenarioId}-${index}`;
            const isCopied = copiedKey === key;
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] p-4"
              >
                <p className="text-sm text-[hsl(var(--foreground))]">{sample}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  onClick={() => onCopy(sample, key)}
                >
                  {isCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Drop your favorite opener ideas here.
          </p>
        )}
        {rapportSamples.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)]">
            Tip: Customize the scenario fields above to get more relevant suggestions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
