/**
 * Guards that every tier's output passes through. Pure functions.
 *
 * The rule: generated text may reword what the student wrote, but it may not
 * add a fact. A number, percentage, amount of money, date, name, tool, or
 * verb of ownership that is not in the inputs is reported as an invented
 * claim so the interface can strike it.
 */
import { HARD_SKILLS, matchesTerm } from '../resume-game/constants';
import { extractSkills } from '../resume-game/skills';
import type { ClaimKind, InventedClaim } from './types';

export type ClaimCheckOptions = {
  /**
   * Kinds to report. Defaults to every kind. Questions put to the student
   * skip `ownership`: asking "when did you lead a team" claims nothing.
   */
  kinds?: readonly ClaimKind[];
};

const ALL_KINDS: readonly ClaimKind[] = [
  'number',
  'percentage',
  'currency',
  'date',
  'proper-noun',
  'tool',
  'ownership',
];

/** Question tasks: everything except ownership. */
export const QUESTION_CLAIM_KINDS: readonly ClaimKind[] = ALL_KINDS.filter(
  (kind) => kind !== 'ownership'
);

// ============================================================================
// Numbers
// ============================================================================

const UNIT_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  dozen: 12,
};
const TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALE_WORDS: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};
const NUMBER_WORD_ALTERNATION = [
  ...Object.keys(UNIT_WORDS),
  ...Object.keys(TENS_WORDS),
  ...Object.keys(SCALE_WORDS),
].join('|');
/** A run of number words: "twenty-five", "three hundred", "a dozen" is just "dozen". */
const NUMBER_WORDS_PATTERN = new RegExp(
  `\\b(?:${NUMBER_WORD_ALTERNATION})(?:[\\s-]+(?:and[\\s-]+)?(?:${NUMBER_WORD_ALTERNATION}))*\\b`,
  'gi'
);

function parseNumberWords(phrase: string): number | null {
  const words = phrase
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((word) => word && word !== 'and');
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (word in UNIT_WORDS) current += UNIT_WORDS[word];
    else if (word in TENS_WORDS) current += TENS_WORDS[word];
    else if (word === 'hundred') current = (current || 1) * 100;
    else if (word in SCALE_WORDS) {
      total += (current || 1) * SCALE_WORDS[word];
      current = 0;
    } else return null;
  }
  return total + current;
}

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  m: 1_000_000,
  million: 1_000_000,
  b: 1_000_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
};

function parseDigits(raw: string): number {
  return Number.parseFloat(raw.replace(/,/g, ''));
}

const CURRENCY_PATTERN =
  /[$€£¥]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn|b|thousand|million|billion)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k|m|thousand|million|billion)?\s?(?:dollars|usd|euros|eur|pounds|gbp)\b/gi;
const PERCENT_PATTERN = /\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|per cent\b)/gi;
const DIGITS_PATTERN = /\d[\d,]*(?:\.\d+)?/g;

function currencyValue(match: string): number | null {
  const digits = match.match(/\d[\d,]*(?:\.\d+)?/);
  if (!digits) return null;
  const base = parseDigits(digits[0]);
  const suffix = match
    .slice((digits.index ?? 0) + digits[0].length)
    .trim()
    .toLowerCase()
    .split(/\s+/)[0];
  return suffix && suffix in MULTIPLIERS ? base * MULTIPLIERS[suffix] : base;
}

