/**
 * The checks "Before you send" computes from the letter, in the order they
 * are shown. Kept apart from the checks themselves so copy that counts them
 * (the guide) can read the number without loading the posting engine.
 */
export const SEND_CHECK_IDS = [
  'no-placeholders',
  'names',
  'one-page',
  'posting-words',
  'ends-with-ask',
] as const;

export type SendCheckId = (typeof SEND_CHECK_IDS)[number];

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** "Five", for a sentence that starts with the number of checks. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
