import {
  POWER_VERB_PATTERN,
  POWER_VERB_START_PATTERN,
  WEAK_WORDS,
  ATS_KEYWORDS,
  STOPWORDS,
  POWER_VERBS_STRONG,
  getVerbStrength,
  extractSkills,
  matchesTerm,
} from './constants';
import { scoreBullet } from './scoring';
import { analyzeReadability } from './readability';
import { analyzeResumeLength } from './length';
import {
  capitalizeWord,
  countPowerVerbs,
  escapeRegExp,
  normalizeLine,
  normalizeTextLine,
  uniqueId,
} from './text';
import type { BulletFields, BulletRecord, RepetitiveVerb, SignalReport } from './types';

// ============================================================================
// Weak Word Detection
// ============================================================================

export function detectWeakWords(bullet: string): string[] {
  const found: string[] = [];
  for (const word of WEAK_WORDS) {
    if (matchesTerm(bullet, word)) {
      found.push(word);
    }
  }
  return found;
}

// ============================================================================
// Impact Detection ("So What" Test)
// ============================================================================

const BUSINESS_OUTCOME_PATTERNS = [
  /\b(revenue|sales|profit|margin|cost|expense|budget|roi)\b/i,
  /\b(time|hours|days|weeks|months)\b/i,
  /\b(users|customers|clients|patients|members|students|volunteers|attendees|participants|readers|followers)\b/i,
  /\b(nps|churn|retention|adoption|conversion|engagement|satisfaction)\b/i,
  /\b\d+\.?\d*%?\b/i, // any number is treated as potential quantified impact
];

const SCOPE_SIGNAL_PATTERNS = [
  /\b(team of \d+|\d+-person|\d+ engineers|\d+ designers|\d+ tutors|\d+ volunteers)\b/i,
  /\b(region|regions|global|worldwide|nationwide|campus-wide|across \d+|\d+ countries)\b/i,
  /\b(\d+ customers|\d+ clients|\d+ users|\d+ accounts|\d+ students|\d+ attendees|\d+ members|\d+ events|\d+ sections)\b/i,
  /\b(weekly|monthly|daily|per (week|shift|semester|month)|every (week|semester|game|shift|event))\b/i,
];

const QUALITATIVE_IMPACT_PATTERNS = [
  /\b(transformed|streamlined|eliminated|reduced|increased|improved|optimized|accelerated|simplified|automated|consolidated|standardized|doubled|cut|saved|grew|raised)\b/i,
];

export function detectImpact(bullet: string): boolean {
  const lower = bullet.toLowerCase();
  const hasBusinessOutcome = BUSINESS_OUTCOME_PATTERNS.some((p) => p.test(lower));
  const hasScopeSignal = SCOPE_SIGNAL_PATTERNS.some((p) => p.test(lower));
  const hasQualitativeImpact = QUALITATIVE_IMPACT_PATTERNS.some((p) => p.test(lower));
  return hasBusinessOutcome || hasScopeSignal || hasQualitativeImpact;
}

// ============================================================================
// Repetitive Verb Detection
// ============================================================================

