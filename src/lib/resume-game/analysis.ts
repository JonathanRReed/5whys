import {
  POWER_VERB_PATTERN,
  POWER_WORDS,
  WEAK_WORDS,
  ATS_KEYWORDS,
  STOPWORDS,
  POWER_VERBS_STRONG,
} from './constants';
import { scoreBullet } from './scoring';
import { analyzeReadability } from './readability';
import { capitalizeWord, escapeRegExp, normalizeLine, normalizeTextLine, uniqueId } from './text';
import type { BulletFields, BulletRecord, RepetitiveVerb, SignalReport } from './types';

// ============================================================================
// Weak Word Detection
// ============================================================================

export function detectWeakWords(bullet: string): string[] {
  const lower = bullet.toLowerCase();
  const found: string[] = [];
  for (const word of WEAK_WORDS) {
    if (lower.includes(word.toLowerCase())) {
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
  /\b(users|customers|clients|patients|members)\b/i,
  /\b(nps|churn|retention|adoption|conversion|engagement|satisfaction)\b/i,
  /\b\d+\.?\d*%?\b/i, // any number is treated as potential quantified impact
];

const SCOPE_SIGNAL_PATTERNS = [
  /\b(team of \d+|\d+-person|\d+ engineers|\d+ designers)\b/i,
  /\b(region|regions|global|worldwide|nationwide|across \d+|\d+ countries)\b/i,
  /\b(\d+ customers|\d+ clients|\d+ users|\d+ accounts)\b/i,
];

const QUALITATIVE_IMPACT_PATTERNS = [
  /\b(transformed|streamlined|eliminated|reduced|increased|improved|optimized|accelerated|simplified|automated|consolidated|standardized)\b/i,
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
  const lower = text.toLowerCase();
  const found = ATS_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
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

export function computeBenchmarkScore(
  bullets: BulletRecord[]
): { score: number; details: Record<string, number> } {
  if (bullets.length === 0) {
    return { score: 0, details: {} };
  }

  const totalBullets = bullets.length;

  // 1. Number coverage (target 70%) — 25 pts
  const quantified = bullets.filter((b) => /\d/.test(b.improved)).length;
  const numberCoverage = quantified / totalBullets;
  const numberScore = clamp((numberCoverage / 0.7) * 25, 0, 25);

  // 2. Unique strong verbs (target 8+) — 15 pts
  const uniqueVerbs = new Set(
    bullets.map((b) => b.fields.verb?.toLowerCase()).filter(Boolean)
  );
  const uniqueStrongVerbs = new Set(
    bullets
      .map((b) => b.fields.verb?.toLowerCase())
      .filter((v): v is string => !!v && POWER_VERBS_STRONG.includes(v))
  );
  const verbScore = clamp((uniqueStrongVerbs.size / 8) * 15, 0, 15);

  // 3. Bullet length (target < 30 words avg) — 20 pts
  const avgLength =
    bullets.reduce((sum, b) => {
      const words = b.improved.split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0) / totalBullets;
  const lengthScore = avgLength <= 30 ? 20 : avgLength <= 40 ? 10 : 0;

  // 4. Passive voice avoidance — 15 pts
  let passiveBullets = 0;
  for (const b of bullets) {
    const r = analyzeReadability(b.improved);
    if (r.passiveVoiceCount > 0) passiveBullets++;
  }
  const passivePercent = passiveBullets / totalBullets;
  const passiveScore = clamp((1 - passivePercent) * 15, 0, 15);

  // 5. Impact coverage — 20 pts
  const impactBullets = bullets.filter((b) => b.hasImpact ?? detectImpact(b.improved)).length;
  const impactPercent = impactBullets / totalBullets;
  const impactScore = clamp(impactPercent * 20, 0, 20);

  // 6. Weak word penalty — up to -10 pts
  const totalWeakWords = bullets.reduce((sum, b) => sum + (b.weakWords?.length ?? 0), 0);
  const weakPenalty = clamp(totalWeakWords * 2, 0, 10);

  const rawScore = numberScore + verbScore + lengthScore + passiveScore + impactScore - weakPenalty;
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    score,
    details: {
      numberScore,
      verbScore,
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
// Deep Signal Report
// ============================================================================

export function buildDeepSignalReport(
  bullets: BulletRecord[],
  resumeText: string
): SignalReport {
  const enriched = enrichBulletRecords(bullets);
  const benchmark = computeBenchmarkScore(enriched);
  const keywordDensity = computeKeywordDensity(resumeText);
  const atsKeywords = detectAtsKeywords(resumeText);

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

  const weakWordCount = enriched.reduce((sum, b) => sum + (b.weakWords?.length ?? 0), 0);
  const impactBullets = enriched.filter((b) => b.hasImpact ?? false).length;
  const impactCoverage = enriched.length > 0 ? Math.round((impactBullets / enriched.length) * 100) : 0;

  const quantifiedBullets = enriched.filter((b) => /\d/.test(b.improved)).length;
  const quantifiedBulletPercent = enriched.length > 0 ? Math.round((quantifiedBullets / enriched.length) * 100) : 0;

  const avgBulletLength = enriched.length > 0
    ? enriched.reduce((sum, b) => sum + b.improved.split(/\s+/).filter(Boolean).length, 0) / enriched.length
    : 0;

  let passiveBullets = 0;
  for (const b of enriched) {
    const r = analyzeReadability(b.improved);
    if (r.passiveVoiceCount > 0) passiveBullets++;
  }
  const passiveVoicePercent = enriched.length > 0 ? Math.round((passiveBullets / enriched.length) * 100) : 0;

  return {
    visible: 0,
    hidden: 100,
    numbers: 0,
    verbs: 0,
    wordCount: 0,
    bulletCount: enriched.length,
    estimatedPages: 0,
    sections: [],
    hardSkills: [],
    softSkills: [],
    isOptimalLength: false,
    lengthRecommendation: '',
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
  const verbMatch = cleaned.match(new RegExp(`^(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i'))
    || cleaned.match(new RegExp(`\\b(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i'));
  const verb = verbMatch ? verbMatch[1] : '';
  const remainder = verb ? cleaned.replace(new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i'), '').trim() : cleaned;
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
    const needsConnector = !normalized.toLowerCase().startsWith('to') && !normalized.toLowerCase().startsWith('by');
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
  const startsWithVerb = new RegExp(`^(${POWER_WORDS.map(escapeRegExp).join('|')})\b`, 'i').test(normalized);
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

export function createBulletRecord(line: string, index: number): BulletRecord {
  const sanitized = line.replace(/\s+/g, ' ').trim();
  const fields = seedFields(sanitized);
  const improved = buildBullet(fields);
  const bonus = fieldBonus(fields) + editBonus(sanitized, fields);
  const weakWords = detectWeakWords(sanitized);
  const hasImpact = detectImpact(sanitized);
  return {
    id: uniqueId('bullet', index),
    original: sanitized.replace(/^[-•*]\s*/, ''),
    fields,
    baselineScore: scoreBullet(sanitized),
    improved,
    improvedScore: scoreBullet(improved) + bonus,
    weakWords,
    hasImpact,
  };
}
