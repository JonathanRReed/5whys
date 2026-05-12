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

  if (!currentScenario) return null;

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
                    className="border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))]"
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
      </CardContent>
    </Card>
  );
}
