/**
 * A rule for answers that are not answers yet: "idk", "n/a", "nothing",
 * "none really", a lone "?", or anything under three words. Tools use it to
 * stop counting such a reply as finished work and to ask one gentle
 * follow-up instead. It never blocks typing and never scores anything.
 */

/** Words that, on their own or together, say "I have nothing to put here". */
const FILLER = new Set([
  'i',
  'idk',
  'dk',
  'dunno',
  'dont',
  'do',
  'not',
  'know',
  'sure',
  'no',
  'idea',
  'none',
  'nothing',
  'really',
  'na',
  'n/a',
  'nope',
  'nah',
  'whatever',
  'honestly',
  'just',
  'um',
  'uh',
  'hmm',
  'lol',
  'tbd',
  'yet',
  'anything',
  'same',
  'ok',
  'okay',
  'yes',
  'maybe',
]);

/** Fewer real words than this reads as a placeholder, not an answer. */
export const MIN_ANSWER_WORDS = 3;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9/\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True when there is text but it does not say anything yet. Empty text is
 * not a non-answer; it is simply unanswered.
 */
export function isNonAnswer(raw: unknown): boolean {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return false;
  const list = words(text);
  if (list.length === 0) return true;
  if (list.length < MIN_ANSWER_WORDS) return true;
  return list.every((word) => FILLER.has(word));
}

/** True when the text is a real answer: present and not a placeholder. */
export function isRealAnswer(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0 && !isNonAnswer(raw);
}

/** The one follow-up shown under a non-answer. Kind, never scolding. */
export const NON_ANSWER_FOLLOW_UP =
  'That is an honest answer. What is the first thing that comes to mind, even if it is small?';
