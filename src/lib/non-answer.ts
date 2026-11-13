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

/**
 * A run of letters longer than this is not counted as a word. It is longer
 * than any word a visitor would write in an answer, so it catches a held key
 * or a pasted string without judging what real words say.
 */
export const MAX_WORD_LETTERS = 30;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9/\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && word.length <= MAX_WORD_LETTERS);
}

/** How many words the text has, counted the way the rule counts them. */
export function answerWordCount(raw: unknown): number {
  return typeof raw === 'string' ? words(raw).length : 0;
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

/** Said beside a field before anyone fails it, so the rule is never hidden. */
export const ANSWER_RULE = `${MIN_ANSWER_WORDS} words or more counts as an answer.`;

/**
 * The follow-up for a reply that does not count yet. "idk" gets the gentle
 * question; a reply that is only short is told how many words are missing.
 */
export function nonAnswerFollowUp(raw: unknown): string {
  const count = answerWordCount(raw);
  if (count >= MIN_ANSWER_WORDS) return NON_ANSWER_FOLLOW_UP;
  const text = typeof raw === 'string' ? raw : '';
  const allFiller = count > 0 && words(text).every((word) => FILLER.has(word));
  if (allFiller) return NON_ANSWER_FOLLOW_UP;
  const missing = MIN_ANSWER_WORDS - count;
  return `Add ${missing} more ${missing === 1 ? 'word' : 'words'}. ${ANSWER_RULE}`;
}
