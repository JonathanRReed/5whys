import { clearAllData, exportJSON } from '../../lib/glowup-store';

type Props = {
  onClearData: () => void;
};

export default function WorkspaceHeader({ onClearData }: Props) {
  const handleClear = () => {
    if (confirm('Clear every role, story, and packet from this browser? This cannot be undone.')) {
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
          Decode the job, build stories that prove the skills it tests, then pack the best five for
          the call.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={exportJSON}
          className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-overlay/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
        >
          Clear data
        </button>
      </div>
    </div>
  );
}
