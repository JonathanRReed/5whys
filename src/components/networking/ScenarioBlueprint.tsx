import { ClipboardIcon } from '../interview-glow-up/icons';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Scenario } from './useNetworkingPractice';
import type { TimerState } from './useTimer';

type Props = {
  currentScenario: Scenario | undefined;
  scenarioSteps: string[];
  timer?: TimerState;
};

const FLOW_STEPS = [
  { label: 'Read blueprint', description: 'Review your scenario' },
  { label: 'Draft your intro', description: 'Your words, not the samples' },
  { label: 'Run the timer', description: 'Say it out loud' },
  { label: 'Rate the rep', description: 'Score it honestly' },
  { label: 'Save session', description: 'Track the reps' },
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay/40">
        <ClipboardIcon className="h-6 w-6 text-foam" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">No scenario selected</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a scenario above to see the blueprint.
      </p>
    </div>
  );
}

export default function ScenarioBlueprint({ currentScenario, scenarioSteps, timer }: Props) {
  const activeStep = getActiveStep(timer);

  return (
    <Card className="border-border/60 bg-overlay/28">
      <CardHeader className="space-y-2">
        <CardTitle className="text-foam">Scenario blueprint</CardTitle>
        <p className="text-sm text-muted-foreground">
          Stay anchored on the intent, environment, and sequence.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Practice flow progress */}
        <div className="rounded-2xl border border-border/35 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Practice flow</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FLOW_STEPS.map((step, index) => {
              const isActive = index === activeStep;
              const isPast = index < activeStep;
              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-foam/15 text-foam ring-1 ring-foam/40'
                      : isPast
                        ? 'bg-overlay/30 text-muted-foreground'
                        : 'bg-overlay/20 text-muted-foreground/70'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-foam text-background'
                        : isPast
                          ? 'bg-foam/30 text-foam'
                          : 'bg-border/40 text-muted-foreground'
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
              <div className="rounded-2xl border border-foam/40 bg-overlay/30 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-foam">Focus</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {currentScenario.focus}
                </p>
              </div>
              <div className="rounded-2xl border border-gold/40 bg-overlay/30 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">Setting</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {currentScenario.mode}
                </p>
                <p className="text-sm text-muted-foreground">{currentScenario.where}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Opening flow
              </p>
              <ol className="mt-3 space-y-2">
                {scenarioSteps.map((step, index) => (
                  <li
                    key={`${currentScenario.id}-step-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-border/35 bg-background/60 px-4 py-3 text-sm"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-overlay/40 text-xs font-semibold text-foam">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-foreground">{step}</span>
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
