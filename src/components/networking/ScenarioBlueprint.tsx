import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import scenarioData from '../../data/networking-scenarios.json';

type Scenario = (typeof scenarioData)[number];

type Props = {
  currentScenario: Scenario | undefined;
  scenarioSteps: string[];
};

export default function ScenarioBlueprint({ currentScenario, scenarioSteps }: Props) {
  if (!currentScenario) return null;

  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--foam))]">Scenario blueprint</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Stay anchored on the intent, environment, and sequence.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[hsl(var(--foam)/0.4)] bg-[hsl(var(--overlay)/0.3)] p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--foam))]">Focus</p>
            <p className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">{currentScenario.focus}</p>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--overlay)/0.3)] p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--gold))]">Setting</p>
            <p className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">{currentScenario.mode}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{currentScenario.where}</p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Opening flow</p>
          <ol className="mt-3 space-y-2">
            {scenarioSteps.map((step, index) => (
              <li
                key={`${currentScenario.id}-step-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] px-4 py-3 text-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)] text-xs font-semibold text-[hsl(var(--foam))]">
                  {index + 1}
                </span>
                <span className="flex-1 text-[hsl(var(--foreground))]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
