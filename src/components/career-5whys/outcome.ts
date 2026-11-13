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

/** A finished reflection another tool can offer back to the visitor. */
export type ReflectionForReuse = {
  topic: string;
  /** The visitor's own statement, or their root reason when they wrote none. */
  statement: string;
  mustOffer: string;
  fromExperience: boolean;
};

function fromEntry(entry: {
  track: Track;
  topic: string;
  responses: string[];
  rootIndex?: number;
  start?: unknown;
  statement?: string;
  mustOffer?: string;
}): ReflectionForReuse | null {
  const synthesis = computeSynthesis(entry.responses, entry.topic, lensOf(entry), entry.rootIndex);
  if (!synthesis.isComplete) return null;
  const statement = entry.statement?.trim() || synthesis.root;
  if (!statement) return null;
  return {
    topic: entry.topic.trim(),
    statement,
    mustOffer: entry.mustOffer?.trim() ?? '',
    fromExperience: entry.start === 'experience',
  };
}

/**
 * The finished reflection to offer elsewhere: the session on screen in the
 * Five Whys when it is complete, otherwise the newest saved snapshot. Only
 * reads; never writes.
 */
export function readReflectionForReuse(): ReflectionForReuse | null {
  if (!isBrowser()) return null;
  try {
    const rawSession = window.localStorage.getItem(SESSION_KEY);
    if (rawSession) {
      const data = JSON.parse(rawSession) as Record<string, unknown> | null;
      if (data && typeof data === 'object') {
        const track: Track = data.track === 'interest' ? 'interest' : 'career';
        const found = fromEntry({
          track,
          topic: typeof data.topic === 'string' ? data.topic : '',
          responses: ensureResponsesLength(data.responses),
          rootIndex: validRootIndex(data.rootIndex),
          start: data.start,
          ...readOutcome(data),
        });
        if (found) return found;
      }
    }
    const rawHistory = window.localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? (JSON.parse(rawHistory) as unknown) : [];
    if (!Array.isArray(history)) return null;
    for (const entry of history) {
      const snapshot = normalizeSnapshot(entry);
      const found = snapshot ? fromEntry(snapshot) : null;
      if (found) return found;
    }
  } catch {
    return null;
  }
  return null;
}
