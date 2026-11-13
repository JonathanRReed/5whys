import { ATS_KEYWORDS, matchesTerm, STOPWORDS, WEAK_WORDS } from './constants';
import { analyzeResumeLength } from './length';
import { findMeasures, hasResult, STRONG_SCORE, scoreBullet, scoreParts } from './scoring';
import { extractSkills } from './skills';
import { detectResumeStructure } from './structure';
import { normalizeLine, uniqueId } from './text';
import type {
  BulletFields,
  BulletRecord,
  RepetitiveVerb,
  SignalReport,
  StoredResumeSession,
} from './types';
import { gerundToPast, isVerbWord, leadingAction } from './verbs';

// ============================================================================
// Weak Word Detection
// ============================================================================

// Pre-computed entry list with lowercased weak words to avoid repeated string lowercasing inside loops
const WEAK_WORDS_ENTRIES = WEAK_WORDS.map((word) => ({
  word,
  lowerWord: word.toLowerCase(),
}));

export function detectWeakWords(bullet: string): string[] {
  const lowerText = bullet.toLowerCase();
  const found: string[] = [];
  for (const { word, lowerWord } of WEAK_WORDS_ENTRIES) {
    if (matchesTerm(bullet, word, lowerText, lowerWord)) {
      found.push(word);
    }
  }
  return found;
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

// Pre-computed entry list with lowercased ATS keywords to avoid repeated string lowercasing inside loops
const ATS_KEYWORDS_ENTRIES = ATS_KEYWORDS.map((kw) => ({
  kw,
  lowerKw: kw.toLowerCase(),
}));

export function detectAtsKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];
  for (const { kw, lowerKw } of ATS_KEYWORDS_ENTRIES) {
    if (matchesTerm(text, kw, lowerText, lowerKw)) {
      found.push(kw);
    }
  }
  return [...new Set(found)];
}

// ============================================================================
// Report
// ============================================================================

/**
 * Builds the stored report used by the live scan and restored sessions:
 * counts, length, sections, skills, hedging words, repetition, and the words
 * used most. It carries no composite score. Each line has one score with
 * its parts shown (scoring.ts), and the resume as a whole is described in
 * counts (summarizeLines). Retired composite fields from older sessions are
 * not produced here.
 */
export function buildDeepSignalReport(
  bullets: BulletRecord[],
  resumeText: string,
  structureNote?: string,
  skippedLines?: number
): SignalReport {
  const enriched = enrichBulletRecords(bullets);
  const keywordDensity = computeKeywordDensity(resumeText);
  const atsKeywords = detectAtsKeywords(resumeText);
  const lengthAnalysis = analyzeResumeLength(resumeText, enriched.length);
  const skills = extractSkills(resumeText);

  // Count only inside the scored lines, and only numbers that say what they count.
  const numbers = enriched.reduce((sum, b) => sum + findMeasures(b.improved).length, 0);
  // Lines that open with what the visitor did (involvement phrases do not count).
  const verbCount = enriched.filter((b) => {
    const opening = leadingAction(normalizeLine(b.improved));
    return opening !== null && !opening.involvement;
  }).length;

  const atsDensity = atsKeywords.map((word) => {
    const existing = keywordDensity.find((k) => k.word === word.toLowerCase());
    return { word: word.toLowerCase(), count: existing?.count ?? 1 };
  });
  const mergedDensity = [...keywordDensity];
  for (const item of atsDensity) {
    if (!mergedDensity.some((k) => k.word === item.word)) mergedDensity.push(item);
  }
  mergedDensity.sort((a, b) => b.count - a.count);

  const weakWordCount = enriched.reduce((sum, b) => sum + (b.weakWords?.length ?? 0), 0);

  return {
    numbers,
    verbs: verbCount,
    wordCount: lengthAnalysis.wordCount,
    bulletCount: enriched.length,
    estimatedPages: lengthAnalysis.estimatedPages,
    sections: lengthAnalysis.sections,
    hardSkills: skills.hard,
    softSkills: skills.soft,
    isOptimalLength: lengthAnalysis.isOptimalLength,
    lengthRecommendation: lengthAnalysis.recommendation,
    structureNote,
    skippedLines,
    weakWordCount,
    repetitiveVerbs: detectRepetitiveVerbs(enriched),
    keywordDensity: mergedDensity.slice(0, 20),
  };
}

export type LineSummary = {
  total: number;
  /** Lines that open with what the visitor did. */
  action: number;
  /** Lines that say what the work was in some detail. */
  work: number;
  /** Lines that say what happened because of the work. */
  result: number;
  /** Lines with a number that says what it counts. */
  measure: number;
  /** Lines at or above the strong label. */
  strong: number;
};

