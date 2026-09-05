import type { NetworkingPracticeVersion } from '../../utils/storage';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { Scenario } from './useNetworkingPractice';

type Props = {
  scenarios: Scenario[];
  versions: NetworkingPracticeVersion[];
  currentVersionId: string;
  currentVersion: NetworkingPracticeVersion | undefined;
  onScenarioChange: (scenarioId: string) => void;
  onVersionSelect: (versionId: string) => void;
  onCreateNewVersion: () => void;
  onDeleteCurrentVersion: () => void;
  onFieldChange: (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => void;
};

const GROUPS = [
  { audience: 'student', label: 'Student situations' },
  { audience: 'transition', label: 'Career changers and professionals' },
] as const;

export default function ScenarioSelector({
  scenarios,
  versions,
  currentVersionId,
  currentVersion,
  onScenarioChange,
  onVersionSelect,
  onCreateNewVersion,
  onDeleteCurrentVersion,
  onFieldChange,
}: Props) {
  const groups = GROUPS.map((group) => ({
    ...group,
    scenarios: scenarios.filter((scenario) => scenario.audience === group.audience),
  })).filter((group) => group.scenarios.length > 0);
  const ungrouped = scenarios.filter(
    (scenario) => !GROUPS.some((group) => group.audience === scenario.audience)
  );

  const renderScenarioButton = (scenario: Scenario) => {
    const isActive = scenario.id === currentVersion?.scenarioId;
    return (
      <button
        key={scenario.id}
        type="button"
        onClick={() => onScenarioChange(scenario.id)}
        aria-pressed={isActive}
        className={`rounded-xl border px-4 py-3 text-left shadow-xs transition ${
          isActive
            ? 'border-primary bg-primary/20 text-foreground'
            : 'border-transparent bg-overlay/30 text-foreground hover:border-primary'
        }`}
      >
        <div className="text-sm font-semibold">{scenario.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{scenario.focus}</div>
      </button>
    );
  };

  return (
    <>
      <div className="col-span-full flex flex-wrap items-start justify-between gap-4">
        <div className="flex w-full flex-col gap-4 sm:w-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Scenario library
          </p>
          {groups.map((group) => (
            <div key={group.audience} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.scenarios.map(renderScenarioButton)}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 ? (
            <div className="flex flex-wrap gap-2">{ungrouped.map(renderScenarioButton)}</div>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
          <Button
            onClick={onCreateNewVersion}
            className="w-full bg-primary hover:bg-primary/80 sm:w-auto"
          >
            New Version
          </Button>
          {versions.length > 1 ? (
            <Button
              variant="outline"
              className="w-full border-border/60 text-foreground sm:w-auto"
              onClick={onDeleteCurrentVersion}
            >
              Delete Version
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="version">Practice version</Label>
        <select
          id="version"
          value={currentVersionId}
          onChange={(event) => onVersionSelect(event.target.value)}
          className="w-full rounded-lg border border-border/60 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id} className="bg-overlay/30">
              {version.title}
            </option>
          ))}
        </select>
        <div className="space-y-1">
          <Label
            htmlFor="version-title"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            Custom name
          </Label>
          <Input
            id="version-title"
            value={currentVersion?.title ?? ''}
            onChange={(event) => onFieldChange('title', event.target.value)}
            placeholder="Give this practice run a nickname"
            className="bg-overlay/35 border-border/60 text-foreground focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor="version-notes"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            Session notes
          </Label>
          <Textarea
            id="version-notes"
            value={currentVersion?.notes ?? ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            placeholder="Session notes or goals"
            className="h-24 bg-overlay/35 border-border/60 text-sm text-foreground focus:border-primary"
          />
        </div>
      </div>
    </>
  );
}
