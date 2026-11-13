import * as React from 'react';
import {
  type LetterDraft,
  type QualificationRow,
  setChecklistTick,
} from '../../lib/application-desk';
import { localDate, markSent } from '../../lib/applications';
import {
  conditionWarnings,
  countWord,
  endSentence,
  findPlaceholders,
  letterText,
  runSendChecks,
  type SendCheck,
  wornPhrases,
} from '../../lib/desk-checks';
import {
  type PostingRequirement,
  requirementsFromBullets,
  splitConditions,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import ConfirmButton from '../shared/ConfirmButton';
import { Button } from '../ui/button';
import LetterPreview from './LetterPreview';
import SentControl from './SentControl';
import type { DeskState } from './useDesk';

/**
 * What still stands between this application and sending it, as the words
 * "Mark as sent" arms with, or null when nothing does. Only checks that
 * failed count: a letter not written at all is the visitor's choice.
 */
export function sendBlocker(
  letter: LetterDraft,
  checks: readonly SendCheck[],
  warnings: readonly string[]
): string | null {
  const placeholders = findPlaceholders(
    [letter.recipient, letterText(letter), letter.sender].join('\n')
  );
  if (placeholders.length > 0) return `The letter still has ${placeholders[0]}.`;
  if (warnings.length > 0) return warnings[0];
  const failed = checks.filter((check) => check.passed === false);
  if (failed.length === 1) return `"${failed[0].label}" is not done yet.`;
  if (failed.length > 1) return `${countWord(failed.length)} checks are not done yet.`;
  return null;
}

/** The checks and condition warnings for one application, as Before you send shows them. */
export function sendState(
  letter: LetterDraft,
  title: string,
  company: string,
  requirements: PostingRequirement[],
  rows: readonly QualificationRow[]
) {
  const checks = runSendChecks({ letter, title, company, requirements });
  const { conditions } = splitConditions(requirements.filter((r) => r.status === 'confirmed'));
  const warnings = conditionWarnings(conditions, rows);
  return { checks, warnings, blocker: sendBlocker(letter, checks, warnings) };
}

/**
 * "Mark as sent", which asks in place first when something is still open:
 * the first press names it ("The letter still has [your proof]"), the second
 * marks it. Once sent, or with nothing open, it is the plain control.
 */
export function MarkSent({
  sentOn,
  title,
  blocker,
  onChange,
  className,
}: {
  sentOn: string | null | undefined;
  title: string;
  blocker: string | null;
  onChange: (sentOn: string | null) => void;
  className?: string;
}) {
  if (sentOn || !blocker) {
    return <SentControl className={className} sentOn={sentOn} title={title} onChange={onChange} />;
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <ConfirmButton
        tone="neutral"
        confirmLabel={`${blocker} Mark as sent anyway`}
        onConfirm={() => onChange(localDate())}
        className="min-h-10 font-normal"
      >
        Mark as sent<span className="sr-only">: {title}</span>
      </ConfirmButton>
    </div>
  );
}

const MANUAL = [
  { id: 'sounds-like-me', label: 'It sounds like me when I read it out loud' },
  { id: 'proofread', label: 'Someone else has read it' },
];

export default function SendStation({ desk }: { desk: DeskState }) {
  const { application, role, changeDesks, changeApplications } = desk;
  // What was last copied, so the button says "copied" only while that is
  // still the text it would copy. The station also starts over for each
  // application (it is keyed by the application's id).
  const [copiedThanks, setCopiedThanks] = React.useState<string | null>(null);
  // Arriving from the dashboard's "the thank-you note" link.
  React.useEffect(() => {
    if (window.location.hash !== '#after-interview') return;
    window.requestAnimationFrame(() =>
      document.getElementById('after-interview')?.scrollIntoView({ block: 'start' })
    );
  }, []);
  const requirements = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []),
    [role?.bullets]
  );
  if (!application) return null;
  const letter = desk.desk.letter;
  const { checks, warnings, blocker } = sendState(
    letter,
    application.title,
    application.company,
    requirements,
    desk.desk.qualifications
  );
  const worn = wornPhrases(letter);
  const at = application.company.trim() ? ` at ${application.company.trim()}` : '';
  const thanks = [
    'Hi [name],',
    `Thank you for talking with me today about the ${application.title.trim()} role${
      at ? endSentence(at) : '.'
    } [One thing you talked about] stayed with me because [why it matters to you].`,
    'I am glad to send anything else that would help.',
    letter.sender.trim() || '[Your name]',
  ].join('\n\n');
  const thanksCopied = copiedThanks === thanks;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Before you send</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The first {countWord(checks.length).toLowerCase()} are checked against what you wrote. The
          last {countWord(MANUAL.length).toLowerCase()} only you can answer.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-xl bg-gold/12 p-4" data-testid="condition-warnings">
          <p className="font-medium text-foreground">Before you apply</p>
          {warnings.map((warning) => (
            <p key={warning} className="text-sm leading-relaxed text-foreground">
              {warning}
            </p>
          ))}
        </div>
      )}

      <ul className="space-y-2" data-guide="send-checks">
        {checks.map((check) => (
          <li
            key={check.id}
            className="flex items-start gap-3 rounded-xl border border-border/40 p-4"
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                check.passed === true && 'bg-foam/20 text-foam',
                check.passed === false && 'bg-love/20 text-love',
                check.passed === null && 'bg-foreground/10 text-muted-foreground'
              )}
            >
              {check.passed === true ? '✓' : check.passed === false ? '!' : '·'}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {check.label}
                <span className="sr-only">
                  {check.passed === true
                    ? ': yes'
                    : check.passed === false
                      ? ': not yet'
                      : ': not checked yet'}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{check.detail}</p>
            </div>
          </li>
        ))}
        {MANUAL.map((item) => (
          <li key={item.id} className="rounded-xl border border-border/40 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(desk.desk.checklist[item.id])}
                onChange={(event) =>
                  changeDesks((data) =>
                    setChecklistTick(data, application.id, item.id, event.target.checked)
                  )
                }
                className="h-5 w-5 accent-[hsl(var(--lichen))]"
              />
              <span className="font-medium text-foreground">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {worn.length > 0 && (
        <div
          className="space-y-1 rounded-xl border border-border/40 p-4"
          data-testid="worn-phrases"
        >
          <p className="font-medium text-foreground">Worn phrases</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {worn.map((phrase) => `"${phrase}"`).join(', ')}{' '}
            {worn.length === 1 ? 'appears' : 'appear'} in many letters, so readers skip{' '}
            {worn.length === 1 ? 'it' : 'them'}. Something you did that shows the same thing says
            more. This is not a check: keep {worn.length === 1 ? 'it' : 'them'} if you want.
          </p>
        </div>
      )}

      <LetterPreview
        letter={letter}
        title={application.title}
        company={application.company}
        headingId="send-letter-heading"
      />

      <section aria-labelledby="sent-heading" className="space-y-2 border-t border-border/40 pt-6">
        <h3 id="sent-heading" className="text-lg font-semibold">
          Sent it?
        </h3>
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Mark it once it has gone, so the dashboard stops counting down to the deadline and points
          you to the interview instead.
        </p>
        <MarkSent
          sentOn={application.sentOn}
          title={application.title}
          blocker={blocker}
          onChange={(sentOn) =>
            changeApplications((data) => markSent(data, application.id, sentOn))
          }
        />
      </section>

      <section
        id="after-interview"
        aria-labelledby="after-interview-heading"
        className="scroll-mt-24 space-y-3 border-t border-border/40 pt-6"
      >
        <h3 id="after-interview-heading" className="text-lg font-semibold">
          After an interview
        </h3>
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Send a short thank-you the same day or the next. Name one thing you really talked about,
          so it could not have been sent to anyone else. Fill in the brackets before it goes.
        </p>
        <p className="rounded-xl border border-border/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {thanks}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(thanks);
              setCopiedThanks(thanks);
            } catch {
              setCopiedThanks(null);
            }
          }}
        >
          {thanksCopied ? 'Thank-you copied' : 'Copy the thank-you'}
        </Button>
      </section>
    </div>
  );
}