/** The resume as counts, read from each line as it reads now. */
export function summarizeLines(lines: string[]): LineSummary {
  const summary: LineSummary = {
    total: lines.length,
    action: 0,
    work: 0,
    result: 0,
    measure: 0,
    strong: 0,
  };
  for (const line of lines) {
    const parts = scoreParts(line);
    if (parts.action.points === parts.action.max) summary.action += 1;
    if (parts.work.points === parts.work.max) summary.work += 1;
    if (parts.result.points > 0) summary.result += 1;
    if (parts.measure.points > 0) summary.measure += 1;
    if (scoreBullet(line) >= STRONG_SCORE) summary.strong += 1;
  }
  return summary;
}

/** The counts as plain sentences: "1 of 5 lines has a number that says what it counts." */
export function summarySentences(summary: LineSummary): string[] {
  const { total } = summary;
  if (total === 0) return [];
  const of = (count: number, one: string, many: string) =>
    `${count} of ${total} ${total === 1 ? 'line' : 'lines'} ${count === 1 ? one : many}`;
  return [
    `${of(summary.action, 'starts', 'start')} with what you did.`,
    `${of(summary.work, 'says', 'say')} what the work was.`,
    `${of(summary.result, 'says', 'say')} what happened because of the work.`,
    `${of(summary.measure, 'has', 'have')} a number that says what it counts.`,
    `${of(summary.strong, 'is', 'are')} strong, ${STRONG_SCORE} or more.`,
  ];
}

/**
 * The achievement lines of a resume, glyphs stripped. Structure lines
 * (name, contact, headings, education, dates, skills lists) are left out;
 * detectResumeStructure explains what was skipped.
 */
export function extractBullets(text: string): string[] {
  return detectResumeStructure(text).bullets;
}

const CONNECTOR_WORDS = new Set([
  'to',
  'by',
  'so',
  'which',
  'and',
  'resulting',
  'leading',
  'because',
  'that',
  'thus',
  'while',
  'then',
  'with',
  'for',
  'after',
  'until',
  'allowing',
  'letting',
  'helping',
]);
const PREPOSITION_START =
  /^(?:from|by|in|within|over|across|for|to|per|each|every|a|an|about|around|up|more|at|on|with|through|during|nearly|almost|over)\b/i;
const FINITE_VERB =
  /\b(?:could|can|would|will|was|were|is|are|had|has|got|did|went|came|stopped|started|no longer|never|now)\b|\b[a-z]{3,}ed\b/i;
const RESULT_SPLIT =
  /,?\s+(?=(?:so that|so|which (?:meant|led|let|helped|cut|saved|kept|got|made|gave)|resulting in|leading to|to (?:increase|decrease|reduce|cut|save|improve|boost|grow|raise|lower|double|triple|eliminate|keep|meet|exceed|prevent|end))\b)/i;

