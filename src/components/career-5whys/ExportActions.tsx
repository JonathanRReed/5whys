import * as React from 'react';
import { Button } from '../ui/button';

type ExportActionsProps = {
  onSaveSnapshot: () => void;
  onExport: () => void;
  onReset: () => void;
  canExport: boolean;
  status: string | null;
};

export default function ExportActions({
  onSaveSnapshot,
  onExport,
  onReset,
  canExport,
  status,
}: ExportActionsProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Button
          type="button"
          onClick={onSaveSnapshot}
          disabled={!canExport}
          className="h-12 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Save snapshot
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          disabled={!canExport}
          className="h-12 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Export JSON
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="h-12 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Reset session
        </Button>
      </div>

      {status && (
        <p className="text-center text-sm text-[hsl(var(--primary))]" role="status">
          {status}
        </p>
      )}
    </>
  );
}
