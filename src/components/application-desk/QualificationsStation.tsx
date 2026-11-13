import * as React from 'react';
import {
  addActionStep,
  type QualificationStatus,
  removeActionStep,
  setQualification,
  updateActionStep,
} from '../../lib/application-desk';
import { shortDate } from '../../lib/applications';
import { describeStanding, deskRequirements, searchedFor, standing } from '../../lib/desk-checks';
import { keepDeskDraft, readDeskDraft } from '../../lib/desk-drafts';
import {
  type CoverageRow,
  describeParts,
  hiringCondition,
  type PostingRequirement,
  type PostingSection,
  summarizeCoverage,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import ConfirmButton from '../shared/ConfirmButton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useDeskExamples } from './examples';
import type { DeskState } from './useDesk';

const STATUS: { value: QualificationStatus; label: string }[] = [
  { value: 'have', label: 'Have it' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not-yet', label: 'Not yet' },
];

/** A condition of hiring is met or not; there is nothing to plan or to earn. */
const CONDITION_STATUS: { value: QualificationStatus; label: string }[] = [
  { value: 'have', label: 'I meet it' },
  { value: 'maybe', label: 'Not sure' },
  { value: 'not-yet', label: 'I do not' },
];

/**
 * "We are unable to sponsor" is not something to meet: it is asked as the
 * question it raises. Needing sponsorship is the "not yet" mark, so Before
 * you send can say what it means.
 */
const SPONSORSHIP_QUESTION = 'Will you need visa sponsorship for this job?';
const SPONSORSHIP_STATUS: { value: QualificationStatus; label: string }[] = [
  { value: 'not-yet', label: 'Yes, I will' },
  { value: 'maybe', label: 'Not sure' },
  { value: 'have', label: 'No' },
];

/** Rows are grouped the way the posting groups them. */
const GROUPS: { section: PostingSection; label: string }[] = [
  { section: 'required', label: 'Required' },
  { section: 'preferred', label: 'Preferred' },
  { section: 'responsibility', label: 'What you would do' },
  { section: 'unclassified', label: 'Not sorted yet' },
];

/** A resume line as quoted on the page: without its bullet marker. */
const plainLine = (text: string) => text.trim().replace(/^[•\-*◦–—·]+\s*/, '');

/** What the resume shows for one row, in plain text. */
function Evidence({ row }: { row: CoverageRow }) {
  const excerpt = row.excerpts[0];
  const parts = describeParts(row);
  return (
    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      {row.state === 'evidence' && excerpt && (
        <p>
          <span className="text-foam">In your resume: </span>"{plainLine(excerpt.text)}"
          {excerpt.listedOnly && ' (listed as a skill, not shown in use)'}
        </p>
      )}
      {row.state === 'partial' && (
        <>
          <p>Shown: {parts.shown.join('; ')}.</p>
          {excerpt && <p>In your resume: "{plainLine(excerpt.text)}"</p>}
          <p>Not shown yet: {parts.notShown.join('; ')}.</p>
        </>
      )}
      {row.state === 'none' && (
        <p>{searchedFor(row) ?? 'Nothing in your resume mentions this yet.'}</p>
      )}
      {row.note && <p>{row.note}</p>}
      {row.nearMisses.map((miss) => (
        <div key={miss.start} className="space-y-0.5">
          <p>This line may already say it, in other words: "{plainLine(miss.text)}"</p>
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
  const examples = useDeskExamples();
  // A step being typed stays with its application when the visitor switches
  // to another and comes back.
  const draftFor = desk.application?.id ?? '';
  const [step, setStepState] = React.useState(() => readDeskDraft(draftFor, 'step') ?? '');
  const [due, setDueState] = React.useState(() => readDeskDraft(draftFor, 'due') ?? '');
  const [added, setAdded] = React.useState('');
  const setStep = (value: string) => {
    setStepState(value);
    if (draftFor) keepDeskDraft(draftFor, 'step', value || null);
  };
  const setDue = (value: string) => {
    setDueState(value);
    if (draftFor) keepDeskDraft(draftFor, 'due', value || null);
  };

  // Work authorization, a minimum age, a background check: kept apart, because
  // they are not skills to show or to get.
  const { requirements, conditions } = React.useMemo(
    () => deskRequirements(role?.bullets ?? []),
    [role?.bullets]
  );
  const confirmed = requirements.length + conditions.length;
  const coverage = React.useMemo(
    () => (resumeText.trim() ? summarizeCoverage(requirements, resumeText) : null),
    [requirements, resumeText]
  );
  if (!application) return null;
  const appId = application.id;
  // The terms behind the condition notes, once for the page however many lines use them.
  const glossary = [
    ...new Set(conditions.map((c) => hiringCondition(c.text)?.about).filter(Boolean)),
  ] as string[];
  const rows = new Map(desk.desk.qualifications.map((row) => [row.requirementId, row]));
  const evidence = new Map(coverage?.rows.map((row) => [row.requirement.id, row]) ?? []);
  const where = standing(
    requirements,
    desk.desk.qualifications,
    coverage ? new Map(coverage.rows.map((row) => [row.requirement.id, row.state])) : null
  );

  if (!confirmed) {
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

  const renderCondition = (requirement: PostingRequirement) => {
    const status = rows.get(requirement.id)?.status ?? 'unset';
    const condition = hiringCondition(requirement.text);
    const sponsorship = Boolean(condition?.noSponsorship);
    const choices = sponsorship ? SPONSORSHIP_STATUS : CONDITION_STATUS;
    return (
      <li
        key={requirement.id}
        className="grid gap-3 rounded-xl border border-border/40 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      >
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-relaxed text-foreground">{requirement.text}</p>
          {sponsorship && (
            <p className="text-sm font-medium text-foreground" aria-hidden="true">
              {SPONSORSHIP_QUESTION}
            </p>
          )}
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">
              {sponsorship
                ? `${SPONSORSHIP_QUESTION} The posting says: ${requirement.text}`
                : `Whether you meet: ${requirement.text}`}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((option) => (
                <label key={option.value} className="relative">
                  <input
                    type="radio"
                    name={`status-${requirement.id}`}
                    checked={status === option.value}
                    onChange={() =>
                      changeDesks((data) =>
                        setQualification(data, appId, requirement.id, { status: option.value })
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
        </div>
        {condition && (
          <div className="min-w-0 space-y-1 text-sm leading-relaxed">
            <p className="font-medium text-foreground">{condition.label}</p>
            <p className="text-muted-foreground">{condition.note}</p>
          </div>
        )}
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
          {describeStanding(where)}
        </p>
        {!coverage && (
          <p className="text-sm text-foreground" data-testid="coverage-line">
            Add your resume in the{' '}
            <a className="underline underline-offset-2" href="/resume-game/">
              Resume Game
            </a>{' '}
            and this page will show where it already backs each requirement.
          </p>
        )}
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
        {conditions.length > 0 && (
          <section aria-labelledby="qual-group-conditions" className="space-y-3">
            <div className="space-y-1">
              <h3 id="qual-group-conditions" className="text-lg font-semibold">
                Conditions of the job
              </h3>
              <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                These are about who can be hired, not what you can do. They are not counted above,
                and they do not belong on a resume.
              </p>
            </div>
            <ul className="space-y-3">{conditions.map(renderCondition)}</ul>
            {glossary.length > 0 && (
              <details className="max-w-[68ch] text-sm" data-testid="condition-terms">
                <summary className="cursor-pointer text-muted-foreground">
                  What these terms mean
                </summary>
                {glossary.map((about) => (
                  <p key={about} className="mt-2 leading-relaxed text-muted-foreground">
                    {about}
                  </p>
                ))}
              </details>
            )}
          </section>
        )}
      </div>

      <section className="max-w-3xl space-y-4 border-t border-border/40 pt-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Action plan</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Turn the plans above into a few specific steps. "{examples.actionStep}" is a step.
            "Network" is not. Steps with a date show up on your dashboard.
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
                  <span className="ml-2 text-xs text-muted-foreground">
                    by {shortDate(item.due)}
                  </span>
                )}
              </span>
              <ConfirmButton
                confirmLabel="Remove this step and its date?"
                onConfirm={() => changeDesks((data) => removeActionStep(data, appId, item.id))}
                className="px-3 py-1.5 text-xs"
              >
                Remove<span className="sr-only"> step: {item.text}</span>
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!step.trim()) return;
            const text = step.trim();
            changeDesks(
              (data) => addActionStep(data, appId, { text: step, due: due || null }).data
            );
            setStep('');
            setDue('');
            // The button goes quiet once the box is empty; keep the keyboard
            // in the box, ready for the next step, and say what was added.
            setAdded(text);
            document.getElementById('desk-step-text')?.focus();
          }}
        >
          <label>
            <span className="sr-only">Next step</span>
            <Input
              id="desk-step-text"
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
          <Button
            type="submit"
            variant="outline"
            aria-disabled={!step.trim() || undefined}
            className="aria-disabled:opacity-50"
          >
            Add step
          </Button>
        </form>
        <p role="status" className="sr-only">
          {added ? `Step added: ${added}` : ''}
        </p>
      </section>
    </div>
  );
}
