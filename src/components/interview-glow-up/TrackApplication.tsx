import * as React from 'react';
import { addApplication, loadApplications, saveApplications } from '../../lib/applications';
import type { DecodedRole } from '../../lib/glowup-store';

/**
 * Turns the decoded role into a tracked application on the dashboard. The
 * dashboard reads the applications store on its next visit; once linked, the
 * role's title and company are read live from this record, so edits here
 * never go stale there.
 */
export default function TrackApplication({ role }: { role: DecodedRole }) {
  const [tracked, setTracked] = React.useState(false);

  React.useEffect(() => {
    setTracked(loadApplications().applications.some((a) => a.roleId === role.id));
  }, [role.id]);

  if (tracked) {
    return (
      <a
        href="/dashboard/"
        className="rounded-lg border border-foam/30 bg-foam/10 px-3 py-2 text-sm text-foam transition-colors hover:bg-foam/20 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
      >
        Tracked on your dashboard
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const { data } = addApplication(loadApplications(), {
          title: role.jobTitle || 'Untitled role',
          company: role.company,
          roleId: role.id,
        });
        saveApplications(data);
        setTracked(true);
      }}
      className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
    >
      Track this application
    </button>
  );
}
