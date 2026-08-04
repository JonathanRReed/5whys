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
  if (value >= 4) return 'text-[hsl(var(--foam))]';
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

const NEXT_STEPS: Record<keyof Ratings, string> = {
  confidence:
    'Run the same scenario again right now. The second rep is always steadier, and that steadiness is what confidence is.',
  clarity:
    'Cut your intro to two sentences and one concrete example. Read it out loud once before the next rep.',
  rapport:
    'Start the next rep with a line about them, not you. Pick one warm-up line and use it word for word.',
  authenticity:
    'Find the line you would never say to a friend and rewrite it the way you actually talk.',
};

function computeNextStep(ratings: Ratings): string {
  const entries = RATING_FIELDS.map(({ key }) => ({ key, value: ratings[key] }));
  const lowest = entries.reduce((min, entry) => (entry.value < min.value ? entry : min));
  if (lowest.value >= 4) {
    return 'Strong round across the board. Save it, then raise the difficulty: pick a harder scenario or add a sharper ask.';
  }
  return NEXT_STEPS[lowest.key];
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
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{helpText}</p>
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
            className="w-full focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2 rounded-md"
          />
        </div>
      ))}

      <div className="rounded-xl bg-[hsl(var(--overlay)/0.3)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.3em] text-[hsl(var(--iris))]">
              Average
            </div>
            <div className={`text-2xl font-semibold ${computeFeedbackColor(averageRating)}`}>
              {averageRating.toFixed(1)}/5
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--background)/0.5)] p-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--foam))]">Next step</p>
          <p className="mt-1.5 text-sm text-[hsl(var(--foreground))]">{nextStep}</p>
        </div>
      </div>
    </div>
  );
}
