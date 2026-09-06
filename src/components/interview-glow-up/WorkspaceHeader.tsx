import { clearAllData, exportJSON } from '../../lib/glowup-store';
import ConfirmButton from '../shared/ConfirmButton';

type Props = {
  onClearData: () => void;
};

export default function WorkspaceHeader({ onClearData }: Props) {
  // The button asks in place before this runs.
  const handleClear = () => {
    clearAllData();
    onClearData();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      {/* The page's PlateHeader carries the title; this row owns the actions. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={exportJSON}
          className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-overlay/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Export JSON
        </button>
        <ConfirmButton confirmLabel="Delete every role, story, and packet?" onConfirm={handleClear}>
          Clear data
        </ConfirmButton>
      </div>
    </div>
  );
}
