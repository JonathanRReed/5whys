import * as React from 'react';
import {
  type ApplicationDeskData,
  createDefaultDeskData,
  loadApplicationDesks,
  saveApplicationDesks,
  setQualification,
} from '../../lib/application-desk';
import { loadApplications, type TrackedApplication } from '../../lib/applications';
import { type DecodedRole, loadData } from '../../lib/glowup-store';
import { describeCoverage, requirementsFromBullets, summarizeCoverage } from '../../lib/posting';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

type Target = { application: TrackedApplication; role: DecodedRole };

type Props = {
  /** The resume as it currently reads in the editor. */
  resumeText: string;
};

/**
 * The resume against one application's confirmed requirements. Each row shows
 * the requirement and the resume line that backs it, or says nothing does.
 * The summary is a count with its denominator; there is no match percentage,
 * and a missing requirement is never a word to paste in.
 */
export default function PostingMatch({ resumeText }: Props) {
  const [targets, setTargets] = React.useState<Target[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [desks, setDesks] = React.useState<ApplicationDeskData>(createDefaultDeskData);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const apps = loadApplications();
    const roles = new Map(loadData().roles.map((role) => [role.id, role]));
    const found = apps.applications.flatMap((application) => {
      const role = application.roleId ? roles.get(application.roleId) : undefined;
      return role?.bullets.some((b) => b.confirmed) ? [{ application, role }] : [];
    });
    setTargets(found);
    setDesks(loadApplicationDesks());
    const wanted = new URLSearchParams(window.location.search).get('application');
    setSelected(
      found.find((t) => t.application.id === wanted)?.application.id ??
        found.find((t) => t.application.id === apps.activeId)?.application.id ??
        found[0]?.application.id ??
        null
    );
    setReady(true);
  }, []);

  const target = targets.find((t) => t.application.id === selected) ?? null;
  const coverage = React.useMemo(
    () =>
      target && resumeText.trim()
        ? summarizeCoverage(requirementsFromBullets(target.role.bullets), resumeText)
        : null,
    [target, resumeText]
  );

  if (!ready || !resumeText.trim()) return null;

  if (!targets.length) {
    return (
      <section aria-labelledby="posting-match-title" className="space-y-2">
        <h2 id="posting-match-title" className="text-2xl font-semibold">
          Match it to a posting
        </h2>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          Paste a job description on the{' '}
          <a className="underline underline-offset-2 hover:text-foreground" href="/application/">
            Application Desk
          </a>{' '}
          and confirm what it asks for. This section will then show, requirement by requirement,
          which lines of your resume back it up.
        </p>
      </section>
    );
  }

  if (!target || !coverage) return null;
  const appId = target.application.id;
  const planned = new Map(
    (desks.desks[appId]?.qualifications ?? []).map((row) => [row.requirementId, row.status])
  );

  const markNotYet = (requirementId: string) => {
    const next = setQualification(loadApplicationDesks(), appId, requirementId, {
      status: 'not-yet',
    });
    saveApplicationDesks(next);
    setDesks(next);
  };

  return (
    <section aria-labelledby="posting-match-title" className="space-y-5">
      <div className="space-y-2">
        <h2 id="posting-match-title" className="text-2xl font-semibold">
          Match it to a posting
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {targets.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Posting</span>
              <select
                value={appId}
                onChange={(event) => setSelected(event.target.value)}
                className="h-9 max-w-[18rem] rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {targets.map(({ application }) => (
                  <option key={application.id} value={application.id}>
                    {application.title}
                    {application.company ? `, ${application.company}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              {target.application.title}
              {target.application.company ? ` at ${target.application.company}` : ''}
            </p>
          )}
        </div>
        <p className="text-base font-medium text-foreground" data-testid="match-summary">
          {describeCoverage(coverage)}
        </p>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          Evidence means a line of your resume mentions what the requirement asks for. If you have
          the experience but the resume does not say so, write a bullet for it. If you do not have
          it yet, plan for it. Do not add the word without the work.
        </p>
      </div>

      <ul className="space-y-2">
        {coverage.rows.map((row) => {
          const excerpt = row.excerpts[0];
          const status = planned.get(row.requirement.id);
          return (
            <li
              key={row.requirement.id}
              className={cn(
                'grid gap-2 rounded-xl border p-4 md:grid-cols-2 md:gap-6',
                row.state === 'evidence' ? 'border-foam/40' : 'border-border/40'
              )}
            >
              <p className="text-sm leading-relaxed text-foreground">{row.requirement.text}</p>
              <div className="min-w-0 space-y-2 text-sm">
                {row.state === 'evidence' && excerpt ? (
                  <p className="leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foam">In your resume: </span>"
                    {excerpt.text.trim()}"
                    {excerpt.listedOnly && (
                      <span className="block text-xs">
                        This is in a skills list. A bullet showing you using it is stronger.
                      </span>
                    )}
                  </p>
                ) : row.state === 'none' ? (
                  <>
                    <p className="text-muted-foreground">
                      Nothing in your resume mentions this yet.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="xs" variant="outline">
                        <a href={`/application/?id=${encodeURIComponent(appId)}&station=bullets`}>
                          I have this: write a bullet
                        </a>
                      </Button>
                      {status === 'not-yet' ? (
                        <a
                          className="text-xs underline underline-offset-2"
                          href={`/application/?id=${encodeURIComponent(appId)}&station=qualifications`}
                        >
                          Marked not yet. Plan for it on the desk.
                        </a>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => markNotYet(row.requirement.id)}
                        >
                          Not yet
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    This one is not something a resume line can be checked against. Judge it
                    yourself.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
