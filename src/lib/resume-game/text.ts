import { POWER_WORDS } from './constants';

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const HEADINGS = new Set(['summary', 'education', 'experience', 'skills', 'contact', 'interests', 'projects']);
const MONTHS = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)';
const DATE_RANGE_PATTERN = new RegExp(`^(${MONTHS}\\s+\\d{4}|\\d{4})(\\s*[–-]\\s*(${MONTHS}\\s+\\d{4}|\\d{4}|current))?$`, 'i');

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
  const decoded = decodeEntities(raw).replace(/^[-•*]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!decoded) return '';
  const heading = decoded.toLowerCase();
  if (HEADINGS.has(heading)) return '';
  if (DATE_RANGE_PATTERN.test(decoded)) return '';
  if (decoded.replace(/[^a-zA-Z0-9]/g, '').length < 3) return '';
  return decoded;
}

export function normalizeTextLine(raw: string): string {
  const normalized = normalizeLine(raw);
  if (!normalized) return '';
  return `• ${normalized}`;
}

export function highlightResume(text: string) {
  if (!text) return '';
  const escaped = escapeHtml(decodeEntities(text));
  return escaped
    .replace(
      /\d+\.?\d*%?/g,
      '<mark class="bg-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary-foreground))] px-1 rounded">$&</mark>'
    )
    .replace(
      new RegExp(`\\b(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'gi'),
      '<mark class="bg-[hsl(var(--love)/0.3)] text-[hsl(var(--love-foreground))] px-1 rounded">$&</mark>'
    );
}

export function countPowerVerbs(text: string) {
  if (!text) return 0;
  const matches = decodeEntities(text).match(new RegExp(`\\b(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'gi'));
  return matches ? matches.length : 0;
}

export function uniqueId(prefix: string, index: number) {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}
