import { POWER_VERB_PATTERN, POWER_VERB_START_PATTERN, getVerbStrength } from './constants';
import { analyzeReadability } from './readability';
import { normalizeLine } from './text';

/**
 * Bullet score rubric, 100 points total. Every component below is exactly
 * what the code checks, and a genuinely excellent bullet can reach 100:
 *
 * - Leading action verb (20): the first word is a recognized action verb.
 * - Verb strength (10): strong tier 10, medium 7, weak 3, no verb 0.
 * - Quantified result (25): at least one number, dollar amount, or percent.
 * - Outcome link (20): the action connects to a result with "by", "to",
 *   "resulting in", or "leading to".
 * - Concise length (15): 8 to 32 words reads in one pass.
 * - Readability (10): active voice and a scannable grade level.
 *
 * Example of a 100: "Automated weekly grant reporting in Excel to save the
 * lab 6 hours per week." Strong leading verb, number, outcome, 14 words.
 * Scores are clamped to 0-100.
 */
export function scoreBullet(bullet: string) {
  const normalized = normalizeLine(bullet).toLowerCase();
  if (!normalized) return 0;

  const hasVerb = POWER_VERB_PATTERN.test(normalized);
  const hasLeadingVerb = POWER_VERB_START_PATTERN.test(normalized);
  const hasNumber = /(\$?\d+[\d,]*\.?\d*%?)/.test(normalized);
  const length = normalized.split(/\s+/).filter(Boolean).length;
  const clarity = length >= 8 && length <= 32;
  const hasOutcomeLink = /(\bby\b|\bto\b|\bresult(ing)? in\b|\bleading to\b)/.test(normalized);

  const verbMatch = normalized.match(POWER_VERB_PATTERN);
  const verb = verbMatch?.[1] || '';
  const verbStrength = verb ? getVerbStrength(verb) : 'none';
  const verbScore = !hasVerb
    ? 0
    : verbStrength === 'strong'
      ? 10
      : verbStrength === 'medium'
        ? 7
        : 3;

  const readability = analyzeReadability(normalized);
  const readabilityScore = readability.isReadable ? 10 : 0;

  const score =
    (hasLeadingVerb ? 20 : 0) +
    verbScore +
    (hasNumber ? 25 : 0) +
    (hasOutcomeLink ? 20 : 0) +
    (clarity ? 15 : 0) +
    readabilityScore;

  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number) {
  if (score >= 80) return { label: 'High signal', color: 'text-[hsl(var(--love))]' };
  if (score >= 50) return { label: 'Moderate', color: 'text-[hsl(var(--gold))]' };
  return { label: 'Hidden value', color: 'text-[hsl(var(--iris))]' };
}