/** Every number value the inputs mention, as digits or as words, scaled and raw. */
function collectValues(text: string): { values: Set<number>; percents: Set<number> } {
  const values = new Set<number>();
  const percents = new Set<number>();
  for (const match of text.matchAll(DIGITS_PATTERN)) {
    const value = parseDigits(match[0]);
    if (!Number.isNaN(value)) values.add(value);
  }
  for (const match of text.matchAll(CURRENCY_PATTERN)) {
    const value = currencyValue(match[0]);
    if (value !== null) values.add(value);
  }
  // "2k" without a currency sign still means two thousand.
  for (const match of text.matchAll(
    /\b(\d[\d,]*(?:\.\d+)?)\s?(k|m|thousand|million|billion)\b/gi
  )) {
    values.add(parseDigits(match[1]) * MULTIPLIERS[match[2].toLowerCase()]);
  }
  for (const match of text.matchAll(NUMBER_WORDS_PATTERN)) {
    const value = parseNumberWords(match[0]);
    if (value !== null) values.add(value);
  }
  for (const match of text.matchAll(PERCENT_PATTERN)) {
    const digits = match[0].match(/\d[\d,]*(?:\.\d+)?/);
    if (digits) percents.add(parseDigits(digits[0]));
  }
  for (const match of text.matchAll(
    new RegExp(`(${NUMBER_WORDS_PATTERN.source})\\s?(?:percent|per cent)\\b`, 'gi')
  )) {
    const value = parseNumberWords(match[1]);
    if (value !== null) percents.add(value);
  }
  return { values, percents };
}

// ============================================================================
// Dates
// ============================================================================

const MONTHS = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sept', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
] as const;
const MONTH_INDEX = new Map<string, number>(
  MONTHS.flatMap((names, index) => names.map((name) => [name, index] as const))
);
// Case-sensitive: "may" and "march" are also verbs.
const MONTH_PATTERN = new RegExp(
  `\\b(?:${MONTHS.flat()
    .map((name) => name[0].toUpperCase() + name.slice(1))
    .join('|')})\\b\\.?`,
  'g'
);
const WEEKDAY_PATTERN = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\b/g;
const NUMERIC_DATE_PATTERN = /\b\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g;
const RELATIVE_DATE_PATTERN =
  /\b(?:tomorrow|yesterday|tonight|(?:next|last|this coming) (?:week|month|year|semester|quarter|summer|fall|spring|winter))\b/gi;

// ============================================================================
// Ownership
// ============================================================================

/**
 * Verbs that claim ownership. A group counts as supported if the inputs use
 * any form of it, or a role that carries it ("president" supports "led").
 */
const OWNERSHIP_GROUPS: readonly { claim: RegExp; support?: RegExp }[] = [
  {
    claim: /\b(?:lead|leads|leading|led|leadership)\b/i,
    support: /\b(?:president|vice president|captain|chair(?:person)?|head of|founder|officer)\b/i,
  },
  { claim: /\b(?:manage|manages|managed|managing)\b/i, support: /\bmanager\b/i },
  { claim: /\bspearhead(?:s|ed|ing)?\b/i },
  { claim: /\b(?:directed|directing)\b/i, support: /\bdirector\b/i },
  { claim: /\b(?:headed|heading up)\b/i, support: /\bhead of\b/i },
  { claim: /\b(?:owned|owning|owns|took ownership)\b/i },
  { claim: /\b(?:oversee|oversees|oversaw|overseeing|overseen)\b/i },
  { claim: /\bsupervis(?:e|es|ed|ing)\b/i, support: /\bsupervisor\b/i },
  { claim: /\b(?:co-?)?found(?:ed|ing)\b/i, support: /\b(?:co-?)?founder\b/i },
  { claim: /\blaunch(?:es|ed|ing)?\b/i },
  { claim: /\bchair(?:ed|ing)\b/i, support: /\bchair(?:person)?\b/i },
  { claim: /\bcaptain(?:ed|ing)\b/i, support: /\bcaptain\b/i },
  { claim: /\bchampion(?:ed|ing)\b/i },
  { claim: /\borchestrat(?:e|es|ed|ing)\b/i },
  { claim: /\barchitected\b/i },
  { claim: /\bpioneer(?:ed|ing)\b/i },
  // A bare "run" is too often passive ("run by") to count as a claim.
  { claim: /\b(?:ran|running)\b/i, support: /\bruns?\b/i },
];

// ============================================================================
// Proper nouns
// ============================================================================

