import { POWER_VERB_GLOBAL_PATTERN } from './constants';
import { findNumberSpans } from './scoring';
import { detectResumeStructure } from './structure';
import { decodeEntities, escapeHtml } from './text';
import { leadingAction } from './verbs';

/**
 * The resume as the visitor pasted it, marked with what the scorer reads.
 *
 * Only achievement lines are marked, the same lines the scorer scores, so a
 * name, a phone number, a heading, or "B.A. Communications, 2027" stays plain.
 * Inside those lines a number is marked only when the scorer's own number
 * finder counts it: years, date ranges, phone numbers, GPAs, and ordinals are
 * never marked. The verb a line opens with is marked whenever the scorer
 * credits it ("Ran", "Hired", "Opened"), not only when it is on the list of
 * action verbs.
 */

export type HighlightToken =
  | { type: 'text'; text: string }
  | { type: 'number'; text: string }
  | { type: 'verb'; text: string }
  | { type: 'newline' };

type Span = { type: 'number' | 'verb'; start: number; end: number };

function lineSpans(line: string): Span[] {
  const spans: Span[] = findNumberSpans(line).map(({ start, end }) => ({
    type: 'number',
    start,
    end,
  }));
  const opening = leadingAction(line);
  if (opening && !opening.involvement) {
    const start = line.search(/[A-Za-z]/);
    if (start >= 0 && line.startsWith(opening.text, start)) {
      const end = start + opening.text.length;
      if (!spans.some((span) => start < span.end && end > span.start))
        spans.push({ type: 'verb', start, end });
    }
  }
  for (const match of line.matchAll(POWER_VERB_GLOBAL_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    // Numbers win where the two would overlap.
    if (spans.some((span) => start < span.end && end > span.start)) continue;
    spans.push({ type: 'verb', start, end });
  }
  return spans.sort((a, b) => a.start - b.start);
}

export function parseHighlightedResume(text: string): HighlightToken[] {
  if (!text) return [];
  const decoded = decodeEntities(text);
  const lines = decoded.split('\n');
  const achievementLines = new Set(detectResumeStructure(text).achievementLines);
  const tokens: HighlightToken[] = [];

  lines.forEach((line, index) => {
    if (index > 0) tokens.push({ type: 'newline' });
    if (!line) return;
    if (!achievementLines.has(index)) {
      tokens.push({ type: 'text', text: line });
      return;
    }
    let lastIndex = 0;
    for (const span of lineSpans(line)) {
      if (span.start > lastIndex) {
        tokens.push({ type: 'text', text: line.slice(lastIndex, span.start) });
      }
      tokens.push({ type: span.type, text: line.slice(span.start, span.end) });
      lastIndex = span.end;
    }
    if (lastIndex < line.length) tokens.push({ type: 'text', text: line.slice(lastIndex) });
  });

  return tokens;
}

export function highlightResume(text: string) {
  return parseHighlightedResume(text)
    .map((token) => {
      if (token.type === 'newline') return '\n';
      const escaped = escapeHtml(token.text);
      if (token.type === 'number') {
        return `<mark class="bg-primary/25 text-foreground font-semibold underline decoration-primary decoration-2 underline-offset-2 px-1 rounded">${escaped}</mark>`;
      }
      if (token.type === 'verb') {
        return `<mark class="bg-love/30 text-foreground px-1 rounded">${escaped}</mark>`;
      }
      return escaped;
    })
    .join('');
}
