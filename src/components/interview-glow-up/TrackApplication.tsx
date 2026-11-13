import * as React from 'react';
import {
  addApplication,
  loadApplications,
  saveApplications,
  type TrackedApplication,
  updateApplication,
} from '../../lib/applications';
import type { DecodedRole } from '../../lib/glowup-store';

const same = (a: string, b: string) =>
  a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * An application tracked elsewhere (on the desk, or from an offer in Pay)
 * that is this role but not linked to it: same title, and the same company
 * when both name one. Linking it, instead of adding a second, keeps the
 * dashboard from saying this posting was never decoded.
 */
export function unlinkedMatch(
  applications: readonly TrackedApplication[],
  role: Pick<DecodedRole, 'jobTitle' | 'company'>
): TrackedApplication | null {
  if (!role.jobTitle.trim()) return null;
  return (
    applications.find(
      (a) =>
        !a.roleId &&
        same(a.title, role.jobTitle) &&
        (!a.company.trim() || !role.company.trim() || same(a.company, role.company))
    ) ?? null
  );
}

/**
 * Turns the decoded role into a tracked application on the dashboard. The
 * dashboard reads the applications store on its next visit; once linked, the
 * role's title and company are read live from this record, so edits here
 * never go stale there.
 */
export default function TrackApplication({ role }: { role: DecodedRole }) {
  const [tracked, setTracked] = React.useState(false);
  const [match, setMatch] = React.useState<TrackedApplication | null>(null);

  const { id, jobTitle, company } = role;
  React.useEffect(() => {
    const { applications } = loadApplications();
    const linked = applications.some((a) => a.roleId === id);
    setTracked(linked);
    setMatch(linked ? null : unlinkedMatch(applications, { jobTitle, company }));
  }, [id, jobTitle, company]);

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

  if (match) {
    return (
      <button
        type="button"
        onClick={() => {
          // Read fresh: the dashboard or desk may have changed the list since.
          const latest = loadApplications();
          if (latest.applications.some((a) => a.id === match.id)) {
            saveApplications(updateApplication(latest, match.id, { roleId: role.id }));
          }
          setTracked(true);
        }}
        className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
      >
        Link to "{match.title}" on your dashboard
      </button>
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