export function detectRepetitiveVerbs(bullets: BulletRecord[]): RepetitiveVerb[] {
  const counts: Record<string, number> = {};
  for (const bullet of bullets) {
    const verb = bullet.fields.verb?.toLowerCase();
    if (verb) {
      counts[verb] = (counts[verb] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .map(([verb, count]) => ({ verb, count }));
}

export function enrichBulletRecords(bullets: BulletRecord[]): BulletRecord[] {
  const repetitive = detectRepetitiveVerbs(bullets);
  const repetitiveSet = new Set(repetitive.map((r) => r.verb.toLowerCase()));
  return bullets.map((bullet) => ({
    ...bullet,
    isRepetitiveVerb: bullet.fields.verb
      ? repetitiveSet.has(bullet.fields.verb.toLowerCase())
      : false,
  }));
}

// ============================================================================
// Keyword Density
// ============================================================================

export function computeKeywordDensity(text: string): { word: string; count: number }[] {
  const lower = text.toLowerCase();
  // Tokenize: keep only alphabetic words 3+ chars
  const tokens = lower.match(/[a-z]{3,}/g) || [];
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    counts[token] = (counts[token] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export function detectAtsKeywords(text: string): string[] {
  const found = ATS_KEYWORDS.filter((kw) => matchesTerm(text, kw));
  return [...new Set(found)];
}

// ============================================================================
// Benchmark / Resume Health Score
// ============================================================================

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Resume health rubric, 100 points total:
 * - Quantified bullets (30): share of bullets with a number, scaled to a
 *   70% coverage target.
 * - Verb variety (10): unique action verbs, target one per bullet up to 8.
 * - Strong verbs (5): 5 points with two or more strong-tier verbs, 3 with one.
 * - Bullet length (20): average of 30 words or fewer; 10 points up to 40.
 * - Active voice (15): share of bullets with no passive construction.
 * - Impact coverage (20): share of bullets showing an outcome, scope, or
 *   qualitative change.
 * - Hedging penalty: minus 2 per hedging phrase, capped at minus 10.
 * Result is clamped to 0-100.
 */
export function computeBenchmarkScore(bullets: BulletRecord[]): {
  score: number;
  details: Record<string, number>;
} {
  if (bullets.length === 0) {
    return { score: 0, details: {} };
  }

  const totalBullets = bullets.length;

  // 1. Number coverage (target 70%): 30 pts
  const quantified = bullets.filter((b) => /\d/.test(b.improved)).length;
  const numberCoverage = quantified / totalBullets;
  const numberScore = clamp((numberCoverage / 0.7) * 30, 0, 30);

  // 2. Verb variety (target one unique verb per bullet, up to 8): 10 pts
  const uniqueVerbs = new Set(bullets.map((b) => b.fields.verb?.toLowerCase()).filter(Boolean));
  const varietyTarget = Math.min(8, totalBullets);
  const varietyScore = clamp((uniqueVerbs.size / Math.max(1, varietyTarget)) * 10, 0, 10);

  // 3. Strong-tier verbs: 5 pts with two or more, 3 with one
  const uniqueStrongVerbs = new Set(
    bullets
      .map((b) => b.fields.verb?.toLowerCase())
      .filter((v): v is string => !!v && POWER_VERBS_STRONG.includes(v))
  );
  const strongScore = uniqueStrongVerbs.size >= 2 ? 5 : uniqueStrongVerbs.size === 1 ? 3 : 0;

  // 4. Bullet length (target 30 words avg or fewer): 20 pts
  const avgLength =
    bullets.reduce((sum, b) => {
      const words = b.improved.split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0) / totalBullets;
  const lengthScore = avgLength <= 30 ? 20 : avgLength <= 40 ? 10 : 0;

  // 5. Active voice: 15 pts
  let passiveBullets = 0;
  for (const b of bullets) {
    const r = analyzeReadability(b.improved);
    if (r.passiveVoiceCount > 0) passiveBullets++;
  }
  const passivePercent = passiveBullets / totalBullets;
  const passiveScore = clamp((1 - passivePercent) * 15, 0, 15);

  // 6. Impact coverage: 20 pts
  const impactBullets = bullets.filter((b) => b.hasImpact ?? detectImpact(b.improved)).length;
  const impactPercent = impactBullets / totalBullets;
  const impactScore = clamp(impactPercent * 20, 0, 20);

  // 7. Hedging penalty: up to minus 10 pts
  const totalWeakWords = bullets.reduce((sum, b) => sum + (b.weakWords?.length ?? 0), 0);
  const weakPenalty = clamp(totalWeakWords * 2, 0, 10);

  const rawScore =
    numberScore + varietyScore + strongScore + lengthScore + passiveScore + impactScore -
    weakPenalty;
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    score,
    details: {
      numberScore,
      varietyScore,
      strongScore,
      lengthScore,
      passiveScore,
      impactScore,
      weakPenalty,
      avgLength,
      passivePercent,
      impactPercent,
      uniqueVerbCount: uniqueVerbs.size,
      uniqueStrongVerbCount: uniqueStrongVerbs.size,
    },
  };
}

// ============================================================================
// Signal Strength
// ============================================================================

/**
 * Per-bullet visibility signal, 100 points total:
 * - Leading verb (25 strong tier, 20 any tier, 10 buried mid-sentence)
 * - Any number (25)
 * - Outcome connector: by, to, resulting in, leading to (20)
 * - Recognized hard skill (15)
 * - Bullet score tier (15 at 70+, 10 at 50+, 5 below)
 */
function computeBulletSignal(record: BulletRecord, hardSkills: string[]): number {
  const line = normalizeLine(record.improved);
  let signal = 0;

  const startMatch = line.match(POWER_VERB_START_PATTERN);
  if (startMatch && getVerbStrength(startMatch[1]) === 'strong') signal += 25;
  else if (startMatch) signal += 20;
  else if (POWER_VERB_PATTERN.test(line)) signal += 10;

  if (/\d/.test(line)) signal += 25;
  if (/\b(by|to|resulting in|leading to)\b/i.test(line)) signal += 20;
  if (hardSkills.some((skill) => matchesTerm(line, skill))) signal += 15;
  signal += record.improvedScore >= 70 ? 15 : record.improvedScore >= 50 ? 10 : 5;

  return Math.min(100, signal);
}

// ============================================================================
// Deep Signal Report
// ============================================================================

/**
 * Builds the complete signal report used by the live scan and restored
 * sessions: surface metrics (signal strength, counts, length, sections,
 * skills) plus the deep metrics (health score, weak words, repetition,
 * impact coverage, keyword density). This is the single source of truth for
 * SignalReport values; nothing here is fabricated when data is missing.
 */
export function buildDeepSignalReport(bullets: BulletRecord[], resumeText: string): SignalReport {
  const enriched = enrichBulletRecords(bullets);
  const benchmark = computeBenchmarkScore(enriched);
  const keywordDensity = computeKeywordDensity(resumeText);
  const atsKeywords = detectAtsKeywords(resumeText);
  const lengthAnalysis = analyzeResumeLength(resumeText, enriched.length);
  const skills = extractSkills(resumeText);
  const verbCount = countPowerVerbs(resumeText);
  const numberMatches = resumeText.match(/\d+\.?\d*%?/g) ?? [];

  // Merge ATS keywords into keywordDensity for visibility
  const atsDensity = atsKeywords.map((word) => {
    const existing = keywordDensity.find((k) => k.word === word.toLowerCase());
    return {
      word: word.toLowerCase(),
      count: existing?.count ?? 1,
    };
  });
  const mergedDensity = [...keywordDensity];
  for (const item of atsDensity) {
    if (!mergedDensity.some((k) => k.word === item.word)) {
      mergedDensity.push(item);
    }
  }
  mergedDensity.sort((a, b) => b.count - a.count);

  const visible =
    enriched.length > 0
      ? Math.round(
          enriched.reduce((sum, b) => sum + computeBulletSignal(b, skills.hard), 0) /
            enriched.length
        )
      : 0;

  const weakWordCount = enriched.reduce((sum, b) => sum + (b.weakWords?.length ?? 0), 0);
  const impactBullets = enriched.filter((b) => b.hasImpact ?? false).length;
  const impactCoverage =
    enriched.length > 0 ? Math.round((impactBullets / enriched.length) * 100) : 0;

  const quantifiedBullets = enriched.filter((b) => /\d/.test(b.improved)).length;
  const quantifiedBulletPercent =
    enriched.length > 0 ? Math.round((quantifiedBullets / enriched.length) * 100) : 0;

  const avgBulletLength =
    enriched.length > 0
      ? enriched.reduce((sum, b) => sum + b.improved.split(/\s+/).filter(Boolean).length, 0) /
        enriched.length
      : 0;

  let passiveBullets = 0;
  for (const b of enriched) {
    const r = analyzeReadability(b.improved);
    if (r.passiveVoiceCount > 0) passiveBullets++;
  }
  const passiveVoicePercent =
    enriched.length > 0 ? Math.round((passiveBullets / enriched.length) * 100) : 0;

  return {
    visible,
    hidden: 100 - visible,
    numbers: numberMatches.length,
    verbs: verbCount,
    wordCount: lengthAnalysis.wordCount,
    bulletCount: lengthAnalysis.bulletCount,
    estimatedPages: lengthAnalysis.estimatedPages,
    sections: lengthAnalysis.sections,
    hardSkills: skills.hard,
    softSkills: skills.soft,
    isOptimalLength: lengthAnalysis.isOptimalLength,
    lengthRecommendation: lengthAnalysis.recommendation,
    weakWordCount,
    repetitiveVerbs: detectRepetitiveVerbs(enriched),
    impactCoverage,
    keywordDensity: mergedDensity.slice(0, 20),
    benchmarkScore: benchmark.score,
    uniqueVerbCount: benchmark.details.uniqueVerbCount,
    quantifiedBulletPercent,
    avgBulletLength: Math.round(avgBulletLength * 10) / 10,
    passiveVoicePercent,
  };
}

export function extractBullets(text: string): string[] {
  const preferred = text.match(/^[-•*]\s+.+$/gm);
  const source = preferred && preferred.length > 0 ? preferred : text.split('\n');
  return source.map((line) => normalizeTextLine(line)).filter(Boolean);
}

export function seedFields(text: string): BulletFields {
  const cleaned = normalizeLine(text);
  const verbMatch = cleaned.match(POWER_VERB_START_PATTERN) || cleaned.match(POWER_VERB_PATTERN);
  const verb = verbMatch ? verbMatch[1] : '';
  const remainder = verb
    ? cleaned.replace(new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i'), '').trim()
    : cleaned;
  let task = remainder;
  let impact = '';

  const byIndex = remainder.toLowerCase().indexOf(' by ');
  const toIndex = remainder.toLowerCase().indexOf(' to ');
  const splitIndex = byIndex >= 0 ? byIndex : toIndex;
  if (splitIndex >= 0) {
    task = remainder.slice(0, splitIndex).trim();
    impact = remainder.slice(splitIndex).trim();
  }

  const quantifier = cleaned.match(/\d+\.?\d*%?/g)?.[0] ?? '';

  return {
    verb: capitalizeWord(verb),
    task: task.trim(),
    impact,
    quantifier,
  };
}

export function buildBullet(fields: BulletFields) {
  const parts: string[] = [];
  if (fields.verb) parts.push(capitalizeWord(fields.verb));
  if (fields.task) parts.push(fields.task.trim());
  let statement = parts.join(' ');
  if (fields.impact) {
    const normalized = fields.impact.trim();
    const needsConnector =
      !normalized.toLowerCase().startsWith('to') && !normalized.toLowerCase().startsWith('by');
    statement += needsConnector ? ` to ${normalized}` : ` ${normalized}`;
  }
  if (fields.quantifier) {
    statement += statement.includes(fields.quantifier) ? '' : ` (${fields.quantifier.trim()})`;
  }
  let out = `• ${statement.replace(/\s+/g, ' ').trim()}`;
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

export function fieldBonus(fields: BulletFields) {
  let bonus = 0;
  if (fields.verb.trim()) bonus += 5;
  if (fields.quantifier.trim()) bonus += 5;
  if (fields.impact.trim()) bonus += 5;
  return bonus;
}

export function editBonus(original: string, fields: BulletFields) {
  const normalized = normalizeLine(original);
  const startsWithVerb = POWER_VERB_START_PATTERN.test(normalized);
  const hasAnyVerb = POWER_VERB_PATTERN.test(normalized);
  let bonus = 0;
  if (!startsWithVerb && fields.verb.trim()) bonus += 4;
  if (fields.quantifier.trim() && !/(\$?\d+[\d,]*\.?\d*%?)/.test(normalized)) bonus += 4;
  if (fields.impact.trim() && !/(\bby\b|\bto\b)/.test(normalized)) bonus += 3;
  const rebuilt = normalizeLine(buildBullet(fields));
  if (rebuilt !== normalized) bonus += 2;
  if (!hasAnyVerb && fields.verb.trim()) bonus += 2;
  return bonus;
}

/**
 * Combined bullet score: base rubric score plus field and edit bonuses,
 * clamped so no user-visible score ever exceeds 100.
 */
export function combinedBulletScore(improved: string, original: string, fields: BulletFields) {
  const bonus = fieldBonus(fields) + editBonus(original, fields);
  return Math.max(0, Math.min(100, scoreBullet(improved) + bonus));
}

export function createBulletRecord(line: string, index: number): BulletRecord {
  const sanitized = line.replace(/\s+/g, ' ').trim();
  const fields = seedFields(sanitized);
  const improved = buildBullet(fields);
  const weakWords = detectWeakWords(sanitized);
  const hasImpact = detectImpact(sanitized);
  return {
    id: uniqueId('bullet', index),
    original: sanitized.replace(/^[-•*]\s*/, ''),
    fields,
    baselineScore: scoreBullet(sanitized),
    improved,
    improvedScore: combinedBulletScore(improved, sanitized, fields),
    weakWords,
    hasImpact,
  };
}
