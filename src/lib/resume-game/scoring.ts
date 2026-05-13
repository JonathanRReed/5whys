import { POWER_VERB_PATTERN, POWER_WORDS, getVerbStrength } from './constants';
import { analyzeReadability } from './readability';
import { escapeRegExp, normalizeLine } from './text';

/**
 * Scoring weights informed by recruiter behavior research:
 * - Leading verb (20%): recruiters scan first 3-5 words first
 * - Quantification (25%): metrics are the #1 attention signal
 * - Verb strength (15%): strong verbs correlate with higher perceived impact
 * - Impact statement (15%): "by/to/resulting in" shows business thinking
 * - Clarity (10%): 8-32 words is the sweet spot for scanability
 * - Readability (10%): grade level and passive voice affect comprehension
 * - Structure (5%): polish that adds professionalism
 */
export function scoreBullet(bullet: string) {
  const normalized = normalizeLine(bullet).toLowerCase();
  if (!normalized) return 0;

  const hasVerb = POWER_VERB_PATTERN.test(normalized);
  const hasLeadingVerb = new RegExp(
    `^(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`,
    'i'
  ).test(normalized);
  const hasNumber = /(\$?\d+[\d,]*\.?\d*%?)/.test(normalized);
  const length = normalized.split(/\s+/).filter(Boolean).length;
  const clarity = length >= 8 && length <= 32;
  const structure = /(\bby\b|\bto\b|\bresult(ing)? in\b|\bleading to\b)/.test(normalized) ? 15 : 0;

  // Verb strength scoring
  const verbMatch = normalized.match(
    new RegExp(`\\b(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i')
  );
  const verb = verbMatch?.[1] || '';
  const verbStrength = verb ? getVerbStrength(verb) : 'none';
  const verbScore =
    !hasVerb ? 0 : verbStrength === 'strong' ? 15 : verbStrength === 'medium' ? 10 : 5;

  // Readability
  const readability = analyzeReadability(normalized);
  const readabilityScore = readability.isReadable ? 10 : 0;

  let score =
    (hasLeadingVerb ? 20 : 0) +
    verbScore +
    (hasNumber ? 25 : 0) +
    structure +
    (clarity ? 10 : 0) +
    readabilityScore;

  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number) {
  if (score >= 80) return { label: 'High signal', color: 'text-[hsl(var(--love))]' };
  if (score >= 50) return { label: 'Moderate', color: 'text-[hsl(var(--gold))]' };
  return { label: 'Hidden value', color: 'text-[hsl(var(--iris))]' };
}