const GERUND_RUN = /^([a-z]+ing)((?:,? (?:and |or )?[a-z]+ing\b)*)/i;
const firstWord = (text: string) => text.match(/^[A-Za-z][A-Za-z'-]*/)?.[0] ?? '';
const capitalizeFirst = (text: string) => text.slice(0, 1).toUpperCase() + text.slice(1);

/** Lowercase an ordinary first word ("The", "So", "Kept"), never an acronym or a name. */
function lowerOrdinaryStart(text: string): string {
  const word = firstWord(text);
  if (!word || !/^[A-Z][a-z'-]*$/.test(word)) return text;
  const lower = word.toLowerCase();
  if (STOPWORDS.has(lower) || CONNECTOR_WORDS.has(lower) || isVerbWord(lower)) {
    return lower + text.slice(word.length);
  }
  return text;
}

const stripEnd = (text: string) =>
  text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?;,]+$/, '');

/**
 * Split a line into the four fields: the opening verb (or involvement
 * phrase, so a new verb replaces "Helped with" rather than joining it), the
 * work, and a result clause when one is clearly marked. The number field
 * starts empty: any number already in the line stays where it is.
 */
export function seedFields(text: string): BulletFields {
  const cleaned = normalizeLine(text);
  const opening = leadingAction(cleaned);
  const verb = opening ? capitalizeFirst(opening.text.replace(/\s+/g, ' ')) : '';
  const remainder = opening ? cleaned.slice(opening.text.length).replace(/^\s+/, '') : cleaned;
  const split = remainder.match(RESULT_SPLIT);
  if (split && split.index !== undefined && split.index > 0) {
    return {
      verb,
      task: remainder.slice(0, split.index).trim(),
      impact: remainder.slice(split.index + split[0].length).trim(),
      quantifier: '',
    };
  }
  return { verb, task: remainder.trim(), impact: '', quantifier: '' };
}

/** How a result joins the sentence before it. */
function joinResult(result: string): string {
  const word = firstWord(result).toLowerCase();
  if (word === 'so' || word === 'which' || word === 'resulting' || word === 'leading') {
    return `, ${lowerOrdinaryStart(result)}`;
  }
  if (/ing$/.test(word) && word.length > 4 && !CONNECTOR_WORDS.has(word)) {
    return `, ${lowerOrdinaryStart(result)}`;
  }
  if (CONNECTOR_WORDS.has(word)) return ` ${lowerOrdinaryStart(result)}`;
  if (isVerbWord(word)) return ` and ${lowerOrdinaryStart(result)}`;
  if (FINITE_VERB.test(result)) return `, so ${lowerOrdinaryStart(result)}`;
  return `, leading to ${lowerOrdinaryStart(result)}`;
}

/** True when a number field entry says what it counts ("40 boxes", not "40"). */
export function measureHasWords(measure: string): boolean {
  return /\d/.test(measure) && /[a-z]{2,}/i.test(measure);
}

/**
 * Build one sentence from the four fields. The verb replaces the line's
 * opening verb; the work follows it; a number that says what it counts sits
 * after the work (or is left out when it is already in the line, or when it
 * is a bare number); the result joins with the connector it needs, never a
 * doubled "to" or "so".
 */
export function buildBullet(fields: BulletFields): string {
  const verb = fields.verb.trim().replace(/\s+/g, ' ');
  let task = stripEnd(fields.task);
  let result = stripEnd(fields.impact).replace(/^[,;:]\s*/, '');
  const measure = stripEnd(fields.quantifier);

  if (verb && task.toLowerCase().startsWith(`${verb.toLowerCase()} `)) {
    task = task.slice(verb.length).trim();
  }
  if (verb && result.toLowerCase().startsWith(`${verb.toLowerCase()} `) && !task) {
    result = result.slice(verb.length).trim();
  }

  // "Responsible for opening and closing the store" with the verb "Opened":
  // the new verb takes the place of the matching -ing word, and the rest of
  // that run follows it ("Opened and closed the store"), never "Opened opening".
  const run = verb ? task.match(GERUND_RUN) : null;
  if (run && gerundToPast(run[1])?.toLowerCase() === verb.toLowerCase()) {
    const rest = run[0]
      .slice(run[1].length)
      .replace(/[a-z]+ing\b/gi, (word) => gerundToPast(word)?.toLowerCase() ?? word);
    task = `${rest}${task.slice(run[0].length)}`.trim();
  }

  let sentence = verb ? capitalizeFirst(verb) : '';
  if (task) {
    if (!sentence) sentence = capitalizeFirst(task);
    else if (/^[,;:]/.test(task)) sentence += task;
    else sentence += ` ${lowerOrdinaryStart(task)}`;
  }

  const everything = `${sentence} ${result}`.toLowerCase();
  let appositive = false;
  if (measure && measureHasWords(measure) && !everything.includes(measure.toLowerCase())) {
    if (!sentence) sentence = capitalizeFirst(measure);
    else if (PREPOSITION_START.test(measure)) sentence += ` ${measure}`;
    else {
      sentence += `, ${measure}`;
      appositive = true;
    }
  }

  if (result) {
    if (!sentence) sentence = capitalizeFirst(result);
    else {
      let join = joinResult(result);
      if (appositive && join.startsWith(' ')) join = `,${join}`;
      sentence += join;
    }
  }

  sentence = sentence
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.])/g, '$1')
    .trim();
  if (!sentence) return '';
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * A fresh record scores the line exactly as written. The rewritten form and
 * its score only appear once the student changes a field, so the number a
 * student sees first is honest and every point after it was earned.
 */
export function createBulletRecord(line: string, index: number): BulletRecord {
  const sanitized = line.replace(/\s+/g, ' ').trim();
  const original = sanitized.replace(/^[-•*]\s*/, '');
  const fields = seedFields(sanitized);
  const baselineScore = scoreBullet(sanitized);
  return {
    id: uniqueId('bullet', index),
    original,
    fields,
    baselineScore,
    improved: original,
    improvedScore: baselineScore,
    edited: false,
    weakWords: detectWeakWords(sanitized),
    hasImpact: hasResult(sanitized),
  };
}

/** Apply one field change and rescore the rewritten line. */
export function applyFieldChange(
  bullet: BulletRecord,
  field: keyof BulletFields,
  value: string
): BulletRecord {
  const fields = { ...bullet.fields, [field]: value };
  const improved = buildBullet(fields);
  return {
    ...bullet,
    fields,
    improved,
    improvedScore: scoreBullet(improved),
    edited: true,
    weakWords: detectWeakWords(improved),
    hasImpact: hasResult(improved),
  };
}

/**
 * Score a resume's text: find its achievement lines, score each as written,
 * and build the report. What "Analyze resume" stores in the session.
 */
export function analyzeResumeText(
  text: string,
  options: Parameters<typeof detectResumeStructure>[1] = {}
): Pick<
  StoredResumeSession,
  'bullets' | 'selectedBulletId' | 'signalReport' | 'lastAnalyzedAt' | 'needsRescan'
> {
  const structure = detectResumeStructure(text, options);
  const records = structure.bullets.map((line, index) => createBulletRecord(line, index));
  const skipped = Object.values(structure.skipped).reduce((sum, n) => sum + n, 0);
  return {
    bullets: records,
    selectedBulletId: records[0]?.id ?? null,
    signalReport: buildDeepSignalReport(records, text, structure.note, skipped),
    lastAnalyzedAt: new Date().toISOString(),
    needsRescan: false,
  };
}
