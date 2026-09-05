import * as React from 'react';
import {
  type BackupSummary,
  downloadBackup,
  parseBackup,
  restoreBackup,
  type StudioBackup,
  summarizeBackup,
} from '../lib/studio-backup';
import { cn } from '../lib/utils';

type Props = {
  /** Called after an import so the page can re-read storage. */
  onRestored?: () => void;
  className?: string;
};

function describe(summary: BackupSummary): string {
  const parts: string[] = [];
  if (summary.reflections)
    parts.push(
      `${summary.reflections} ${summary.reflections === 1 ? 'reflection' : 'reflections'}`
    );
  if (summary.resumeBullets)
    parts.push(
      `${summary.resumeBullets} resume ${summary.resumeBullets === 1 ? 'bullet' : 'bullets'}`
    );
  if (summary.practiceRounds)
    parts.push(
      `${summary.practiceRounds} practice ${summary.practiceRounds === 1 ? 'round' : 'rounds'}`
    );
  if (summary.stories)
    parts.push(`${summary.stories} interview ${summary.stories === 1 ? 'story' : 'stories'}`);
  if (parts.length === 0) return summary.hasProfile ? 'only your career profile' : 'nothing yet';
  return parts.join(', ');
}

/**
 * Export everything the four tools saved as one file, and bring such a file
 * back on another device. Lives on the dashboard because that is the one
 * page that already reads every store.
 */
export default function BackupControls({ onRestored, className }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<StudioBackup | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = () => {
    const backup = downloadBackup();
    setError(null);
    setStatus(`Exported ${describe(summarizeBackup(backup))}. Check your downloads.`);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      const backup = parseBackup(await file.text());
      setPending(backup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const finishImport = (replace: boolean) => {
    if (!pending) return;
    const written = restoreBackup(pending, replace);
    setPending(null);
    setStatus(
      written.length === 0
        ? 'That file had nothing to bring in.'
        : `Brought in ${describe(summarizeBackup(pending))}.`
    );
    onRestored?.();
  };

  return (
    <div className={cn('rounded-2xl border border-border/35 bg-overlay/15 p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your work</p>
          <p className="mt-1 text-sm text-foreground">
            Everything stays in this browser. To keep a copy, or move it to another device, export
            it as one file and import it there.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Export my work
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Import a file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="sr-only"
            aria-label="Import a 5 Whys Career Studio export file"
          />
        </div>
      </div>

      {pending && (
        <div className="mt-4 rounded-xl border border-gold/40 bg-gold/8 p-4 text-sm">
          <p className="text-foreground">
            This file holds {describe(summarizeBackup(pending))}
            {pending.exportedAt ? `, exported ${pending.exportedAt.slice(0, 10)}` : ''}. How should
            it come in?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => finishImport(false)}
              className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Add to what is here
            </button>
            <button
              type="button"
              onClick={() => finishImport(true)}
              className="rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
            >
              Replace everything here
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            "Add" overwrites only the tools the file contains. "Replace" clears the studio's saved
            work in this browser first.
          </p>
        </div>
      )}

      <div aria-live="polite" className="mt-3 min-h-5 text-sm">
        {status && <p className="text-foam">{status}</p>}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </div>
  );
}
