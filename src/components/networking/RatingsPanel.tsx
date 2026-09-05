import * as React from 'react';
import { computeNextStep, RATING_FIELDS, type Ratings } from '../../lib/networking-advice';
import { Label } from '../ui/label';

type Props = {
  ratings: Ratings;
  onRatingChange: (key: keyof Ratings, value: number) => void;
};

function computeFeedbackColor(value: number) {
  if (value >= 4) return 'text-foam';
  if (value >= 3) return 'text-gold';
  return 'text-destructive';
}

export default function RatingsPanel({ ratings, onRatingChange }: Props) {
  const averageRating = React.useMemo(() => {
    const total = ratings.confidence + ratings.clarity + ratings.rapport + ratings.authenticity;
    return total / 4;
  }, [ratings]);

  const nextStep = React.useMemo(() => computeNextStep(ratings), [ratings]);

  return (
    <div className="grid gap-6">
      {RATING_FIELDS.map(({ key, label, helpText }) => (
        <div key={key} className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`rating-${key}`} className="text-sm font-normal">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{helpText}</p>
            </div>
            <span className={`font-semibold ${computeFeedbackColor(ratings[key])}`}>
              {ratings[key]}/5
            </span>
          </div>
          <input
            id={`rating-${key}`}
            type="range"
            min={1}
            max={5}
            step={1}
            value={ratings[key]}
            onChange={(event) => onRatingChange(key, Number(event.target.value))}
            aria-label={`${label} rating (1 to 5)`}
            aria-valuenow={ratings[key]}
            aria-valuemin={1}
            aria-valuemax={5}
            className="w-full focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 rounded-md"
          />
        </div>
      ))}

      <div className="rounded-xl bg-overlay/30 p-4 text-sm text-muted-foreground">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.3em] text-iris">Average</div>
            <div className={`text-2xl font-semibold ${computeFeedbackColor(averageRating)}`}>
              {averageRating.toFixed(1)}/5
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border/40 bg-background/50 p-3">
          <p className="text-xs uppercase tracking-[0.3em] text-foam">Next step</p>
          <p className="mt-1.5 text-sm text-foreground">{nextStep}</p>
        </div>
      </div>
    </div>
  );
}
