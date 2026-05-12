import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

type Props = {
  rapportSamples: string[];
  scenarioId: string;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

export default function RapportWarmups({ rapportSamples, scenarioId, onCopy, copiedKey }: Props) {
  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--gold))]">Rapport warm-ups</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Steal a line or tweak it for your voice.</p>
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
                  className="text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))]"
                  onClick={() => onCopy(sample, key)}
                >
                  {isCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Drop your favorite opener ideas here.</p>
        )}
      </CardContent>
    </Card>
  );
}
