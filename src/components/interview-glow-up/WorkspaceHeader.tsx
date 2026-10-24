import * as React from 'react';
import { clearAllData, exportJSON } from '../../lib/glowup-store';
import ConfirmButton from '../shared/ConfirmButton';

type Props = {
  onClearData: () => void;
};

const EXPORT_FEEDBACK_MS = 2000;

export default function WorkspaceHeader({ onClearData }: Props) {
  const [exportCount, setExportCount] = React.useState(0);
  const [showExportFeedback, setShowExportFeedback] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleExport = () => {
    exportJSON();
    setExportCount((count) => count + 1);
    setShowExportFeedback(true);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowExportFeedback(false);
      timeoutRef.current = null;
    }, EXPORT_FEEDBACK_MS);
  };

  // The button asks in place before this runs.
  const handleClear = () => {
    clearAllData();
    onClearData();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <div
        className="text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {showExportFeedback && (
          <>
            <span className="sr-only">Export {exportCount}. </span>
            <span>Download started.</span>
          </>
        )}
      </div>
      {/* The page's PlateHeader carries the title; this row owns the actions. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
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
