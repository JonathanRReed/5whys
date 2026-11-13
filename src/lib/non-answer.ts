/**
 * A rule for answers that are not answers yet: "idk", "n/a", "nothing",
 * "none really", a lone "?", or anything under three words. Tools use it to
 * stop counting such a reply as finished work and to ask one gentle
 * follow-up instead. It never blocks typing and never scores anything.
 *
 * Words are counted in any language: accented letters, Cyrillic, Devanagari,
 * and writing without spaces between words (Chinese, Japanese, Thai) all
 * count, the same way the browser itself finds words in them.
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
  // The same "I do not know" in the languages visitors most often write in.
  // A real answer has at least one word that is not on this list.
  '我',
  '不',
  '也',
  '真',
  '的',
  '真的',
  '知',
  '道',
  '知道',
  '不知道',
  '不清楚',
  '没有',
  '沒有',
  '没',
  '沒',
  '无',
  '無',
  '嗯',
  '啊',
  '还',
  '還',
  '私',
  'は',
  'わからない',
  'わかりません',
  '分からない',
  '分かりません',
  '特に',
  'ない',
  'なし',
  'yo',
  'lo',
  'sé',
  'se',
  'ni',
  'nada',
  'ninguno',
  'ninguna',
  'quizás',
  'quizas',
]);

/** Fewer real words than this reads as a placeholder, not an answer. */
export const MIN_ANSWER_WORDS = 3;

/**
 * A run of letters longer than this is not counted as a word. It is longer
 * than any word a visitor would write in an answer, so it catches a held key
 * or a pasted string without judging what real words say.
 */
export const MAX_WORD_LETTERS = 30;

/** One Han or kana character: scripts written without spaces between words. */
const UNSPACED_LETTER = '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]';
const UNSPACED = new RegExp(UNSPACED_LETTER, 'u');
/** In the fallback, each Han or kana character is a word; any other run is one word. */
const FALLBACK_PIECE = new RegExp(`${UNSPACED_LETTER}|(?:(?!${UNSPACED_LETTER})[^])+`, 'gu');

type WordSegmenter = { segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }> };

let segmenter: WordSegmenter | null | undefined;
function wordSegmenter(): WordSegmenter | null {
  if (segmenter === undefined) {
    const Segmenter = (
      Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => WordSegmenter }
    ).Segmenter;
    segmenter = Segmenter ? new Segmenter(undefined, { granularity: 'word' }) : null;
  }
  return segmenter;
}

/**
 * The word-like pieces of a text. The browser's own word breaker finds words
 * in writing that does not put spaces between them (Chinese, Japanese,
 * Thai). Without one, letters and digits in any script make a word, and
 * each Han or kana character counts as one.
 */
function rawWords(text: string): string[] {
  const breaker = wordSegmenter();
  if (breaker) {
    return Array.from(breaker.segment(text))
      .filter((piece) => piece.isWordLike)
      .map((piece) => piece.segment);
  }
  const runs = text.match(/[\p{L}\p{M}\p{N}'’]+/gu) ?? [];
  return runs.flatMap((run) => (UNSPACED.test(run) ? (run.match(FALLBACK_PIECE) ?? []) : [run]));
}

/** One character typed again and again ("aaaa", "ああああ"): a held key. */
function isHeldKey(word: string): boolean {
  const letters = Array.from(word);
  return letters.length >= 3 && letters.every((letter) => letter === letters[0]);
}

function words(text: string): string[] {
  const normalized = text
    .toLowerCase()
    // "n/a" is one placeholder, not the two letters a word breaker sees.
    .replace(/(^|[^\p{L}])n\/a(?![\p{L}])/gu, '$1na');
  const list: string[] = [];
  for (const raw of rawWords(normalized)) {
    const word = raw.replace(/[‘’']/g, '');
    if (!word || Array.from(word).length > MAX_WORD_LETTERS || isHeldKey(word)) continue;
    // A word repeated straight after itself counts once, so holding a key
    // in a script the word breaker splits letter by letter adds nothing.
    if (list[list.length - 1] === word) continue;
    list.push(word);
  }
  return list;
}

/** Only for tests: count as a browser without a word breaker would. */
export function setWordBreakerForTests(enabled: boolean) {
  segmenter = enabled ? undefined : null;
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
export const ANSWER_RULE = `${MIN_ANSWER_WORDS} words or more counts as an answer. Any language works.`;

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
