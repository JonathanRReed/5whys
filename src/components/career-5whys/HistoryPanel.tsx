import ConfirmButton from '../shared/ConfirmButton';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { HISTORY_LIMIT_OPTIONS, TRACKS, type WhySnapshot } from './shared';

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
    <Card className="border-border/50 bg-card/86 text-foreground">
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Snapshots</p>
          <CardTitle className="text-xl">History dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">
            Stored locally on this device. Up to {historyLimit} entries are kept. New saves will
            replace the oldest entries automatically.
          </p>
          {historyIsFull ? (
            <p className="text-xs text-gold">
              History is at capacity. Export or clear older snapshots to keep space free.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label
              htmlFor="history-limit"
              className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
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
              className="rounded-xl border border-border/50 bg-overlay/20 px-3 py-2 text-xs uppercase tracking-[0.3em] text-foreground"
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
              className="h-10 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Export all snapshots
            </Button>
            {history.length > 0 && (
              <ConfirmButton
                confirmLabel={`Delete ${history.length === 1 ? 'the snapshot' : `all ${history.length} snapshots`}?`}
                onConfirm={onClearHistory}
                className="h-10"
              >
                Clear history
              </ConfirmButton>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-overlay/10 p-5 text-sm text-muted-foreground">
            Save a completed reflection to populate your personal archive. Snapshots stay on this
            browser only.
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={`${entry.id}-${entry.timestamp}`}
              className="rounded-2xl border border-border/50 bg-overlay/20 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {formatSnapshotTime(entry.timestamp)} \u2022 {TRACKS[entry.track].label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {entry.topic || 'Untitled session'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.whyStatement || 'Snapshot saved without a summary.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onRestoreSnapshot(entry)}
                    className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  >
                    Load snapshot
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onExportSnapshot(entry)}
                    className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  >
                    Export
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteSnapshot(entry.id)}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
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
