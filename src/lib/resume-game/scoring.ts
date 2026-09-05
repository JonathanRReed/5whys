import { BULLET_START_PATTERN, getVerbStrength, POWER_VERB_PATTERN } from './constants';
import { analyzeReadability } from './readability';
import { normalizeLine } from './text';

// A number that reads as a measure: counts, money, percentages, multipliers.
// Years, date ranges, and phone-shaped digit runs are not measures, so
// "Member of Chess Club 2022-2024" earns nothing for its digits.
const NUMBER_TOKEN = /\$?\d[\d,]*(?:\.\d+)?%?(?:[kKmMxX]\b)?/g;
const YEAR = /^(?:19|20)\d{2}$/;
const DATE_RANGE = /\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/gi;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g;
const ORDINAL = /^\d+(?:st|nd|rd|th)$/i;

/** Every measure-like number in a line, with years and phone numbers removed. */
export function findQuantifiers(text: string): string[] {
  const stripped = text.replace(DATE_RANGE, ' ').replace(PHONE, ' ');
  const tokens = stripped.match(NUMBER_TOKEN) ?? [];
  return tokens.filter((token) => {
    const bare = token.replace(/[$,%kKmMxX]/g, '');
    if (YEAR.test(bare) && !/[$%]/.test(token)) return false;
    if (ORDINAL.test(token)) return false;
    return true;
  });
}

export function hasQuantifier(text: string): boolean {
  return findQuantifiers(text).length > 0;
}

// The action has to connect to a result. A bare "to" is not enough ("went to
// the store"); the connector must lead into an outcome verb, a number, or a
// gerund that names the mechanism ("by batching approvals").
const OUTCOME_LINK_PATTERN =
  /\b(?:resulting in|leading to|which (?:led|resulted|saved|cut|grew|raised|reduced|increased|improved|doubled|freed|kept|made)|so that|by \$?\d|by [a-z]+ing\b|to (?:increase|decrease|reduce|cut|save|improve|boost|grow|raise|lower|double|triple|help|support|enable|deliver|reach|serve|speed|accelerate|streamline|eliminate|drive|generate|win|secure|keep|ensure|meet|exceed|bring|free|land|fill|recover|prevent|resolve))\b/i;

export function hasOutcomeLink(text: string): boolean {
  return OUTCOME_LINK_PATTERN.test(text);
}

/**
 * Bullet score rubric, 100 points total. Every component below is exactly
 * what the code checks, and a genuinely excellent bullet can reach 100:
 *
 * - Leading action verb (20): the first word is an action verb. A weak
 *   verb of involvement ("helped", "responsible") earns 8.
 * - Verb strength (10): strong tier 10, medium 7, weak 3, no verb 0.
 * - Quantified result (25): a count, amount, percentage, or multiplier.
 *   Years, date ranges, and phone numbers do not count.
 * - Outcome link (20): the action connects to a result ("by batching...",
 *   "to cut...", "resulting in...").
 * - Concise length (15): 8 to 32 words reads in one pass.
 * - Readability (10): active voice and a scannable grade level.
 *
 * Example of a 100: "Automated weekly grant reporting in Excel to save the
 * lab 6 hours per week." Strong leading verb, number, outcome, 14 words.
 * Scores are clamped to 0-100. There are no bonuses: the score is the line.
 */
export function scoreBullet(bullet: string) {
  const normalized = normalizeLine(bullet).toLowerCase();
  if (!normalized) return 0;

  const leadingMatch = normalized.match(BULLET_START_PATTERN);
  const anyVerbMatch = normalized.match(POWER_VERB_PATTERN);
  const verb = leadingMatch?.[1] || anyVerbMatch?.[1] || '';
  const verbStrength = verb ? getVerbStrength(verb) : 'none';

  const leadingScore = !leadingMatch ? 0 : verbStrength === 'weak' ? 8 : 20;
  const verbScore =
    verbStrength === 'none'
      ? 0
      : verbStrength === 'strong'
        ? 10
        : verbStrength === 'medium'
          ? 7
          : 3;

  const length = normalized.split(/\s+/).filter(Boolean).length;
  const clarity = length >= 8 && length <= 32;

  const readability = analyzeReadability(normalized);
  const readabilityScore = readability.isReadable ? 10 : 0;

  const score =
    leadingScore +
    verbScore +
    (hasQuantifier(normalized) ? 25 : 0) +
    (hasOutcomeLink(normalized) ? 20 : 0) +
    (clarity ? 15 : 0) +
    readabilityScore;

  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number) {
  if (score >= 80) return { label: 'High signal', color: 'text-love' };
  if (score >= 50) return { label: 'Moderate', color: 'text-gold' };
  return { label: 'Hidden value', color: 'text-iris' };
}
