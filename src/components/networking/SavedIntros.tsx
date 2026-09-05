import type { NetworkingPracticeVersion } from '../../utils/storage';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type Props = {
  versions: NetworkingPracticeVersion[];
  currentVersionId: string;
  currentVersion: NetworkingPracticeVersion | undefined;
  onVersionSelect: (versionId: string) => void;
  onCreateNewVersion: () => void;
  onDeleteCurrentVersion: () => void;
  onFieldChange: (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => void;
};

/**
 * Saved intros (stored as "versions"): one per scenario by default, more when
 * the student wants to keep a second take. Lives inside the "customize"
 * disclosure so the practice box stays the first thing on the page.
 */
export default function SavedIntros({
  versions,
  currentVersionId,
  currentVersion,
  onVersionSelect,
  onCreateNewVersion,
  onDeleteCurrentVersion,
  onFieldChange,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label
          htmlFor="version"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
        >
          Saved intros
        </Label>
        <select
          id="version"
          value={currentVersionId}
          onChange={(event) => onVersionSelect(event.target.value)}
          className="w-full rounded-lg border border-border/60 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.title}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCreateNewVersion}
            className="border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Start another intro
          </Button>
          {versions.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              onClick={onDeleteCurrentVersion}
            >
              Delete this intro
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label
            htmlFor="version-title"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            Name this intro
          </Label>
          <Input
            id="version-title"
            value={currentVersion?.title ?? ''}
            onChange={(event) => onFieldChange('title', event.target.value)}
            placeholder="e.g., Career fair, short version"
            className="bg-overlay/35 border-border/60 text-foreground focus:border-primary"
          />
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="version-notes"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            Notes for this intro
          </Label>
          <Textarea
            id="version-notes"
            value={currentVersion?.notes ?? ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            placeholder="What you want this version to do differently"
            className="h-20 bg-overlay/35 border-border/60 text-sm text-foreground focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}
