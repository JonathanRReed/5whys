import { Check } from 'lucide-react';
import * as React from 'react';
import {
  BACKUP_SIZE_MESSAGE,
  type BackupSummary,
  backupExclusions,
  describeExclusions,
  downloadBackup,
  MAX_BACKUP_BYTES,
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

function describe(summary: BackupSummary, stores: StudioBackup['stores']): string {
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
  if (summary.applications)
    parts.push(
      `${summary.applications} tracked ${summary.applications === 1 ? 'application' : 'applications'}`
    );
  if (summary.applicationDesks)
    parts.push(
      `${summary.applicationDesks} application ${summary.applicationDesks === 1 ? 'desk' : 'desks'}`
    );
  if (summary.hasResumeDocument) parts.push('your structured resume');
  if (summary.hasProfile) parts.push('your career profile');
  const otherStores: [keyof typeof stores, boolean, string][] = [
    ['career-why-session-v2', true, 'your current reflection'],
    ['career-why-history-limit', true, 'your reflection history limit'],
    ['networking-practice-versions', true, 'your saved introductions'],
    ['networking-practice-draft', true, 'your networking draft'],
    ['career-why-history', !summary.reflections, 'your reflection history'],
    ['resume-game-session-v2', !summary.resumeBullets, 'your resume session'],
    ['networking-practice-sessions', !summary.practiceRounds, 'your practice history'],
    ['interview-glow-up-data', !summary.stories, 'your interview preparation'],
    ['career-applications', !summary.applications, 'your application list'],
    ['career-application-desk', !summary.applicationDesks, 'your application desks'],
  ];
  for (const [key, include, label] of otherStores) {
    if (include && stores[key] !== undefined) parts.push(label);
  }
  if (parts.length === 0) return 'nothing yet';
  return parts.join(', ');
}

// The dashboard can remount this card when its first saved work arrives.
let importNotice: string | null = null;

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
  const [exported, setExported] = React.useState(false);
  const [exclusions, setExclusions] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const importBusy = React.useRef(false);
  const reading = React.useRef(false);
  const exportTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (importNotice) {
      setStatus(importNotice);
      importNotice = null;
    }
  });

  React.useEffect(() => {
    let cancelled = false;
    void backupExclusions().then((leftOut) => {
      if (!cancelled) setExclusions(describeExclusions(leftOut));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (exportTimer.current) clearTimeout(exportTimer.current);
    };
  }, []);

  const handleExport = async () => {
    const backup = await downloadBackup();
    setExclusions(describeExclusions(await backupExclusions()));
    setError(null);
    setStatus(
      `Exported ${describe(summarizeBackup(backup), backup.stores)}. Check your downloads.`
    );
    setExported(true);
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => {
      setExported(false);
    }, 2000);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importBusy.current || reading.current) return;
    reading.current = true;
    setError(null);
    setStatus(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error(BACKUP_SIZE_MESSAGE);
      const backup = parseBackup(await file.text());
      setPending(backup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      reading.current = false;
    }
  };

  const finishImport = async (replace: boolean) => {
    if (!pending || importBusy.current || reading.current) return;
    importBusy.current = true;
    setImporting(true);
    setError(null);
    setStatus(null);
    let written: Awaited<ReturnType<typeof restoreBackup>>;
    try {
      written = await restoreBackup(pending, replace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that file in this browser.');
      return;
    } finally {
      importBusy.current = false;
      setImporting(false);
    }
    setPending(null);
    const message =
      written.length === 0
        ? 'That file had nothing to bring in.'
        : `Brought in ${describe(summarizeBackup(pending), pending.stores)}.`;
    setStatus(message);
    importNotice = message;
    if (written.length > 0) onRestored?.();
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
          <p className="mt-1 text-xs text-muted-foreground">
            The file holds everything you wrote, in plain text that anyone can open. Keep it
            somewhere private.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            <Check
              aria-hidden="true"
              className={cn('size-4 shrink-0 text-foam', !exported && 'invisible')}
            />
            Export my work
          </button>
          <button
            type="button"
            disabled={importing}
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
            // The "Import a file" button opens it; a second, invisible Tab stop helps no one.
            tabIndex={-1}
            className="sr-only"
            aria-label="Import a 5 Whys Career Studio export file"
          />
        </div>
      </div>
      {exclusions && <p className="mt-2 text-sm text-muted-foreground">{exclusions}</p>}

      {pending && (
        <div className="mt-4 rounded-xl border border-gold/40 bg-gold/8 p-4 text-sm">
          <p className="text-foreground">
            This file holds {describe(summarizeBackup(pending), pending.stores)}
            {pending.exportedAt ? `, exported ${pending.exportedAt.slice(0, 10)}` : ''}. How should
            it come in?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={importing}
              onClick={() => finishImport(false)}
              className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Add to what is here
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => finishImport(true)}
              className="rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
            >
              Replace everything here
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => setPending(null)}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            "Add" overwrites only the tools the file contains. "Replace" also removes the studio's
            saved work that is missing from the file.
          </p>
        </div>
      )}

      <div className="mt-3 min-h-5 text-sm">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-foam">
          {status}
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
