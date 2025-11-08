import { POWER_VERB_PATTERN, POWER_WORDS } from './constants';
import { escapeRegExp, normalizeLine } from './text';

export function scoreBullet(bullet: string) {
  const normalized = normalizeLine(bullet).toLowerCase();
  if (!normalized) return 0;
  const hasVerb = POWER_VERB_PATTERN.test(normalized);
  const hasLeadingVerb = new RegExp(`^(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i').test(normalized);
  const hasNumber = /(\$?\d+[\d,]*\.?\d*%?)/.test(normalized);
  const length = normalized.split(/\s+/).length;
  const clarity = length >= 8 && length <= 32;
  const structure = /(\bby\b|\bto\b|\bresult(ing)? in\b|\bleading to\b)/.test(normalized) ? 15 : 0;
  let score =
    (hasVerb ? 30 : 0) +
    (hasLeadingVerb ? 10 : 0) +
    (hasNumber ? 35 : 0) +
    (clarity ? 10 : 0) +
    structure;
  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number) {
  if (score >= 80) return { label: 'High signal', color: 'text-emerald-300' };
  if (score >= 50) return { label: 'Moderate', color: 'text-amber-300' };
  return { label: 'Hidden value', color: 'text-rose-300' };
}
