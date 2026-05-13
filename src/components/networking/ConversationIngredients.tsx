import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import scenarioData from '../../data/networking-scenarios.json';

type Scenario = (typeof scenarioData)[number];
type PillarKey = 'rapport' | 'identity' | 'value' | 'question';

const PILLAR_DETAILS = [
  { key: 'rapport', label: 'Rapport spark', accent: 'text-[hsl(var(--foam))]' },
  { key: 'identity', label: 'Identity line', accent: 'text-[hsl(var(--gold))]' },
  { key: 'value', label: 'Value proof', accent: 'text-[hsl(var(--love))]' },
  { key: 'question', label: 'Curious ask', accent: 'text-[hsl(var(--iris))]' },
] as const satisfies Array<{ key: PillarKey; label: string; accent: string }>;

type Props = {
  currentScenario: Scenario | undefined;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)]">
        <svg className="h-6 w-6 text-[hsl(var(--foam))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .836.559 1.545 1.337 1.897l4.991 2.497a2.104 2.104 0 01.685.797m9.345-8.334C20.395 7.612 18.616 7 16.5 7c-1.551 0-3.169.329-4.62.922m0 0a48.11 48.11 0 011.618 5.858m-9.345 8.334a48.109 48.109 0 00-1.618-5.858m0 0c-.377-.67-.822-1.311-1.329-1.911M3.75 12c0-2.42 1.09-4.688 2.89-6.196" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No scenario selected</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Select a scenario above to generate conversation ingredients.</p>
    </div>
  );
}

export default function ConversationIngredients({ currentScenario, onCopy, copiedKey }: Props) {
  const pillarEntries = React.useMemo(() => {
    if (!currentScenario?.pillars) return [];
    return PILLAR_DETAILS.map(({ key, label, accent }) => ({
      key,
      label,
      accent,
      value: currentScenario.pillars?.[key] ?? '',
    })).filter((entry) => entry.value.trim().length > 0);
  }, [currentScenario]);

  if (!currentScenario) {
    return (
      <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-[hsl(var(--love))]">Conversation ingredients</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Use these as starter lines or mix them into your script.</p>
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
        <CardTitle className="text-[hsl(var(--love))]">Conversation ingredients</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Use these as starter lines or mix them into your script.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {pillarEntries.length ? (
          pillarEntries.map((pillar) => {
            const key = `pillar-${pillar.key}-${currentScenario.id}`;
            const isCopied = copiedKey === key;
            return (
              <div
                key={pillar.key}
                className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className={`text-xs uppercase tracking-[0.3em] ${pillar.accent}`}>{pillar.label}</p>
                    <p className="mt-2 text-sm text-[hsl(var(--foreground))]">{pillar.value}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                    onClick={() => onCopy(pillar.value, key)}
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Add a few custom lines to reuse later.</p>
        )}
        {pillarEntries.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)]">
            Tip: Customize the scenario fields above to get more relevant suggestions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
