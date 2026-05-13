import * as React from 'react';
import { Label } from '../ui/label';

type Ratings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

type Props = {
  ratings: Ratings;
  onRatingChange: (key: keyof Ratings, value: number) => void;
};

function computeFeedbackColor(value: number) {
  if (value >= 4) return 'text-[hsl(var(--love))]';
  if (value >= 3) return 'text-[hsl(var(--gold))]';
  return 'text-[hsl(var(--destructive))]';
}

const RATING_FIELDS = [
  {
    key: 'confidence' as const,
    label: 'Confidence',
    helpText: 'How sure did you feel? 1 = Nervous, 5 = Completely at ease',
  },
  {
    key: 'clarity' as const,
    label: 'Clarity',
    helpText: 'How clear was your message? 1 = Rambling, 5 = Sharp and concise',
  },
  {
    key: 'rapport' as const,
    label: 'Rapport',
    helpText: 'How well did you connect? 1 = Awkward, 5 = Natural conversation',
  },
  {
    key: 'authenticity' as const,
    label: 'Authenticity',
    helpText: 'Did you sound like yourself? 1 = Forced, 5 = Genuinely you',
  },
];

export default function RatingsPanel({ ratings, onRatingChange }: Props) {
  const averageRating = React.useMemo(() => {
    const total = ratings.confidence + ratings.clarity + ratings.rapport + ratings.authenticity;
    return total / 4;
  }, [ratings]);

  return (
    <div className="grid gap-6">
      {RATING_FIELDS.map(({ key, label, helpText }) => (
        <div key={key} className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`rating-${key}`} className="text-sm font-normal">
                {label}
              </Label>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{helpText}</p>
            </div>
            <span className={`font-semibold ${computeFeedbackColor(ratings[key])}`}>{ratings[key]}/5</span>
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
            className="w-full accent-[hsl(var(--iris))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2 rounded-md"
          />
        </div>
      ))}

      <div className="rounded-xl bg-[hsl(var(--overlay)/0.3)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="mb-1 text-xs uppercase tracking-[0.3em] text-[hsl(var(--iris))]">Average</div>
        <div className={`text-2xl font-semibold ${computeFeedbackColor(averageRating)}`}>
          {averageRating.toFixed(1)}/5
        </div>
        <p className="mt-2">
          {averageRating >= 4
            ? 'Excellent! You are ready. Try a different scenario or add a specific ask.'
            : averageRating >= 3
              ? 'Good start. Next: slow down your pace, make eye contact, and pause for their response.'
              : 'Keep practicing. Focus on: (1) Clear opening, (2) One specific goal, (3) Genuine question.'}
        </p>
      </div>
    </div>
  );
}
