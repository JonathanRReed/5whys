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
import {
  type CoverageState,
  describeCoverage,
  describeParts,
  hiringCondition,
  requirementsFromBullets,
  summarizeCoverage,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

/** Every state is named in words; colour only repeats it. */
const STATE_LABEL: Record<CoverageState, { text: string; tone: string }> = {
  evidence: { text: 'Shown', tone: 'text-foam' },
  partial: { text: 'Partly shown', tone: 'text-gold' },
  none: { text: 'Not mentioned yet', tone: 'text-muted-foreground' },
  'not-checkable': { text: 'For you to judge', tone: 'text-muted-foreground' },
};

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
  const partly = coverage.partialCount;
  const missing = coverage.withoutEvidenceCount - coverage.partialCount;
  const maybe = coverage.rows.filter(
    (row) => (row.state === 'none' || row.state === 'partial') && row.nearMisses.length > 0
  ).length;
  const planned = new Map(
    (desks.desks[appId]?.qualifications ?? []).map((row) => [row.requirementId, row.status])
  );

  // One tap only fills an empty row. A mark made on the desk ("Have it",
  // "Maybe") is the visitor's own and is never replaced from here.
  const markNotYet = (requirementId: string) => {
    const current = loadApplicationDesks();
    const existing = current.desks[appId]?.qualifications.find(
      (row) => row.requirementId === requirementId
    );
    if (existing && existing.status !== 'unset') {
      setDesks(current);
      return;
    }
    const next = setQualification(current, appId, requirementId, { status: 'not-yet' });
    saveApplicationDesks(next);
    setDesks(next);
  };
  const deskLink = `/application/?id=${encodeURIComponent(appId)}&station=qualifications`;

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
          {coverage.confirmedCount === 0 && coverage.conditions.length > 0
            ? 'Every confirmed line is a condition of the job, listed below.'
            : describeCoverage(coverage)}
        </p>
        <p className="text-sm text-foreground" data-testid="match-breakdown">
          {[
            partly > 0 && `${partly} partly shown`,
            missing > 0 && `${missing} not mentioned yet`,
            coverage.notCheckableCount > 0 && `${coverage.notCheckableCount} for you to judge`,
          ]
            .filter(Boolean)
            .join(', ')}
          {partly + missing + coverage.notCheckableCount > 0 ? '.' : ''}
          {maybe > 0 &&
            ` ${maybe === 1 ? 'One of those' : `${maybe} of those`} may already be in your resume in other words.`}
        </p>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          Shown means a line of your resume names what the requirement asks for. A low count is
          common when your experience is real but worded differently
          {maybe > 0 ? ': look for "You may already have this" below' : ''}. Use the posting's words
          only where they are true of what you did.
        </p>
      </div>

      <ul className="space-y-2">
        {coverage.rows.map((row) => {
          const excerpt = row.excerpts[0];
          const status = planned.get(row.requirement.id);
          const label = STATE_LABEL[row.state];
          const parts = describeParts(row);
          return (
            <li
              key={row.requirement.id}
              className={cn(
                'grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-6',
                row.state === 'evidence' ? 'border-foam/45' : 'border-border/40'
              )}
            >
              <div className="min-w-0 space-y-1.5">
                <p className={cn('text-xs font-semibold', label.tone)}>{label.text}</p>
                <p className="text-sm leading-relaxed text-foreground">{row.requirement.text}</p>
              </div>
              <div className="min-w-0 space-y-3 text-sm">
                {row.state === 'evidence' && excerpt && (
                  <p className="leading-relaxed text-muted-foreground">
                    <span className="text-foreground">Your line: </span>"{excerpt.text.trim()}"
                    {excerpt.listedOnly && (
                      <span className="mt-1 block text-xs">
                        This is in a skills list. A bullet showing you using it is stronger.
                      </span>
                    )}
                  </p>
                )}

                {row.state === 'partial' && (
                  <dl className="space-y-1 leading-relaxed">
                    <div>
                      <dt className="inline text-foreground">Shown: </dt>
                      <dd className="inline text-muted-foreground">{parts.shown.join('; ')}.</dd>
                    </div>
                    {excerpt && (
                      <div>
                        <dt className="inline text-foreground">Your line: </dt>
                        <dd className="inline text-muted-foreground">"{excerpt.text.trim()}"</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-foreground">Not shown yet: </dt>
                      <dd className="inline text-muted-foreground">{parts.notShown.join('; ')}.</dd>
                    </div>
                  </dl>
                )}

                {row.state === 'none' && row.nearMisses.length === 0 && (
                  <p className="text-muted-foreground">Nothing in your resume mentions this yet.</p>
                )}

                {row.state === 'not-checkable' && (
                  <p className="text-muted-foreground">
                    {row.note ??
                      'A resume line cannot be checked against this one. Judge it yourself, and be ready to show it in the interview.'}
                  </p>
                )}

                {row.state !== 'not-checkable' && row.note && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{row.note}</p>
                )}

                {(row.state === 'none' || row.state === 'partial') &&
                  row.nearMisses.map((miss) => (
                    <div
                      key={miss.start}
                      className="space-y-2 rounded-lg bg-gold/10 p-3 leading-relaxed"
                      data-testid="near-miss"
                    >
                      <p className="font-medium text-foreground">You may already have this.</p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground">Your line: </span>"
                        {miss.text.trim().replace(/^[-•*]\s*/, '')}"
                      </p>
                      {miss.postingTerms.length > 0 && (
                        <p className="text-muted-foreground">
                          If that is the same work, the posting calls it{' '}
                          {miss.postingTerms.map((term, index) => (
                            <React.Fragment key={term}>
                              {index > 0 &&
                                (index === miss.postingTerms.length - 1 ? ' and ' : ', ')}
                              <strong className="font-semibold text-foreground">{term}</strong>
                            </React.Fragment>
                          ))}
                          .
                        </p>
                      )}
                    </div>
                  ))}

                {(row.state === 'none' || row.state === 'partial') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="xs" variant="outline">
                      <a
                        href={`/application/?id=${encodeURIComponent(appId)}&station=bullets&requirement=${encodeURIComponent(row.requirement.id)}`}
                      >
                        I have this: write a bullet
                      </a>
                    </Button>
                    {status === 'not-yet' ? (
                      <a className="text-xs underline underline-offset-2" href={deskLink}>
                        Marked not yet. Plan for it on the desk.
                      </a>
                    ) : status === 'have' || status === 'maybe' ? (
                      <a className="text-xs underline underline-offset-2" href={deskLink}>
                        {status === 'have' ? 'Marked have it' : 'Marked maybe'} on the desk.
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
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {coverage.conditions.length > 0 && (
        <div className="space-y-3" data-testid="match-conditions">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Conditions of the job</h3>
            <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              These are about who may be hired, not what you can do. They are not counted above, and
              they do not belong on a resume.
            </p>
          </div>
          <ul className="space-y-2">
            {coverage.conditions.map((requirement) => {
              const condition = hiringCondition(requirement.text);
              return (
                <li
                  key={requirement.id}
                  className="grid gap-3 rounded-xl border border-border/40 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-6"
                >
                  <div className="min-w-0 space-y-1.5">
                    {condition && (
                      <p className="text-xs font-semibold text-muted-foreground">
                        {condition.label}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-foreground">{requirement.text}</p>
                  </div>
                  {condition && (
                    <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">
                      {condition.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
