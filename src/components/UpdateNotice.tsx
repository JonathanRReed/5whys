import * as React from 'react';
import {
  dismissFeatureFailure,
  reportFeatureFailure,
  useFeatureFailure,
} from '../lib/lazy-feature';
import { applyUpdate, type OfflineStatus, subscribe } from '../lib/offline';

/**
 * Says when a newer version of the site has been downloaded and is waiting.
 * It never reloads on its own: someone in the middle of writing decides when.
 */
export default function UpdateNotice() {
  const [status, setStatus] = React.useState<OfflineStatus>('unsupported');
  const failure = useFeatureFailure();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => subscribe(setStatus), []);

  if (failure)
    return (
      <div
        role="alert"
        className="fixed inset-x-3 top-20 z-40 mx-auto max-w-xl space-y-2 rounded-xl bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg print:hidden"
      >
        <p>{failure}</p>
        <button
          type="button"
          onClick={dismissFeatureFailure}
          className="min-h-9 rounded-lg px-3 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Dismiss
        </button>
      </div>
    );
  if (status !== 'update-waiting' || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-20 z-40 mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-popover px-4 py-3 text-sm text-popover-foreground shadow-[0_28px_70px_-32px_hsl(var(--background))] ring-1 ring-border/50 print:hidden"
    >
      <p className="min-w-0 sm:flex-1">
        A new version of the studio is ready. Your saved work stays as it is.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void applyUpdate().catch(reportFeatureFailure)}
          className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Update now
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex min-h-9 items-center rounded-lg px-3 text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Later
        </button>
      </div>
    </div>
  );
}