const ALWAYS_CAPITALIZED = new Set(['i', "i'm", 'i’m', "i've", "i'd", "i'll", 'ok']);
const PROPER_NOUN_PATTERN =
  /(?<![A-Za-z0-9])(?:[A-Z][A-Za-z0-9'’&+#]*(?:[.-][A-Za-z0-9]+)*|[a-z]+[A-Z][A-Za-z0-9]*)/g;
const OPENERS = new Set(['"', "'", '“', '‘', '(', '[', '*', '_', ' ', '\t']);

function isSentenceStart(text: string, index: number): boolean {
  let j = index - 1;
  while (j >= 0 && OPENERS.has(text[j])) j -= 1;
  if (j < 0) return true;
  const ch = text[j];
  if ('.!?:;\n\r•'.includes(ch)) return true;
  const lineStart = text.lastIndexOf('\n', j) + 1;
  return /^\s*(?:[-*•]|\d+[.)])$/.test(text.slice(lineStart, j + 1));
}

function wordKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’']s$/, '')
    .replace(/[.]+$/, '');
}

function wordSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const match of text.matchAll(/[A-Za-z0-9][A-Za-z0-9'’&+#.-]*/g)) {
    const key = wordKey(match[0]);
    set.add(key);
    // "next.js" should also count "next"; "co-op" also "co" and "op".
    for (const part of key.split(/[.-]/)) if (part) set.add(part);
  }
  return set;
}

// ============================================================================
// findInventedClaims
// ============================================================================

type Span = { kind: ClaimKind; start: number; end: number; text: string };

