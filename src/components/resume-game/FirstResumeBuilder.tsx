import * as React from 'react';
import {
  actionWordAdvice,
  applyCapitalFixes,
  assembleResume,
  capitalFixes,
  checkDraft,
  checkStep,
  DRAFT_STEPS,
  type DraftError,
  type DraftExperience,
  type DraftLine,
  draftBullet,
  EXPERIENCE_KINDS,
  type ExperienceKind,
  emptyDraft,
  emptyExperience,
  emptyLine,
  fieldId,
  MAX_EXPERIENCES,
  MAX_LINES,
  MIN_PHONE_DIGITS,
  type ResumeDraft,
  SCHOOL_EXAMPLES,
  type SchoolExample,
  splitActionWord,
} from '../../lib/resume-game/first-resume';
import { cn } from '../../lib/utils';
import ConfirmButton from '../shared/ConfirmButton';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import FirstResumePreview from './FirstResumePreview';

type Props = {
  /** The saved form, or null when nothing has been typed yet. */
  draft: ResumeDraft | null;
  onDraftChange: (draft: ResumeDraft) => void;
  /** Put the built resume into the game, exactly as if it had been pasted. */
  onUse: (text: string) => void;
  /** Back to paste or upload. What was typed is kept. */
  onClose: () => void;
  /** The resume already in the box, if any, so replacing it asks first. */
  currentText: string;
  /** Status messages for screen readers, from an announcer that outlives this form. */
  announce: (message: string) => void;
  /** Move focus to the form when it opens because the visitor asked for it. */
  focusOnOpen?: boolean;
  /** Which school to show as the example: high school for a first job. */
  schoolExample?: SchoolExample;
};

const INPUT =
  'min-h-11 border-border/50 bg-overlay/30 text-base text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

const KIND_ORDER = Object.keys(EXPERIENCE_KINDS) as ExperienceKind[];

const ORDINAL = ['first', 'second', 'third'];

/** A labelled input with its hint and its error, wired for screen readers. */
function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
} & Omit<React.ComponentProps<'input'>, 'id' | 'className'>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id} className="block leading-snug">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={INPUT}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-love">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Start from nothing": a short, calm form for someone who has never written
 * a resume. Four steps, one at a time, with a live preview that shows the
 * answers becoming a resume. It only arranges what the visitor types.
 */
