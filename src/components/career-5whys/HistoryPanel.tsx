import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TRACKS, HISTORY_LIMIT_OPTIONS, type WhySnapshot } from './shared';

function formatSnapshotTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

type HistoryPanelProps = {
  history: WhySnapshot[];
  historyLimit: number;
  historyIsFull: boolean;
  onLimitChange: (limit: number) => void;
  onExportHistory: () => void;
  onClearHistory: () => void;
  onRestoreSnapshot: (snapshot: WhySnapshot) => void;
  onExportSnapshot: (snapshot: WhySnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
};

export default function HistoryPanel({
  history,
  historyLimit,
  historyIsFull,
  onLimitChange,
  onExportHistory,
  onClearHistory,
  onRestoreSnapshot,
  onExportSnapshot,
  onDeleteSnapshot,
}: HistoryPanelProps) {
  return (
    <Card className="border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.86)] text-[hsl(var(--foreground))]">
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Snapshots
          </p>
          <CardTitle className="text-xl">History dashboard</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Stored locally on this device. Up to {historyLimit} entries are kept. New saves will
            replace the oldest entries automatically.
          </p>
          {historyIsFull ? (
            <p className="text-xs text-[hsl(var(--gold))]">
              History is at capacity. Export or clear older snapshots to keep space free.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label
              htmlFor="history-limit"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
            >
              History limit
            </label>
            <select
              id="history-limit"
              value={historyLimit}
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                if (
                  HISTORY_LIMIT_OPTIONS.includes(
                    nextLimit as (typeof HISTORY_LIMIT_OPTIONS)[number]
                  )
                ) {
                  onLimitChange(nextLimit);
                }
              }}
              className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-3 py-2 text-xs uppercase tracking-[0.3em] text-[hsl(var(--foreground))]"
            >
              {HISTORY_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onExportHistory}
              disabled={history.length === 0}
              className="h-10 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            >
              Export all snapshots
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="h-10 rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-2 text-sm text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.15)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--destructive))] focus-visible:ring-offset-2"
            >
              Clear history
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] p-5 text-sm text-[hsl(var(--muted-foreground))]">
            Save a completed reflection to populate your personal archive. Snapshots stay on this
            browser only.
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={`${entry.id}-${entry.timestamp}`}
              className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                    {formatSnapshotTime(entry.timestamp)} \u2022 {TRACKS[entry.track].label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                    {entry.topic || 'Untitled session'}
                  </p>
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    {entry.whyStatement || 'Snapshot saved without a summary.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onRestoreSnapshot(entry)}
                    className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  >
                    Load snapshot
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onExportSnapshot(entry)}
                    className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  >
                    Export
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteSnapshot(entry.id)}
                    className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-2 text-sm text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.15)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--destructive))] focus-visible:ring-offset-2"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
