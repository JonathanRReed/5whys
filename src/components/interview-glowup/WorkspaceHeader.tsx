import * as React from 'react';
import { exportJSON, clearAllData, loadData } from '../../lib/glowup-store';

type Props = {
  onClearData: () => void;
};

export default function WorkspaceHeader({ onClearData }: Props) {
  const handleClear = () => {
    if (confirm('Clear all data? This cannot be undone.')) {
      clearAllData();
      onClearData();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Interview Workspace
        </h1>
        <p className="mt-1 text-muted-foreground">
          Decode → Build Stories → Save to Vault → Create Packet
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={exportJSON}
          className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] hover:text-foreground"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.15)]"
        >
          Clear Data
        </button>
      </div>
    </div>
  );
}