export default function FirstResumeBuilder({
  draft: saved,
  onDraftChange,
  onUse,
  onClose,
  currentText,
  announce,
  focusOnOpen = false,
  schoolExample = 'college',
}: Props) {
  const schoolPlaceholder = SCHOOL_EXAMPLES[schoolExample];
  const draft = React.useMemo(() => saved ?? emptyDraft(), [saved]);
  const step = DRAFT_STEPS[draft.step] ?? DRAFT_STEPS[0];
  const stepIndex = DRAFT_STEPS.indexOf(step);
  const isLast = stepIndex === DRAFT_STEPS.length - 1;
  // Errors show once the visitor has tried to move on, then update as they type.
  const [attempted, setAttempted] = React.useState(false);
  const errors = attempted ? checkStep(draft, step.id) : [];
  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const moved = React.useRef(false);
  const pendingFocus = React.useRef<string | null>(null);
  const text = React.useMemo(() => assembleResume(draft), [draft]);

  React.useEffect(() => {
    if (focusOnOpen) titleRef.current?.focus();
  }, [focusOnOpen]);

  // Each new step's heading takes focus, so a keyboard or screen reader
  // visitor starts at the top of it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes
  React.useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    headingRef.current?.focus();
  }, [stepIndex]);

  // A field added or named by an error takes focus once it is on the page.
  React.useEffect(() => {
    if (!pendingFocus.current) return;
    const element = document.getElementById(pendingFocus.current);
    pendingFocus.current = null;
    element?.focus();
  });

  const change = (next: Partial<ResumeDraft>) => onDraftChange({ ...draft, ...next, open: true });

  const changeExperience = (index: number, next: Partial<DraftExperience>) =>
    change({
      experiences: draft.experiences.map((experience, i) =>
        i === index ? { ...experience, ...next } : experience
      ),
    });

  const changeLine = (index: number, lineIndex: number, next: Partial<DraftLine>) =>
    changeExperience(index, {
      lines: draft.experiences[index].lines.map((line, i) =>
        i === lineIndex ? { ...line, ...next } : line
      ),
    });

  const goTo = (target: number) => {
    moved.current = true;
    setAttempted(false);
    change({ step: target });
    announce(`Step ${target + 1} of ${DRAFT_STEPS.length}: ${DRAFT_STEPS[target].title}.`);
  };

  const showErrors = (found: DraftError[]) => {
    setAttempted(true);
    pendingFocus.current = found[0]?.field ?? null;
    announce(
      found.length === 1
        ? `One thing to fix: ${found[0].message}`
        : `${found.length} things to fix on this step. The first: ${found[0].message}`
    );
  };

  const next = () => {
    const found = checkStep(draft, step.id);
    if (found.length > 0) {
      showErrors(found);
      return;
    }
    goTo(stepIndex + 1);
  };

  const use = () => {
    const found = checkDraft(draft);
    if (found.length > 0) {
      const first = found[0];
      if (first.step !== stepIndex) {
        // Go to the step that needs work, then point at the field.
        moved.current = false;
        change({ step: first.step });
      }
      showErrors(found.filter((error) => error.step === first.step));
      return;
    }
    onUse(text);
  };

  const replacing = currentText.trim().length > 0 && currentText.trim() !== text.trim();

  return (
    <section aria-labelledby="first-resume-title" className="space-y-6" data-guide="first-resume">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[62ch] space-y-2">
          <p className="eyebrow text-muted-foreground">Start from nothing</p>
          <h2
            id="first-resume-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            Build a first resume
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Answer a few short questions. This only arranges what you type into a resume; it never
            adds anything. A job, a club, volunteering, a class project, or caring for family all
            count. Everything stays on this device.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={onClose}>
          Back to paste or upload
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card className="py-0">
          <CardContent className="space-y-6 px-4 py-6 sm:px-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Step {stepIndex + 1} of {DRAFT_STEPS.length}
              </p>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold outline-none"
                data-testid="first-resume-step"
              >
                {step.title}
              </h3>
            </div>

            {errors.length > 0 && (
              <p className="text-sm text-love">
                {errors.length === 1
                  ? 'One thing to fix before you go on.'
                  : `${errors.length} things to fix before you go on.`}
              </p>
            )}

            {step.id === 'you' && (
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your name, and at least one way to reach you.
                </p>
                <Field
                  id={fieldId.name}
                  label="Your name"
                  autoComplete="name"
                  autoCapitalize="words"
                  value={draft.name}
                  error={errorFor(fieldId.name)}
                  onChange={(event) => change({ name: event.target.value })}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id={fieldId.email}
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={draft.email}
                    error={errorFor(fieldId.email)}
                    onChange={(event) => change({ email: event.target.value })}
                  />
                  <Field
                    id={fieldId.phone}
                    label="Phone"
                    hint={`${MIN_PHONE_DIGITS} or more digits.`}
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    error={errorFor(fieldId.phone)}
                    onChange={(event) => change({ phone: event.target.value })}
                  />
                </div>
                <Field
                  id={fieldId.city}
                  label="City"
                  optional
                  hint="A city and state is enough. Leave out your street address."
                  autoComplete="address-level2"
                  autoCapitalize="words"
                  placeholder="Fresno, CA"
                  value={draft.city}
                  onChange={(event) => change({ city: event.target.value })}
                />
              </div>
            )}

            {step.id === 'school' &&
              (draft.skipSchool ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-foreground">
                    School is left off your resume. That is fine: your experience comes first.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      pendingFocus.current = fieldId.school;
                      change({ skipSchool: false });
                    }}
                  >
                    Add school after all
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Where you study now, or where you finished. High school, college, and a training
                    program all count. Not in school? Skip this step.
                  </p>
                  <Field
                    id={fieldId.school}
                    label="School or program"
                    autoCapitalize="words"
                    spellCheck
                    placeholder={schoolPlaceholder.school}
                    value={draft.school}
                    error={errorFor(fieldId.school)}
                    onChange={(event) => change({ school: event.target.value })}
                  />
                  <Field
                    id={fieldId.study}
                    label="What you are studying, or studied"
                    optional
                    spellCheck
                    placeholder={schoolPlaceholder.study}
                    hint="A major, a certificate, or High school diploma."
                    value={draft.study}
                    onChange={(event) => change({ study: event.target.value })}
                  />
                  <Field
                    id={fieldId.finish}
                    label="When you finish, or finished"
                    optional
                    placeholder={schoolPlaceholder.finish}
                    hint="A month and year, or just the year. A date still ahead reads as expected."
                    value={draft.finish}
                    error={errorFor(fieldId.finish)}
                    onChange={(event) => change({ finish: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3 text-muted-foreground"
                    onClick={() => {
                      onDraftChange({
                        ...draft,
                        open: true,
                        skipSchool: true,
                        step: stepIndex + 1,
                      });
                      moved.current = true;
                      setAttempted(false);
                      announce(
                        `School left off. Step ${stepIndex + 2} of ${DRAFT_STEPS.length}: ${DRAFT_STEPS[stepIndex + 1].title}.`
                      );
                    }}
                  >
                    Skip: I am not in school
                  </Button>
                </div>
              ))}

            {step.id === 'experience' && (
              <div className="space-y-8">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  One to three things you have done. Anything counts: a job, babysitting, a club or
                  team, volunteering, a class project, caring for family. Each line has three small
                  parts: an action word, what you did, and what happened because of it.
                </p>
                {draft.experiences.map((experience, index) => (
                  <ExperienceFields
                    // Experiences have no id; their place is their identity.
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
                    key={index}
                    index={index}
                    experience={experience}
                    count={draft.experiences.length}
                    errorFor={errorFor}
                    onChange={(next) => changeExperience(index, next)}
                    onLineChange={(lineIndex, next) => changeLine(index, lineIndex, next)}
                    announce={announce}
                    onAddLine={() => {
                      const lineIndex = experience.lines.length;
                      pendingFocus.current = fieldId.verb(index, lineIndex);
                      changeExperience(index, { lines: [...experience.lines, emptyLine()] });
                      announce(`Line ${lineIndex + 1} added.`);
                    }}
                    onRemoveLine={(lineIndex) => {
                      pendingFocus.current = fieldId.verb(index, Math.max(lineIndex - 1, 0));
                      changeExperience(index, {
                        lines: experience.lines.filter((_, i) => i !== lineIndex),
                      });
                      announce(`Line ${lineIndex + 1} removed.`);
                    }}
                    onRemove={() => {
                      pendingFocus.current = fieldId.role(Math.max(index - 1, 0));
                      change({ experiences: draft.experiences.filter((_, i) => i !== index) });
                      announce(`Experience ${index + 1} removed.`);
                    }}
                  />
                ))}
                {draft.experiences.length < MAX_EXPERIENCES && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      const index = draft.experiences.length;
                      pendingFocus.current = fieldId.role(index);
                      change({ experiences: [...draft.experiences, emptyExperience()] });
                      announce(`Experience ${index + 1} added.`);
                    }}
                  >
                    Add another experience
                  </Button>
                )}
              </div>
            )}

            {step.id === 'skills' && (
              <div className="space-y-5">
                <Field
                  id={fieldId.skills}
                  label="List your skills"
                  optional
                  hint="Separate them with commas. List what you could show someone: a language, a program, a tool, a certificate."
                  placeholder="Spanish, Google Sheets, cash handling"
                  value={draft.skills}
                  onChange={(event) => change({ skills: event.target.value })}
                />
                <CapitalCheck
                  draft={draft}
                  onFix={() => {
                    onDraftChange(applyCapitalFixes(draft));
                    announce('Names now start with a capital letter.');
                  }}
                />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  That is the whole resume. Use it and the Resume Game scores each line as you wrote
                  it, so you can see which one to strengthen first.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                {stepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => goTo(stepIndex - 1)}
                  >
                    Back
                  </Button>
                )}
                <ConfirmButton
                  tone="neutral"
                  confirmLabel="Clear everything typed here?"
                  className="min-h-11"
                  onConfirm={() => {
                    moved.current = true;
                    setAttempted(false);
                    onDraftChange(emptyDraft());
                    announce(`Cleared. Step 1 of ${DRAFT_STEPS.length}: ${DRAFT_STEPS[0].title}.`);
                  }}
                >
                  Start over
                </ConfirmButton>
              </div>
              {isLast ? (
                replacing ? (
                  <ConfirmButton
                    tone="neutral"
                    confirmLabel="Replace the resume in the box?"
                    className="min-h-11 border-foam bg-foam px-5 font-semibold text-background hover:bg-foam/90"
                    onConfirm={use}
                  >
                    Use this as my resume
                  </ConfirmButton>
                ) : (
                  <Button type="button" className="min-h-11 px-5 font-semibold" onClick={use}>
                    Use this as my resume
                  </Button>
                )
              ) : (
                <Button type="button" className="min-h-11 px-5 font-semibold" onClick={next}>
                  Next: {DRAFT_STEPS[stepIndex + 1].title}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <FirstResumePreview draft={draft} text={text} />
      </div>
    </section>
  );
}

