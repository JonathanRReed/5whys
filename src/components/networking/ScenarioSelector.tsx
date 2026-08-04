import * as React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { NetworkingPracticeVersion } from '../../utils/storage';
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
        className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
          isActive
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--foreground))]'
            : 'border-transparent bg-[hsl(var(--overlay)/0.3)] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]'
        }`}
      >
        <div className="text-sm font-semibold">{scenario.title}</div>
        <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{scenario.focus}</div>
      </button>
    );
  };

  return (
    <>
      <div className="col-span-full flex flex-wrap items-start justify-between gap-4">
        <div className="flex w-full flex-col gap-4 sm:w-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Scenario library
          </p>
          {groups.map((group) => (
            <div key={group.audience} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {group.label}
              </p>
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
            className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.8)] sm:w-auto"
          >
            New Version
          </Button>
          {versions.length > 1 ? (
            <Button
              variant="outline"
              className="w-full border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] sm:w-auto"
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
          className="w-full rounded-lg border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id} className="bg-[hsl(var(--overlay)/0.3)]">
              {version.title}
            </option>
          ))}
        </select>
        <div className="space-y-1">
          <Label
            htmlFor="version-title"
            className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
          >
            Custom name
          </Label>
          <Input
            id="version-title"
            value={currentVersion?.title ?? ''}
            onChange={(event) => onFieldChange('title', event.target.value)}
            placeholder="Give this practice run a nickname"
            className="bg-[hsl(var(--overlay)/0.35)] border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))]"
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor="version-notes"
            className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
          >
            Session notes
          </Label>
          <Textarea
            id="version-notes"
            value={currentVersion?.notes ?? ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            placeholder="Session notes or goals"
            className="h-24 bg-[hsl(var(--overlay)/0.35)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))]"
          />
        </div>
      </div>
    </>
  );
}
