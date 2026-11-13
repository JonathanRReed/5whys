import * as React from 'react';
import type { LeftOff } from '../lib/career-bridge';
import { loadFeature, reportFeatureFailure } from '../lib/lazy-feature';
import PathCard from './shared/PathCard';

/** Keys that say nothing about saved work: display settings only. */
const SETTINGS = new Set(['career-tools-theme', 'career-tools-font']);

/**
 * For someone coming back: the last thing they saved and the way back into
 * it, above the list a first-time visitor chooses from. On a device with no
 * saved work it renders nothing and loads nothing.
 */
export default function HomeReturn() {
  // Hydrate from empty state: saved work is read after mount, never written.
  const [leftOff, setLeftOff] = React.useState<LeftOff | null>(null);
  const [returning, setReturning] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let hasWork = false;
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && !SETTINGS.has(key)) hasWork = true;
      }
    } catch {
      hasWork = false;
    }
    if (!hasWork) return undefined;
    setReturning(true);
    // The reader is only fetched for a visitor who has something to read.
    void loadFeature(import('../lib/career-bridge'))
      .then(({ readCareerDashboard }) => {
        if (!cancelled) setLeftOff(readCareerDashboard().leftOff);
      })
      .catch(reportFeatureFailure);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!returning) return null;

  // The link opens the role the work belongs to. The role is made current
  // first, so the page that opens shows that work and not another job's.
  const openSavedRole = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const roleId = leftOff?.roleId;
    if (!roleId || !leftOff) return;
    event.preventDefault();
    const href = leftOff.href;
    void loadFeature(import('../lib/glowup-store'))
      .then(({ openRole }) => openRole(roleId))
      .catch(reportFeatureFailure)
      .finally(() => window.location.assign(href));
  };

  return (
    <div className="mb-12 space-y-4" data-testid="home-return">
      {leftOff && (
        <section
          aria-labelledby="home-left-off"
          className="rounded-2xl border border-foam/35 bg-foam/8 p-5 sm:p-6"
        >
          <h2 id="home-left-off" className="eyebrow text-foam">
            Welcome back. Where you left off
          </h2>
          <p className="mt-2 text-base leading-relaxed text-foreground wrap-anywhere">
            {leftOff.what}
            <span className="text-muted-foreground"> · {leftOff.tool}</span>
          </p>
          {leftOff.next && (
            <p className="mt-1 text-sm text-muted-foreground">Next: {leftOff.next}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={leftOff.href}
              onClick={openSavedRole}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Pick it up
            </a>
            <a
              href="/dashboard/"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              See everything on the dashboard
            </a>
          </div>
        </section>
      )}
      {/* The guided path, when one is under way. */}
      <PathCard />
    </div>
  );
}
