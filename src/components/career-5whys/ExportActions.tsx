import ConfirmButton from '../shared/ConfirmButton';
import { Button } from '../ui/button';

type ExportActionsProps = {
  onSaveSnapshot: () => void;
  onExport: () => void;
  onReset: () => void;
  /** True when the session holds answers a reset would discard. */
  hasWork: boolean;
  canExport: boolean;
  status: string | null;
};

export default function ExportActions({
  onSaveSnapshot,
  onExport,
  onReset,
  hasWork,
  canExport,
  status,
}: ExportActionsProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Button
          type="button"
          onClick={onSaveSnapshot}
          data-guide="why-save"
          disabled={!canExport}
          aria-describedby={canExport ? undefined : 'why-save-needs'}
          className="h-12 rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Save snapshot
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          disabled={!canExport}
          aria-describedby={canExport ? undefined : 'why-save-needs'}
          className="h-12 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Export JSON
        </Button>
        {hasWork ? (
          <ConfirmButton
            tone="neutral"
            confirmLabel="Clear all five answers?"
            onConfirm={onReset}
            className="h-12 w-full"
          >
            Reset session
          </ConfirmButton>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled
            className="h-12 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground opacity-50"
          >
            Reset session
          </Button>
        )}
      </div>

      {!canExport && (
        <p id="why-save-needs" className="text-center text-xs text-muted-foreground">
          Answer the first four questions to save or export.
        </p>
      )}
      {/* Always in the page, so each new message is read when it arrives. */}
      <p className={status ? 'text-center text-sm text-primary' : 'sr-only'} role="status">
        {status}
      </p>
    </>
  );
}