type ExperienceProps = {
  index: number;
  experience: DraftExperience;
  count: number;
  errorFor: (field: string) => string | undefined;
  onChange: (next: Partial<DraftExperience>) => void;
  onLineChange: (lineIndex: number, next: Partial<DraftLine>) => void;
  announce: (message: string) => void;
  onAddLine: () => void;
  onRemoveLine: (lineIndex: number) => void;
  onRemove: () => void;
};

function ExperienceFields({
  index,
  experience,
  count,
  errorFor,
  onChange,
  onLineChange,
  announce,
  onAddLine,
  onRemoveLine,
  onRemove,
}: ExperienceProps) {
  const example = EXPERIENCE_KINDS[experience.kind];
  const exampleLine = draftBullet(example.lines[0]);
  const touched =
    Boolean(experience.role || experience.where || experience.start || experience.end) ||
    experience.lines.some((line) => line.verb || line.task || line.impact);
  const kindId = fieldId.kind(index);
  return (
    <div className={cn(index > 0 && 'border-t border-border/40 pt-6')}>
      <fieldset className="min-w-0 space-y-5">
        <legend className="mb-5 text-base font-semibold">
          {count > 1 ? `Experience ${index + 1}` : 'Your experience'}
        </legend>

        <div className="space-y-1.5">
          <Label htmlFor={kindId}>What was it?</Label>
          <Select
            value={experience.kind}
            onValueChange={(value) => onChange({ kind: value as ExperienceKind })}
          >
            <SelectTrigger
              id={kindId}
              className="min-h-11 w-full border-border/50 bg-overlay/30 text-base sm:w-72"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((kind) => (
                <SelectItem key={kind} value={kind} className="min-h-11">
                  {EXPERIENCE_KINDS[kind].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={fieldId.role(index)}
            label="Your role"
            autoCapitalize="words"
            spellCheck
            placeholder={example.role}
            value={experience.role}
            error={errorFor(fieldId.role(index))}
            onChange={(event) => onChange({ role: event.target.value })}
          />
          <Field
            id={fieldId.where(index)}
            label="Where"
            optional
            autoCapitalize="words"
            spellCheck
            placeholder={example.where || 'Leave blank if it was at home'}
            value={experience.where}
            onChange={(event) => onChange({ where: event.target.value })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={fieldId.start(index)}
            label="Started"
            optional
            placeholder="Jun 2024"
            value={experience.start}
            error={errorFor(fieldId.start(index))}
            onChange={(event) => onChange({ start: event.target.value })}
          />
          <div className="min-w-0 space-y-1.5">
            <Field
              id={fieldId.end(index)}
              label="Ended"
              placeholder="May 2025"
              value={experience.current ? '' : experience.end}
              disabled={experience.current}
              error={experience.current ? undefined : errorFor(fieldId.end(index))}
              onChange={(event) => onChange({ end: event.target.value })}
            />
            <label
              htmlFor={fieldId.current(index)}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
            >
              <input
                id={fieldId.current(index)}
                type="checkbox"
                checked={experience.current}
                onChange={(event) => onChange({ current: event.target.checked })}
                className="h-5 w-5 rounded border-border accent-foam"
              />
              I still do this
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">What you did</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Two or three lines. For example: {exampleLine}
            </p>
          </div>
          {experience.lines.map((line, lineIndex) => (
            <LineFields
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have fixed positions
              key={lineIndex}
              index={index}
              lineIndex={lineIndex}
              line={line}
              example={example.lines[lineIndex % 2]}
              current={experience.current}
              announce={announce}
              canRemove={experience.lines.length > 1}
              errorFor={errorFor}
              onChange={(next) => onLineChange(lineIndex, next)}
              onRemove={() => onRemoveLine(lineIndex)}
            />
          ))}
          {experience.lines.length < MAX_LINES && (
            <Button type="button" variant="outline" className="min-h-11" onClick={onAddLine}>
              Add a {ORDINAL[experience.lines.length]} line
            </Button>
          )}
        </div>

        {count > 1 &&
          (touched ? (
            <ConfirmButton
              tone="neutral"
              confirmLabel={`Remove experience ${index + 1} and its lines?`}
              className="min-h-11"
              onConfirm={onRemove}
            >
              Remove experience {index + 1}
            </ConfirmButton>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={onRemove}>
              Remove experience {index + 1}
            </Button>
          ))}
      </fieldset>
    </div>
  );
}

type LineProps = {
  index: number;
  lineIndex: number;
  line: DraftLine;
  example: DraftLine;
  /** The experience is still going on: a present-tense action word is fine. */
  current: boolean;
  announce: (message: string) => void;
  canRemove: boolean;
  errorFor: (field: string) => string | undefined;
  onChange: (next: Partial<DraftLine>) => void;
  onRemove: () => void;
};

function LineFields({
  index,
  lineIndex,
  line,
  example,
  current,
  announce,
  canRemove,
  errorFor,
  onChange,
  onRemove,
}: LineProps) {
  const built = draftBullet(line);
  const filled = Boolean(line.verb || line.task || line.impact);
  // Set when a sentence typed into the action word was split for the visitor.
  const [moved, setMoved] = React.useState<string | null>(null);
  // Advice reads the one action word, not a sentence waiting to be split.
  const split = splitActionWord(line.verb);
  const advice =
    line.verb.trim() && !split?.rest ? actionWordAdvice(split?.verb ?? line.verb, current) : null;
  const verbId = fieldId.verb(index, lineIndex);

  // A whole sentence in the one-word box moves its rest to "What you did",
  // but only into an empty box, so nothing the visitor wrote is replaced.
  const splitVerb = () => {
    if (line.task.trim() || !split) return;
    onChange({ verb: split.verb, task: split.rest });
    if (split.rest) {
      setMoved(split.rest);
      announce(`Moved "${split.rest}" to What you did.`);
    }
  };
  return (
    <div className="border-t border-border/30 pt-4">
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-3 text-sm font-medium">Line {lineIndex + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
          <div className="min-w-0 space-y-1.5">
            <Field
              id={verbId}
              label="Action word"
              hint="One word, like Watched, Built, or Ran."
              autoCapitalize="sentences"
              spellCheck
              placeholder={example.verb}
              value={line.verb}
              error={errorFor(verbId)}
              onChange={(event) => {
                setMoved(null);
                onChange({ verb: event.target.value });
              }}
              onBlur={splitVerb}
            />
            {advice?.kind === 'past' && (
              <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <p>Resumes usually say it the way it already happened: {advice.past}.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => {
                    onChange({
                      verb: (split?.verb ?? line.verb.trim()).replace(advice.word, advice.past),
                    });
                    announce(`Action word is now ${advice.past}.`);
                  }}
                >
                  Use {advice.past}
                </Button>
              </div>
            )}
            {advice?.kind === 'not-a-verb' && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                "{advice.word}" may not read as something you did. A word like Watched, Built, or
                Ran works best.
              </p>
            )}
          </div>
          <Field
            id={fieldId.task(index, lineIndex)}
            label="What you did"
            spellCheck
            hint={moved ? `Moved here from Action word: "${moved}".` : undefined}
            placeholder={example.task}
            value={line.task}
            error={errorFor(fieldId.task(index, lineIndex))}
            onChange={(event) => onChange({ task: event.target.value })}
          />
        </div>
        <Field
          id={fieldId.impact(index, lineIndex)}
          label="What happened because of it"
          optional
          spellCheck
          hint={'It follows your line after "so". It does not have to be a number.'}
          placeholder={example.impact || 'Leave blank if you are not sure'}
          value={line.impact}
          onChange={(event) => onChange({ impact: event.target.value })}
        />
        {built && (
          <p className="text-sm leading-relaxed text-foreground">
            <span className="text-muted-foreground">Reads: </span>
            {built}
          </p>
        )}
        {canRemove &&
          (filled ? (
            <ConfirmButton
              tone="neutral"
              confirmLabel={`Remove line ${lineIndex + 1}?`}
              className="min-h-11"
              onConfirm={onRemove}
            >
              Remove line {lineIndex + 1}
            </ConfirmButton>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={onRemove}>
              Remove line {lineIndex + 1}
            </Button>
          ))}
      </fieldset>
    </div>
  );
}

/**
 * Names typed in lowercase, offered back capitalized. A rule the visitor can
 * read, run with one tap; nothing changes on its own.
 */
function CapitalCheck({ draft, onFix }: { draft: ResumeDraft; onFix: () => void }) {
  const fixes = capitalFixes(draft);
  if (fixes.length === 0) return null;
  return (
    <div
      className="space-y-3 rounded-xl border border-gold/40 bg-gold/8 p-4"
      data-testid="capital-check"
    >
      <p className="text-sm leading-relaxed text-foreground">
        Names usually start with a capital letter:{' '}
        {fixes.map((fix, index) => (
          <React.Fragment key={fix.field}>
            {index > 0 && ', '}
            <span className="font-medium">{fix.to}</span>
          </React.Fragment>
        ))}
        .
      </p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onFix}>
        Fix {fixes.length === 1 ? 'it' : 'them'}
      </Button>
    </div>
  );
}
