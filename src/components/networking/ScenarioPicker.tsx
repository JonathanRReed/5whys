import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { Scenario } from './useNetworkingPractice';

type Props = {
  scenarios: Scenario[];
  currentScenario: Scenario | undefined;
  onScenarioChange: (scenarioId: string) => void;
};

const GROUPS = [
  { audience: 'student', label: 'Student situations' },
  { audience: 'transition', label: 'Career changers and professionals' },
] as const;

/**
 * One native select for the twelve scenarios, grouped by audience, plus a
 * short summary of the chosen one. On a phone this replaces a wall of twelve
 * buttons that used to sit above the practice box.
 */
export default function ScenarioPicker({ scenarios, currentScenario, onScenarioChange }: Props) {
  const groups = GROUPS.map((group) => ({
    ...group,
    scenarios: scenarios.filter((scenario) => scenario.audience === group.audience),
  })).filter((group) => group.scenarios.length > 0);
  const ungrouped = scenarios.filter(
    (scenario) => !GROUPS.some((group) => group.audience === scenario.audience)
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
      <div className="grid gap-2">
        <Label
          htmlFor="scenario"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
        >
          Scenario
        </Label>
        <Select value={currentScenario?.id ?? ''} onValueChange={onScenarioChange}>
          <SelectTrigger
            id="scenario"
            className="w-full rounded-xl border-border/60 bg-overlay/30 py-6 text-base"
          >
            <SelectValue placeholder="Pick a scenario" />
          </SelectTrigger>
          <SelectContent className="border border-border/60 bg-popover">
            {groups.map((group) => (
              <SelectGroup key={group.audience}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {ungrouped.length > 0 && (
              <SelectGroup>
                {ungrouped.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Twelve situations, nine of them for students. Pick the one closest to your next
          conversation.
        </p>
      </div>

      {currentScenario && (
        <dl className="grid gap-3 rounded-2xl border border-border/40 bg-overlay/20 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Focus</dt>
            <dd className="mt-1 font-medium text-foreground">{currentScenario.focus}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Who</dt>
            <dd className="mt-1 text-foreground">{currentScenario.who}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Where</dt>
            <dd className="mt-1 text-foreground">{currentScenario.where}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
