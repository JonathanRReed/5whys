/**
 * Small text helpers shared by the posting engine. Every helper keeps
 * character offsets into the caller's original string, because the interface
 * highlights requirements and evidence in place.
 */

import type { SourceSpan } from './types';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Curly quotes and dashes become their plain forms. Each replacement is one
 * UTF-16 unit for one, so offsets into the normalized string are offsets into
 * the original.
 */
export function normalizePunctuation(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface TextSegment extends SourceSpan {
  text: string;
}

/** Trims a slice of `source` and returns it with offsets, or null when blank. */
export function trimmedSegment(source: string, start: number, end: number): TextSegment | null {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(source[s])) s++;
  while (e > s && /\s/.test(source[e - 1])) e--;
  if (s >= e) return null;
  return { start: s, end: e, text: source.slice(s, e) };
}

/** Abbreviations whose trailing period does not end a sentence. */
const ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'etc',
  'vs',
  'approx',
  'inc',
  'ltd',
  'co',
  'corp',
  'jr',
  'sr',
  'st',
  'dr',
  'mr',
  'mrs',
  'ms',
  'no',
  'u.s',
  'b.s',
  'b.a',
  'm.s',
  'm.a',
  'ph.d',
  'b.sc',
  'm.sc',
  'a.m',
  'p.m',
  'dept',
  'min',
  'max',
]);

/**
 * Splits a span of `source` into sentences. A sentence ends at `.`, `!` or `?`
 * followed by whitespace and a capital, digit, quote or bracket, or (when
 * `splitOnSemicolon`) at a `;` followed by whitespace. Known abbreviations and single initials do not end
 * a sentence.
 */
export function splitSentences(
  source: string,
  start = 0,
  end = source.length,
  splitOnSemicolon = true
): TextSegment[] {
  const segments: TextSegment[] = [];
  let sentenceStart = start;
  for (let i = start; i < end; i++) {
    const ch = source[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && (ch !== ';' || !splitOnSemicolon)) continue;
    const next = source[i + 1];
    if (next === undefined || i + 1 >= end || !/\s/.test(next)) continue;
    if (ch !== ';') {
      let j = i + 1;
      while (j < end && /\s/.test(source[j])) j++;
      if (j >= end || !/["'([A-Z0-9]/.test(source[j])) continue;
      if (ch === '.') {
        const before = source.slice(sentenceStart, i).match(/([A-Za-z.]+)$/);
        const token = before ? before[1].toLowerCase() : '';
        if (ABBREVIATIONS.has(token) || /^[a-z]$/.test(token)) continue;
      }
    }
    const segment = trimmedSegment(source, sentenceStart, i + 1);
    if (segment) segments.push(segment);
    sentenceStart = i + 1;
  }
  const last = trimmedSegment(source, sentenceStart, end);
  if (last) segments.push(last);
  return segments;
}

/**
 * Sentences shorter than `minWords` are folded into a neighbour, so
 * "Excel required." stays attached to the sentence it qualifies instead of
 * being dropped as noise.
 */
export function mergeShortSegments(
  source: string,
  segments: TextSegment[],
  minWords: number
): TextSegment[] {
  const merged: TextSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous && wordCount(segment.text) < minWords) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: segment.end,
        text: source.slice(previous.start, segment.end),
      };
    } else {
      merged.push(segment);
    }
  }
  if (merged.length > 1 && wordCount(merged[0].text) < minWords) {
    const [first, second, ...rest] = merged;
    return [
      { start: first.start, end: second.end, text: source.slice(first.start, second.end) },
      ...rest,
    ];
  }
  return merged;
}
