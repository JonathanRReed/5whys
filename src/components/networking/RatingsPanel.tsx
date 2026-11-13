import * as React from 'react';
import {
  averageRating,
  completeRatings,
  computeNextStep,
  type PartialRatings,
  RATING_FIELDS,
  type Ratings,
} from '../../lib/networking-advice';

type Props = {
  ratings: PartialRatings;
  onRatingChange: (key: keyof Ratings, value: number) => void;
  /** A written message gets a next step from the message, not from delivery. */
  written?: boolean;
  draft?: string;
};

const SCALE = [1, 2, 3, 4, 5] as const;

function computeFeedbackColor(value: number) {
  if (value >= 4) return 'text-foam';
  if (value >= 3) return 'text-gold';
  return 'text-destructive';
}

/**
 * Each rating is a 1 to 5 radio group with nothing checked until the visitor
 * picks. A range input always shows a value, which is how an unearned 3/5
 * used to appear before anyone had rated anything.
 */
export default function RatingsPanel({
  ratings,
  onRatingChange,
  written = false,
  draft = '',
}: Props) {
  const complete = React.useMemo(() => completeRatings(ratings), [ratings]);
  const ratedCount = RATING_FIELDS.filter(({ key }) => typeof ratings[key] === 'number').length;

  return (
    <div className="grid gap-6" data-guide="rep-ratings">
      {RATING_FIELDS.map(({ key, label, helpText }) => {
        const value = ratings[key];
        return (
          <div
            key={key}
            id={`rating-${key}`}
            role="radiogroup"
            aria-labelledby={`rating-${key}-label`}
            aria-describedby={`rating-${key}-help rating-${key}-value`}
            className="grid min-w-0 gap-2"
          >
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-foreground" id={`rating-${key}-label`}>
                  {label}
                </span>
                <p className="text-xs text-muted-foreground" id={`rating-${key}-help`}>
                  {helpText}
                </p>
              </div>
              {typeof value === 'number' ? (
                <span
                  id={`rating-${key}-value`}
                  className={`shrink-0 font-semibold ${computeFeedbackColor(value)}`}
                >
                  {value}/5
                </span>
              ) : (
                <span id={`rating-${key}-value`} className="shrink-0 text-xs text-muted-foreground">
                  Not rated
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SCALE.map((option) => (
                <label
                  key={option}
                  className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/50 text-sm text-foreground transition-colors hover:bg-overlay/50 has-[:checked]:border-foam has-[:checked]:bg-foam/15 has-[:checked]:font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foam has-[:focus-visible]:ring-offset-2"
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`rating-${key}`}
                    value={option}
                    checked={value === option}
                    onChange={() => onRatingChange(key, option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl bg-overlay/30 p-4 text-sm text-muted-foreground">
        {complete ? (
          <>
            <div className="mb-1 text-xs uppercase tracking-[0.3em] text-iris">Average</div>
            <div
              className={`text-2xl font-semibold ${computeFeedbackColor(averageRating(complete))}`}
            >
              {averageRating(complete).toFixed(1)}/5
            </div>
            <div className="mt-3 rounded-lg border border-border/40 bg-background/50 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-foam">Next step</p>
              <p className="mt-1.5 text-sm text-foreground">
                {computeNextStep(complete, { written, draft })}
              </p>
            </div>
          </>
        ) : (
          <p data-guide="ratings-incomplete">
            {ratedCount === 0
              ? 'Not rated yet. Your average and next step appear once all four are rated.'
              : `${ratedCount} of 4 rated. Your average and next step appear once all four are rated.`}
          </p>
        )}
      </div>
    </div>
  );
}
