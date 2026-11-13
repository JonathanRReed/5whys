/**
 * What the visitor leaves the Five Whys with, in their own words: a
 * statement assembled from phrases they picked out of their answers, what a
 * role must offer, and what they can give up. Nothing here writes a word the
 * visitor did not write; the helpers only cut, join, and read back.
 */
import { answerWordCount } from '../../lib/non-answer';
import {
  computeSynthesis,
  ensureResponsesLength,
  HISTORY_KEY,
  isBrowser,
  lensOf,
  normalizeSnapshot,
  readOutcome,
  SESSION_KEY,
  type Track,
  validRootIndex,
} from './shared';

/** One phrase a visitor can pick, with the depth it came from. */
export type Phrase = { depth: number; text: string };

const CLAUSE_SPLIT = /(?<=[.!?。！？])\s*|[,;:，、；：]\s*|\s+(?:but|because|so)\s+/u;
const EDGE_PUNCTUATION = /^[\s"'“”‘’()]+|[\s.,;:!?。，、；：！？"'“”‘’()]+$/gu;

/**
 * The phrases in one answer: its sentences, cut again at commas and at
 * "but", "because" and "so". Anything under two words is left out, since a
 * single word says little on its own.
 */
export function answerPhrases(answer: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const piece of answer.replace(/\s+/g, ' ').split(CLAUSE_SPLIT)) {
    const text = (piece ?? '')
      .replace(EDGE_PUNCTUATION, '')
      .replace(/^(?:and|but|because|so)\s+/i, '')
      .trim();
    if (!text || answerWordCount(text) < 2 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    phrases.push(text);
  }
  return phrases;
}

/** Every pickable phrase across the answers, in order. */
export function chainPhrases(answers: readonly string[]): Phrase[] {
  return answers.flatMap((answer, depth) =>
    answerPhrases(answer ?? '').map((text) => ({ depth, text }))
  );
}

const HAN = /\p{Script=Han}/u;

/** Adds a phrase to the end of the statement, joined with a comma. */
export function addPhrase(statement: string, phrase: string): string {
  const current = statement.trimEnd();
  if (!current) return phrase;
  const separator = /[.!?。！？,，;；:：]$/u.test(current)
    ? HAN.test(phrase)
      ? ''
      : ' '
    : HAN.test(phrase)
      ? '，'
      : ', ';
  return `${current}${separator}${phrase}`;
}

/** True when the statement still holds the phrase as picked. */
export function hasPhrase(statement: string, phrase: string): boolean {
  return statement.includes(phrase);
}

/** Takes one picked phrase back out, with the comma that joined it. */
export function removePhrase(statement: string, phrase: string): string {
  const at = statement.indexOf(phrase);
  if (at === -1) return statement;
  const before = statement.slice(0, at).replace(/(?:,\s*|，)$/u, '');
  const after = statement.slice(at + phrase.length).replace(/^(?:,\s*|，)/u, '');
  const joined =
    before && after && !/\s$/.test(before) && !/^\s/.test(after)
      ? `${before} ${after}`
      : `${before}${after}`;
  return joined.replace(/^\s*(?:,\s*|，)/u, '').trim();
}

/** The outcome as plain text, ready to paste anywhere. */
export function outcomeText(
  outcome: { statement?: string; mustOffer?: string; canGiveUp?: string },
  root: string
): string {
  const lines: string[] = [];
  const statement = outcome.statement?.trim() || root.trim();
  if (statement) lines.push(statement);
  if (outcome.mustOffer?.trim()) lines.push(`A role must offer: ${outcome.mustOffer.trim()}`);
  if (outcome.canGiveUp?.trim()) lines.push(`I can give up: ${outcome.canGiveUp.trim()}`);
  return lines.join('\n');
}
