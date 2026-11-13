import { completeRatings, computeNextStep } from '../../lib/networking-advice';
import type { NetworkingPracticeSession } from '../../utils/storage';
import { REP_STEPS } from './practice-model';

type Props = {
  activeStep: number;
  /** True for a written message, which is read aloud rather than said. */
  written: boolean;
  /** The most recent saved rep, if any. */
  lastRep: NetworkingPracticeSession | undefined;
  /** Whether the last rep was a written message, for its next step. */
  lastRepWritten: boolean;
};

const STEP_HINTS = {
  spoken: [
    'Your words, not the samples',
    'Timer or recording',
    'All four, 1 to 5',
    'Keeps your words',
  ],
  written: [
    'Your words, not the samples',
    'Read it aloud, timed',
    'All four, 1 to 5',
    'Keeps your words',
  ],
} as const;

/**
 * One rep as one flow: write, say, rate, save. The last saved rep's fix sits
 * here, above the draft, so the next attempt starts from it.
 */
export default function RepFlow({ activeStep, written, lastRep, lastRepWritten }: Props) {
  const hints = written ? STEP_HINTS.written : STEP_HINTS.spoken;
  const lastRatings = lastRep ? completeRatings(lastRep.ratings) : null;
  const lastFix = lastRep?.reflection?.nextFocus?.trim() ?? '';
  const lastStep = lastRatings
    ? computeNextStep(lastRatings, {
        written: lastRepWritten,
        draft: lastRep?.attempts?.[0]?.script ?? '',
      })
    : '';

  return (
    <section aria-label="This rep" className="space-y-3" data-guide="rep-flow">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REP_STEPS.map((label, index) => {
          const isActive = index === activeStep;
          const isPast = index < activeStep;
          return (
            <li
              key={label}
              aria-current={isActive ? 'step' : undefined}
              className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                isActive ? 'border-foam/60 bg-foam/10' : 'border-border/40 bg-overlay/20'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-foam text-background'
                    : isPast
                      ? 'bg-foam/25 text-foreground'
                      : 'bg-border/40 text-muted-foreground'
                }`}
              >
                {index + 1}
                {isPast && <span className="sr-only">, done</span>}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{hints[index]}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {lastRep && (lastFix || lastStep) && (
        <div
          className="rounded-xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm"
          data-guide="last-rep"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Last rep: {lastRep.scenarioTitle}
          </p>
          {lastFix && (
            <p className="mt-1 text-foreground">
              <span className="font-medium">Your fix:</span> {lastFix}
            </p>
          )}
          {lastStep && (
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">Next step:</span> {lastStep}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
