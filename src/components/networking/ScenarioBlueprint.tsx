import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import scenarioData from '../../data/networking-scenarios.json';
import type { TimerState } from './useTimer';

type Scenario = (typeof scenarioData)[number];

type Props = {
  currentScenario: Scenario | undefined;
  scenarioSteps: string[];
  timer?: TimerState;
};

const FLOW_STEPS = [
  { label: 'Read blueprint', description: 'Review your scenario' },
  { label: 'Warm up', description: 'Prep your opener' },
  { label: 'Start timer', description: 'Practice aloud' },
  { label: 'Self-review', description: 'Rate your round' },
  { label: 'Save session', description: 'Track progress' },
] as const;

function getActiveStep(timer: TimerState | undefined): number {
  if (!timer || timer.startedAt === null) return 0;
  if (timer.isRunning) return 2;
  if (timer.remaining === 0) return 3;
  return 0;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)]">
        <svg
          className="h-6 w-6 text-[hsl(var(--foam))]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V16.5a2.25 2.25 0 002.25 2.25h.75m0-3H12"
          />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No scenario selected</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Select a scenario above to see the blueprint.
      </p>
    </div>
  );
}

export default function ScenarioBlueprint({ currentScenario, scenarioSteps, timer }: Props) {
  const activeStep = getActiveStep(timer);

  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--foam))]">Scenario blueprint</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Stay anchored on the intent, environment, and sequence.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Practice flow progress */}
        <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Practice flow
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FLOW_STEPS.map((step, index) => {
              const isActive = index === activeStep;
              const isPast = index < activeStep;
              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[hsl(var(--foam)/0.15)] text-[hsl(var(--foam))] ring-1 ring-[hsl(var(--foam)/0.4)]'
                      : isPast
                        ? 'bg-[hsl(var(--overlay)/0.3)] text-[hsl(var(--muted-foreground))]'
                        : 'bg-[hsl(var(--overlay)/0.2)] text-[hsl(var(--muted-foreground)/0.7)]'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-[hsl(var(--foam))] text-[hsl(var(--background))]'
                        : isPast
                          ? 'bg-[hsl(var(--foam)/0.3)] text-[hsl(var(--foam))]'
                          : 'bg-[hsl(var(--border)/0.4)] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {currentScenario ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[hsl(var(--foam)/0.4)] bg-[hsl(var(--overlay)/0.3)] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--foam))]">Focus</p>
                <p className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">
                  {currentScenario.focus}
                </p>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--overlay)/0.3)] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--gold))]">
                  Setting
                </p>
                <p className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">
                  {currentScenario.mode}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {currentScenario.where}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                Opening flow
              </p>
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
          </>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}
