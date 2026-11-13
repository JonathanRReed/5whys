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

/** The ratings the visitor has set so far. A key that is missing is not rated. */
export type PartialRatings = Partial<Ratings>;

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
    'Try another rep with one change: pause before your opening line. Compare how it felt, and keep what helped.',
  clarity:
    'Cut your intro to two sentences and one concrete example. Read it out loud once before the next rep.',
  rapport:
    'Choose one genuine detail about their work to ask about. Use your own words, then leave room for their answer.',
  authenticity:
    'Find the line you would never say to a friend and rewrite it the way you actually talk.',
};

export const STRONG_ROUND_STEP =
  'Strong round across the board. Save it, then raise the difficulty: pick a harder scenario or add a sharper ask.';

/** What a written message looks like, counted the same way every time. */
export type DraftShape = { sentences: number; questions: number; words: number };

/**
 * Sentences, questions and words in a draft. A sentence ends at . ! ? or the
 * same marks in Chinese and Japanese; a line with no mark at the end still
 * counts as one. Questions are the sentences that end with a question mark.
 */
export function draftShape(text: string): DraftShape {
  const trimmed = text.trim();
  if (!trimmed) return { sentences: 0, questions: 0, words: 0 };
  const pieces = trimmed.match(/[^.!?。！？\n]+(?:[.!?。！？]+|\n|$)/g) ?? [];
  const sentences = pieces.filter((piece) => /[\p{L}\p{N}]/u.test(piece));
  return {
    sentences: sentences.length,
    questions: sentences.filter((piece) => /[?？]/.test(piece)).length,
    words: trimmed.split(/\s+/).length,
  };
}

/** "4 sentences, 1 question". */
export function describeShape(shape: DraftShape): string {
  const sentences = `${shape.sentences} ${shape.sentences === 1 ? 'sentence' : 'sentences'}`;
  const questions = `${shape.questions} ${shape.questions === 1 ? 'question' : 'questions'}`;
  return `${sentences}, ${questions}`;
}

/** A written message has more sentences than this before clarity asks for a cut. */
export const WRITTEN_SENTENCE_LIMIT = 5;

/**
 * For a written message the fix comes from the message itself: how many
 * sentences and questions it has. Delivery advice such as "pause before
 * your opening line" does not apply to something read on a screen.
 */
function writtenStep(key: keyof Ratings, draft: string): string {
  const shape = draftShape(draft);
  switch (key) {
    case 'confidence':
      return 'Read the message out loud once before you send it. Rewrite the line you hesitate on.';
    case 'clarity':
      if (shape.sentences > WRITTEN_SENTENCE_LIMIT) {
        return `It has ${shape.sentences} sentences. Cut it to the ${WRITTEN_SENTENCE_LIMIT - 1} that lead to your ask.`;
      }
      if (shape.questions === 0) return 'End with one question they can answer in a line or two.';
      if (shape.questions > 1) {
        return `It asks ${shape.questions} questions. Keep the one you most need answered and cut the rest.`;
      }
      return 'Cut every sentence that does not lead to your one ask.';
    case 'rapport':
      return 'Add one specific detail about their work, something you actually read or heard, in the first two sentences.';
    default:
      return NEXT_STEPS[key];
  }
}

/** The single fix for a round: whichever rating is lowest, unless all are strong. */
export function computeNextStep(
  ratings: Ratings,
  context?: { written?: boolean; draft?: string }
): string {
  const entries = RATING_FIELDS.map(({ key }) => ({ key, value: ratings[key] }));
  const lowest = entries.reduce((min, entry) => (entry.value < min.value ? entry : min));
  if (lowest.value >= 4) return STRONG_ROUND_STEP;
  if (context?.written) return writtenStep(lowest.key, context.draft ?? '');
  return NEXT_STEPS[lowest.key];
}

export function averageRating(ratings: Ratings): number {
  return (ratings.confidence + ratings.clarity + ratings.rapport + ratings.authenticity) / 4;
}

/** The labels of the ratings the visitor has not set yet, in display order. */
export function missingRatingLabels(ratings: PartialRatings): string[] {
  return RATING_FIELDS.filter(({ key }) => typeof ratings[key] !== 'number').map(
    ({ label }) => label
  );
}

/** All four ratings when the visitor has set every one, otherwise null. */
export function completeRatings(ratings: PartialRatings): Ratings | null {
  const { confidence, clarity, rapport, authenticity } = ratings;
  if (
    typeof confidence !== 'number' ||
    typeof clarity !== 'number' ||
    typeof rapport !== 'number' ||
    typeof authenticity !== 'number'
  ) {
    return null;
  }
  return { confidence, clarity, rapport, authenticity };
}

/** "Confidence", "Confidence and Rapport", "Confidence, Clarity and Rapport". */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
