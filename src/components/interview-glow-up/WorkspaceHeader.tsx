import * as React from 'react';
import { clearAllData, exportJSON } from '../../lib/glowup-store';
import ConfirmButton from '../shared/ConfirmButton';

type Props = {
  onClearData: () => void;
};

const EXPORT_FEEDBACK_MS = 2000;

export default function WorkspaceHeader({ onClearData }: Props) {
  const [exported, setExported] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClear = () => {
    clearAllData();
    onClearData();
  };

  const handleExport = () => {
    exportJSON();
    setExported(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setExported(false);
    }, EXPORT_FEEDBACK_MS);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {exported ? 'Exported JSON! Check your downloads.' : ''}
      </div>
      {/* The page's PlateHeader carries the title; this row owns the actions. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-overlay/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          {exported ? (
            <>
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-emerald-500 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Exported JSON</span>
            </>
          ) : (
            'Export JSON'
          )}
        </button>
        <ConfirmButton confirmLabel="Delete every role, story, and packet?" onConfirm={handleClear}>
          Clear data
        </ConfirmButton>
      </div>
    </div>
  );
}
