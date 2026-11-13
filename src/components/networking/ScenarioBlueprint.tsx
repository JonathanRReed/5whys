import { ClipboardIcon } from '../interview-glow-up/icons';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Scenario } from './useNetworkingPractice';

type Props = {
  currentScenario: Scenario | undefined;
  scenarioSteps: string[];
};

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

export default function ScenarioBlueprint({ currentScenario, scenarioSteps }: Props) {
  return (
    <Card className="border-border/60 bg-overlay/28">
      <CardHeader className="space-y-2">
        <CardTitle className="text-foam">Scenario blueprint</CardTitle>
        <p className="text-sm text-muted-foreground">
          Stay anchored on the intent, environment, and sequence.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-overlay/40 text-xs font-semibold text-foam">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 wrap-anywhere text-foreground">{step}</span>
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
