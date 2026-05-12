import * as React from 'react';
import { Button } from '../ui/button';

type ExportActionsProps = {
  onSaveSnapshot: () => void;
  onExport: () => void;
  onReset: () => void;
  canExport: boolean;
  status: string | null;
};

export default function ExportActions({ onSaveSnapshot, onExport, onReset, canExport, status }: ExportActionsProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Button
          type="button"
          onClick={onSaveSnapshot}
          disabled={!canExport}
          className="h-12 rounded-xl border border-[hsl(var(--love)/0.6)] bg-[hsl(var(--love)/0.2)] text-[hsl(var(--love-foreground))] hover:bg-[hsl(var(--love)/0.4)]"
        >
          Save snapshot
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          disabled={!canExport}
          className="h-12 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.2)]"
        >
          Export JSON
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="h-12 rounded-xl border border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
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
