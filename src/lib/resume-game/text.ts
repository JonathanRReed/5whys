import { POWER_VERB_GLOBAL_PATTERN } from './constants';

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const HEADINGS = new Set([
  'summary',
  'education',
  'experience',
  'skills',
  'contact',
  'interests',
  'projects',
]);
const MONTHS =
  '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)';
const DATE_RANGE_PATTERN = new RegExp(
  `^(${MONTHS}\\s+\\d{4}|\\d{4})(\\s*[–-]\\s*(${MONTHS}\\s+\\d{4}|\\d{4}|current))?$`,
  'i'
);

export function escapeRegExp(value: string) {
  return value.replace(REGEX_SPECIAL_CHARS, '\\$&');
}

export function decodeEntities(text: string) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function capitalizeWord(value: string) {
  if (!value) return '';
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeLine(raw: string) {
  const decoded = decodeEntities(raw)
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!decoded) return '';
  const heading = decoded.toLowerCase();
  if (HEADINGS.has(heading)) return '';
  if (DATE_RANGE_PATTERN.test(decoded)) return '';
  if (decoded.replace(/[^a-zA-Z0-9]/g, '').length < 3) return '';
  return decoded;
}

export type HighlightToken =
  | { type: 'text'; text: string }
  | { type: 'number'; text: string }
  | { type: 'verb'; text: string }
  | { type: 'newline' };

// Pre-compile the tokenizing regex at module scope to avoid re-compiling a regex
// with over 130 power verb alternatives on every line during resume highlighting/parsing.
const COMBINED_HIGHLIGHT_PATTERN = new RegExp(
  `(\\d+\\.?\\d*%?)|(${POWER_VERB_GLOBAL_PATTERN.source})`,
  'gi'
);

export function parseHighlightedResume(text: string): HighlightToken[] {
  if (!text) return [];
  const decoded = decodeEntities(text);
  const lines = decoded.split('\n');
  const tokens: HighlightToken[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      tokens.push({ type: 'newline' });
    }
    const line = lines[i];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    COMBINED_HIGHLIGHT_PATTERN.lastIndex = 0;
    match = COMBINED_HIGHLIGHT_PATTERN.exec(line);
    while (match !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', text: line.slice(lastIndex, match.index) });
      }
      const matchedStr = match[0];
      if (match[1] !== undefined) {
        tokens.push({ type: 'number', text: matchedStr });
      } else {
        tokens.push({ type: 'verb', text: matchedStr });
      }
      lastIndex = COMBINED_HIGHLIGHT_PATTERN.lastIndex;
      match = COMBINED_HIGHLIGHT_PATTERN.exec(line);
    }

    if (lastIndex < line.length) {
      tokens.push({ type: 'text', text: line.slice(lastIndex) });
    }
  }

  return tokens;
}

export function highlightResume(text: string) {
  return parseHighlightedResume(text)
    .map((token) => {
      if (token.type === 'newline') return '\n';
      const escaped = escapeHtml(token.text);
      if (token.type === 'number') {
        return `<mark class="bg-primary/30 text-primary-foreground px-1 rounded">${escaped}</mark>`;
      }
      if (token.type === 'verb') {
        return `<mark class="bg-love/30 text-foreground px-1 rounded">${escaped}</mark>`;
      }
      return escaped;
    })
    .join('');
}

export function countPowerVerbs(text: string) {
  if (!text) return 0;
  const matches = decodeEntities(text).match(POWER_VERB_GLOBAL_PATTERN);
  return matches ? matches.length : 0;
}

export function uniqueId(prefix: string, index: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${index}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}
