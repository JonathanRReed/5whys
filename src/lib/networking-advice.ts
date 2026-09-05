/**
 * The four self-ratings in Networking Practice and the one concrete fix each
 * low rating maps to. Shared by the ratings panel and the dashboard so both
 * name the same next step.
 */

export type Ratings = {
  confidence: number;
  clarity: number;
  rapport: number;
  authenticity: number;
};

export const RATING_FIELDS = [
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

export const NEXT_STEPS: Record<keyof Ratings, string> = {
  confidence:
    'Run the same scenario again right now. The second rep is always steadier, and that steadiness is what confidence is.',
  clarity:
    'Cut your intro to two sentences and one concrete example. Read it out loud once before the next rep.',
  rapport:
    'Start the next rep with a line about them, not you. Pick one warm-up line and use it word for word.',
  authenticity:
    'Find the line you would never say to a friend and rewrite it the way you actually talk.',
};

export const STRONG_ROUND_STEP =
  'Strong round across the board. Save it, then raise the difficulty: pick a harder scenario or add a sharper ask.';

/** The single fix for a round: whichever rating is lowest, unless all are strong. */
export function computeNextStep(ratings: Ratings): string {
  const entries = RATING_FIELDS.map(({ key }) => ({ key, value: ratings[key] }));
  const lowest = entries.reduce((min, entry) => (entry.value < min.value ? entry : min));
  if (lowest.value >= 4) return STRONG_ROUND_STEP;
  return NEXT_STEPS[lowest.key];
}

export function averageRating(ratings: Ratings): number {
  return (ratings.confidence + ratings.clarity + ratings.rapport + ratings.authenticity) / 4;
}