function overlaps(a: Span, spans: Span[]): boolean {
  return spans.some((b) => a.start < b.end && b.start < a.end);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every claim in `generated` that the inputs do not support, in text order.
 * `original` is everything the student or the posting supplied; pass several
 * strings rather than joining them.
 */
export function findInventedClaims(
  original: string | readonly string[],
  generated: string,
  options: ClaimCheckOptions = {}
): InventedClaim[] {
  if (!generated) return [];
  const kinds = new Set(options.kinds ?? ALL_KINDS);
  const source = (typeof original === 'string' ? [original] : [...original]).join('\n');
  const lowerSource = source.toLowerCase();
  const { values, percents } = collectValues(source);
  const words = wordSet(source);
  const accepted: Span[] = [];
  const add = (span: Span) => {
    if (!overlaps(span, accepted)) accepted.push(span);
  };
  // Spans that are supported still claim their characters, so a supported
  // "$400" is not re-reported as the bare number 400.
  const covered: Span[] = [];
  const consider = (span: Span, invented: boolean) => {
    if (overlaps(span, covered)) return;
    covered.push(span);
    if (invented && kinds.has(span.kind)) add(span);
  };

  for (const match of generated.matchAll(CURRENCY_PATTERN)) {
    const value = currencyValue(match[0]);
    const span = spanOf('currency', match);
    consider(span, value === null || !values.has(value));
  }
  for (const match of generated.matchAll(PERCENT_PATTERN)) {
    const digits = match[0].match(/\d[\d,]*(?:\.\d+)?/);
    const value = digits ? parseDigits(digits[0]) : Number.NaN;
    consider(spanOf('percentage', match), !percents.has(value));
  }
  for (const match of generated.matchAll(NUMERIC_DATE_PATTERN)) {
    // Only shapes that read as dates: 3/14, 2024-05-01, 05.01.24.
    if (!/[/.-]/.test(match[0]) || /^\d+\.\d+$/.test(match[0])) continue;
    consider(spanOf('date', match), !lowerSource.includes(match[0].toLowerCase()));
  }
  for (const match of generated.matchAll(MONTH_PATTERN)) {
    const month = MONTH_INDEX.get(match[0].replace(/\.$/, '').toLowerCase());
    const supported = MONTHS[month ?? 0].some((name) =>
      new RegExp(`\\b${name}\\b`, 'i').test(source)
    );
    consider(spanOf('date', match), !supported);
  }
  for (const match of generated.matchAll(WEEKDAY_PATTERN)) {
    const day = match[0].replace(/s$/, '').toLowerCase();
    consider(spanOf('date', match), !lowerSource.includes(day));
  }
  for (const match of generated.matchAll(RELATIVE_DATE_PATTERN)) {
    consider(spanOf('date', match), !lowerSource.includes(match[0].toLowerCase()));
  }
  for (const match of generated.matchAll(DIGITS_PATTERN)) {
    consider(spanOf('number', match), !values.has(parseDigits(match[0])));
  }
  for (const match of generated.matchAll(NUMBER_WORDS_PATTERN)) {
    const value = parseNumberWords(match[0]);
    // A lone "one" is a pronoun far more often than a count.
    if (value === null || match[0].toLowerCase() === 'one') continue;
    consider(spanOf('number', match), !values.has(value));
  }

  // Tools and skills, with the same context gates the resume scan uses, so
  // "go" the verb is not the language Go.
  const generatedSkills = extractSkills(generated).hard;
  for (const skill of generatedSkills) {
    if (matchesTerm(source, skill)) continue;
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(skill)}(?![a-z0-9])`, 'gi');
    for (const match of generated.matchAll(pattern)) consider(spanOf('tool', match), true);
  }

  for (const group of OWNERSHIP_GROUPS) {
    if (group.claim.test(source) || group.support?.test(source)) continue;
    const global = new RegExp(group.claim.source, 'gi');
    for (const match of generated.matchAll(global)) consider(spanOf('ownership', match), true);
  }

  for (const match of generated.matchAll(PROPER_NOUN_PATTERN)) {
    const word = match[0];
    const key = wordKey(word);
    if (ALWAYS_CAPITALIZED.has(key)) continue;
    if (words.has(key)) continue;
    const start = match.index ?? 0;
    const internalCapital = /[A-Z]/.test(word.slice(1)) || /^[a-z]/.test(word);
    // A capital at the start of a sentence says nothing, unless the word
    // could not be an ordinary word (an acronym or "LinkedIn").
    if (isSentenceStart(generated, start) && !internalCapital) continue;
    if (word.length === 1 && isSentenceStart(generated, start)) continue;
    consider(spanOf('proper-noun', match), true);
  }

  return accepted
    .sort((a, b) => a.start - b.start)
    .map(({ kind, text, start, end }) => ({ kind, text, start, end }));
}

function spanOf(kind: ClaimKind, match: RegExpMatchArray): Span {
  const start = match.index ?? 0;
  const text = match[0].replace(/\s+$/, '');
  return { kind, start, end: start + text.length, text };
}

/** True if any HARD_SKILLS entry appears in the term as a whole word. */
export function mentionsKnownTool(text: string): boolean {
  return HARD_SKILLS.some((skill) => matchesTerm(text, skill));
}

// ============================================================================
// Output hygiene
// ============================================================================

const RATING_PATTERNS: readonly RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:\/|out of)\s*\d+\b/i,
  /\b(?:score|scored|rating|rated|rate it|grade|graded)\b[^.?\n]*\d/i,
  /\b\d+(?:\.\d+)?\s*(?:stars?|points?)\b/i,
];

/** True when model text rates or scores something. Such output is rejected. */
export function looksLikeRating(text: string): boolean {
  return RATING_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Bring model text in line with the site's copy rules: no em dashes, no
 * exclamation marks, no markdown emphasis, tidy spaces. Line breaks survive.
 */
export function cleanModelText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\s*—\s*/g, ', ')
    .replace(/!+/g, '.')
    .replace(/\*\*|__|`/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The first meaningful line, without list markers, labels, or wrapping quotes. */
export function firstLine(text: string): string {
  const line =
    cleanModelText(text)
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0) ?? '';
  return line
    .replace(/^(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/^(?:rewrite|rewritten line|question|follow-up|follow up|answer)\s*:\s*/i, '')
    .replace(/^["“'‘](.*)["”'’]$/, '$1')
    .trim();
}
