import * as React from 'react';
import {
  addActionStep,
  type QualificationStatus,
  removeActionStep,
  setQualification,
  updateActionStep,
} from '../../lib/application-desk';
import {
  type CoverageRow,
  describeCoverage,
  describeParts,
  type PostingRequirement,
  type PostingSection,
  requirementsFromBullets,
  summarizeCoverage,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { DeskState } from './useDesk';

const STATUS: { value: QualificationStatus; label: string }[] = [
  { value: 'have', label: 'Have it' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not-yet', label: 'Not yet' },
];

/** Rows are grouped the way the posting groups them. */
const GROUPS: { section: PostingSection; label: string }[] = [
  { section: 'required', label: 'Required' },
  { section: 'preferred', label: 'Preferred' },
  { section: 'responsibility', label: 'What you would do' },
  { section: 'unclassified', label: 'Not sorted yet' },
];

/** What the resume shows for one row, in plain text. */
function Evidence({ row }: { row: CoverageRow }) {
  const excerpt = row.excerpts[0];
  const parts = describeParts(row);
  return (
    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      {row.state === 'evidence' && excerpt && (
        <p>
          <span className="text-foam">In your resume: </span>"{excerpt.text.trim()}"
          {excerpt.listedOnly && ' (listed as a skill, not shown in use)'}
        </p>
      )}
      {row.state === 'partial' && (
        <>
          <p>Shown: {parts.shown.join('; ')}.</p>
          {excerpt && <p>In your resume: "{excerpt.text.trim()}"</p>}
          <p>Not shown yet: {parts.notShown.join('; ')}.</p>
        </>
      )}
      {row.state === 'none' && <p>Nothing in your resume mentions this yet.</p>}
      {row.note && <p>{row.note}</p>}
      {row.nearMisses.map((miss) => (
        <div key={miss.start} className="space-y-0.5">
          <p>This line may already say it, in other words: "{miss.text.trim()}"</p>
          <p>
            If it is the same work, say it with the posting's words: {miss.postingTerms.join(', ')}.
          </p>
        </div>
      ))}
    </div>
  );
}

const PLAN_PROMPT: Record<QualificationStatus, string> = {
  have: 'How will you show it? A bullet, a project, a story for the interview.',
  maybe: 'What would make this a yes? What evidence do you have so far?',
  'not-yet': 'How could you get it? A class, a project, a certificate, a volunteer role.',
  unset: 'Mark where you stand first.',
};

export default function QualificationsStation({ desk }: { desk: DeskState }) {
  const { application, role, resumeText, changeDesks } = desk;
  const [step, setStep] = React.useState('');
  const [due, setDue] = React.useState('');

  const requirements = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []).filter((r) => r.status === 'confirmed'),
    [role?.bullets]
  );
  const coverage = React.useMemo(
    () => (resumeText.trim() ? summarizeCoverage(requirements, resumeText) : null),
    [requirements, resumeText]
  );
  if (!application) return null;
  const appId = application.id;
  const rows = new Map(desk.desk.qualifications.map((row) => [row.requirementId, row]));
  const evidence = new Map(coverage?.rows.map((row) => [row.requirement.id, row]) ?? []);
  const tally = { have: 0, maybe: 0, 'not-yet': 0, unset: 0 };
  for (const requirement of requirements) tally[rows.get(requirement.id)?.status ?? 'unset'] += 1;

  if (!requirements.length) {
    return (
      <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        Confirm some requirements on the Posting station first. Each one becomes a row here, where
        you mark whether you have it and how you will show it or get it.
      </p>
    );
  }

  const renderRow = (requirement: PostingRequirement) => {
    const row = rows.get(requirement.id);
    const status = row?.status ?? 'unset';
    const found = evidence.get(requirement.id);
    return (
      <li
        key={requirement.id}
        className="grid gap-3 rounded-xl border border-border/40 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
        style={{
          viewTransitionName: `qual-${requirement.id.replace(/[^a-zA-Z0-9_-]/g, '')}`,
        }}
      >
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-relaxed text-foreground">{requirement.text}</p>
          {coverage && found && <Evidence row={found} />}
        </div>
        <div className="min-w-0 space-y-2">
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">Where you stand on: {requirement.text}</legend>
            <div className="flex flex-wrap gap-1.5">
              {STATUS.map((option) => (
                <label key={option.value} className="relative">
                  <input
                    type="radio"
                    name={`status-${requirement.id}`}
                    checked={status === option.value}
                    onChange={() =>
                      changeDesks((data) =>
                        setQualification(data, appId, requirement.id, {
                          status: option.value,
                        })
                      )
                    }
                    className="peer absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span
                    className={cn(
                      'inline-flex min-h-9 items-center rounded-lg border border-border/50 px-3 text-sm text-muted-foreground transition-colors',
                      'peer-hover:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                      'peer-checked:border-lichen peer-checked:bg-lichen/15 peer-checked:text-foreground'
                    )}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="sr-only">Plan for: {requirement.text}</span>
            <Textarea
              rows={2}
              value={row?.plan ?? ''}
              disabled={status === 'unset'}
              placeholder={PLAN_PROMPT[status]}
              onChange={(event) =>
                changeDesks((data) =>
                  setQualification(data, appId, requirement.id, { plan: event.target.value })
                )
              }
              className="text-base"
            />
          </label>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Where you stand</h2>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          You do not need every qualification to apply. Mark each one honestly, then say how you
          will show it or how you could get it.
        </p>
        <p className="text-sm font-medium text-foreground" data-testid="standing-line">
          {tally.unset === requirements.length
            ? `${requirements.length} to mark.`
            : `${tally.have} have it, ${tally.maybe} maybe, ${tally['not-yet']} not yet${
                tally.unset ? `, ${tally.unset} still to mark` : ''
              }.`}{' '}
          {tally.unset === 0 &&
            (tally['not-yet'] + tally.maybe === 0
              ? 'You can show every one of these. Apply.'
              : tally.have >= tally['not-yet']
                ? 'You have more than you are missing. That is enough to apply; plan for the gaps below.'
                : 'You are missing more than you have. You can still apply, and the plan below is where to start.')}
        </p>
        <p className="text-sm text-foreground" data-testid="coverage-line">
          {coverage ? (
            describeCoverage(coverage)
          ) : (
            <>
              Add your resume in the{' '}
              <a className="underline underline-offset-2" href="/resume-game/">
                Resume Game
              </a>{' '}
              and this page will show where it already backs each requirement.
            </>
          )}
        </p>
      </div>

      <div className="space-y-8">
        {GROUPS.map(({ section, label }) => {
          const items = requirements.filter((r) => r.section === section);
          if (!items.length) return null;
          return (
            <section key={section} aria-labelledby={`qual-group-${section}`} className="space-y-3">
              <h3 id={`qual-group-${section}`} className="text-lg font-semibold">
                {label}
              </h3>
              <ul className="space-y-3">{items.map(renderRow)}</ul>
            </section>
          );
        })}
      </div>

      <section className="max-w-3xl space-y-4 border-t border-border/40 pt-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Action plan</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Turn the plans above into a few specific steps. "Schedule three informational interviews
            before the end of the term" is a step. "Network" is not. Steps with a date show up on
            your dashboard.
          </p>
        </div>
        <ul className="space-y-2">
          {desk.desk.actionPlan.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border/40 p-3"
            >
              <input
                type="checkbox"
                checked={item.done}
                aria-label={`Done: ${item.text}`}
                onChange={(event) =>
                  changeDesks((data) =>
                    updateActionStep(data, appId, item.id, { done: event.target.checked })
                  )
                }
                className="mt-1 h-4 w-4 accent-[hsl(var(--lichen))]"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm',
                  item.done && 'text-muted-foreground line-through'
                )}
              >
                {item.text}
                {item.due && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    by {item.due}
                  </span>
                )}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={`Remove step: ${item.text}`}
                onClick={() => changeDesks((data) => removeActionStep(data, appId, item.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            changeDesks(
              (data) => addActionStep(data, appId, { text: step, due: due || null }).data
            );
            setStep('');
            setDue('');
          }}
        >
          <label>
            <span className="sr-only">Next step</span>
            <Input
              value={step}
              onChange={(event) => setStep(event.target.value)}
              placeholder="One specific step"
              className="text-base"
            />
          </label>
          <label>
            <span className="sr-only">Do it by</span>
            <Input
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className="text-base"
            />
          </label>
          <Button type="submit" variant="outline" disabled={!step.trim()}>
            Add step
          </Button>
        </form>
      </section>
    </div>
  );
}
