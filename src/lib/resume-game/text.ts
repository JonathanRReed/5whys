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

/**
 * Fast-path optimization: Skip 6 global regex replacements when no ampersand is present.
 * Reduces CPU time during real-time resume line scanning and scoring when typing.
 */
export function decodeEntities(text: string) {
  if (!text) return '';
  if (!text.includes('&')) return text;
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

/**
 * Fast-path optimization: Skip 5 sequential global regex replacements when no HTML special chars
 * (`&`, `<`, `>`, `"`, `'`) are present. Drastically reduces regex overhead and string allocations
 * when rendering/highlighting thousands of tokens during live resume scanning and editing.
 */
export function escapeHtml(value: string) {
  if (!value) return '';
  if (!/[&<>"']/.test(value)) return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Anchor the scan to avoid quadratic retries on lines with fewer than 3 ASCII alphanumerics.
const ALPHANUMERIC_3_PATTERN = /^(?:[^a-zA-Z0-9]*[a-zA-Z0-9]){3}/;

export function normalizeLine(raw: string) {
  const decoded = decodeEntities(raw)
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!decoded) return '';
  const heading = decoded.toLowerCase();
  if (HEADINGS.has(heading)) return '';
  if (DATE_RANGE_PATTERN.test(decoded)) return '';
  if (!ALPHANUMERIC_3_PATTERN.test(decoded)) return '';
  return decoded;
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
