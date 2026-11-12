/**
 * Whether a resume shows what one requirement asks for, and how strongly.
 *
 * A requirement is read as one of four kinds:
 * - `years`: "2+ years of experience in operations or logistics". Counted
 *   from the date ranges the resume gives, never guessed.
 * - `education`: a degree level and its fields. Only education and
 *   certification lines can show it.
 * - `tool`: names tools ("such as Manhattan, Blue Yonder, or similar").
 *   Only one of the tools, or the category phrase, can show it.
 * - `task`: a duty or skill, cut into the separate things it asks for.
 *
 * Contact lines, headings, and summary or objective sentences are never
 * evidence: they say what the person wants, not what they did.
 */

import { synonymsOf } from './aliases';
import {
  type EvidenceExcerpt,
  extractTermsWithClauses,
  findTermMatches,
  findVariant,
  groupIntoExcerpts,
  isStopWord,
  offersAlternatives,
  type RequirementTerm,
  type TermOptions,
  tokenize,
  tokenRoles,
} from './match';
import {
  type DatedRole,
  type DocumentLineKind,
  monthsCovered,
  readDocument,
  startsWithAction,
} from './resume-lines';
import { findCues } from './sections';
import { normalizePunctuation } from './text';
import type { SourceSpan } from './types';

export type RequirementKind = 'years' | 'education' | 'tool' | 'task';

/**
 * - `evidence`: a distinctive term or phrase appears in a work, project,
 *   skills, or (for education) education line.
 * - `partial`: some of the separate things asked for are shown, not all.
 * - `none`: the requirement names things a resume could show, and none are.
 * - `not-checkable`: nothing a line of text can show ("Must be 18 or older",
 *   "Strong communication skills"), or the dates needed to count years
 *   could not be read.
 */
export type EvidenceState = 'evidence' | 'partial' | 'none' | 'not-checkable';

/**
 * One of the separate things a requirement asks for. Any named term or
 * phrase shows it. When it is only single words ("schedule and confirm
 * volunteers"), two of them must share a line, unless they are listed as
 * alternatives ("inventory or logistics").
 */
export interface RequirementAsk {
  label: string;
  terms: RequirementTerm[];
  alternatives?: boolean;
}

export interface YearsAsk {
  /** The fewest years the posting asks for. */
  min: number;
  /** "2+ years", "1 to 3 years". */
  label: string;
  /** Fields that count, any one of them ("operations", "logistics"). Empty for "2+ years of experience". */
  fields: RequirementTerm[];
}

export interface RequirementAnalysis {
  kind: RequirementKind;
  /** Terms a resume line can show. */
  terms: RequirementTerm[];
  /** Umbrella words, places, and names: never evidence alone. */
  weakTerms: RequirementTerm[];
  asks: RequirementAsk[];
  years?: YearsAsk;
  /** "or equivalent experience" */
  acceptsEquivalent: boolean;
}

export interface RequirementPart {
  label: string;
  shown: boolean;
  terms: RequirementTerm[];
  /** The best line that shows it. */
  excerpt?: EvidenceExcerpt;
}

export interface RequirementEvidence {
  terms: RequirementTerm[];
  /** Lines that show the requirement, work lines before skills lists. */
  excerpts: EvidenceExcerpt[];
  /** Terms with at least one match in a line that can show them. */
  foundTerms: RequirementTerm[];
  /** Terms with no such match. */
  missingTerms: RequirementTerm[];
  state: EvidenceState;
  kind: RequirementKind;
  /** The separate things asked for and whether each is shown. */
  parts: RequirementPart[];
  weakTerms: RequirementTerm[];
  /** A plain sentence the interface can show: years found, or why a row cannot be checked. */
  note?: string;
}

export interface EvidenceOptions extends TermOptions {
  /** What "present" means in a date range. Defaults to now. */
  today?: Date;
}

/** Lines that can show a tool, a task, or a skill. */
const WORK_LINES: ReadonlySet<DocumentLineKind> = new Set([
  'experience',
  'skills',
  'title',
  'certification',
  'other',
]);

/** Lines that can show a degree. */
const EDUCATION_LINES: ReadonlySet<DocumentLineKind> = new Set(['education', 'certification']);

const DEGREE_KEYS = new Set([
  "bachelor's",
  "master's",
  'high school diploma',
  "associate's degree",
  'phd',
  'mba',
]);

// ============================================================================
// Years
// ============================================================================

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const NUM = '(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
const YEARS_PATTERN = new RegExp(
  `\\b${NUM}\\s*(\\+|plus|or more)?\\s*(?:(?:-|–|to)\\s*${NUM}\\s*\\+?\\s*)?(?:full[- ]time\\s+)?years?['’]?\\s*(?:\\+\\s*)?(of|in|as|with)?\\b\\s*`,
  'i'
);

function toNumber(value: string): number {
  return NUMBER_WORDS[value.toLowerCase()] ?? Number(value);
}

const STRIP_LEADING =
  /^(?:(?:professional|relevant|related|prior|previous|paid|hands-on|direct|progressive|demonstrated)\s+)*(?:work(?:ing)?\s+)?experience\s*(?:(?:working\s+)?(?:in|with|as|at|doing|within)\b)?\s*/i;
const CUT_AT =
  /[.;(]|,\s*(?:including|preferably|ideally|with|plus|especially|such as)\b|\s+(?:including|preferably|ideally|is|are|required|preferred|a plus|desired|in a\b|in an\b|within\b)\b/i;
const TRAILING =
  /\s*,?\s*(?:or|and)\s+(?:a\s+|an\s+|other\s+)?(?:related|similar|equivalent|comparable|relevant)\b.*$|\s+(?:(?:work|professional)\s+)?experience\s*$|\s+(?:field|fields|role|roles|position|positions|setting|environment)\s*$/i;

const FIELD_TAIL = new Set([
  'role',
  'roles',
  'position',
  'positions',
  'field',
  'fields',
  'area',
  'areas',
  'setting',
  'settings',
  'environment',
  'environments',
  'industry',
  'experience',
  'work',
]);

function trimItem(item: string): string {
  const words = item.trim().split(/\s+/).filter(Boolean);
  while (words.length && /^(?:a|an|the|any|related|relevant|similar|other)$/i.test(words[0]))
    words.shift();
  while (words.length && FIELD_TAIL.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length === 1 && isStopWord(words[0].toLowerCase())) return '';
  return words.join(' ');
}

/** Splits "operations, logistics, supply chain, or a related field" into its alternatives. */
export function fieldList(text: string, offset: number, source: string): RequirementTerm[] {
  let rest = text;
  for (let i = 0; i < 3; i++)
    rest = rest.replace(STRIP_LEADING, '').replace(/^(?:in|as|with|of)\s+/i, '');
  const cut = rest.search(CUT_AT);
  if (cut >= 0) rest = rest.slice(0, cut);
  for (let i = 0; i < 3; i++) rest = rest.replace(TRAILING, '').trim();
  const terms: RequirementTerm[] = [];
  for (const raw of rest.split(/\s*,\s*|\s+or\s+|\s+and\s+|\s*\/\s*|\s+&\s+/)) {
    const item = trimItem(raw);
    if (!item || item.length < 2) continue;
    const lower = item.toLowerCase();
    if (terms.some((t) => t.key === lower)) continue;
    const at = source.toLowerCase().indexOf(lower, offset);
    const start = at >= 0 ? at : offset;
    terms.push({
      key: lower,
      label: item,
      source: 'phrase',
      shape: item.includes(' ') ? 'phrase' : 'word',
      variants: [...new Set([lower, ...synonymsOf(lower)])],
      span: { start, end: start + item.length },
    });
  }
  return terms;
}

/** "2+ years of experience in operations, logistics, or supply chain" read as a number and fields. */
export function parseYears(requirementText: string): YearsAsk | null {
  const text = normalizePunctuation(requirementText);
  const match = text.match(YEARS_PATTERN);
  if (!match || match.index === undefined) return null;
  const after = text.slice(match.index + match[0].length);
  if (
    /^(?:old|or\s+older|and\s+older|of\s+age|age)\b/i.test(after) ||
    (match[4]?.toLowerCase() === 'of' && /^age\b/i.test(after))
  )
    return null;
  const connector = match[4];
  if (!connector && !/\bexperience\b/i.test(after)) return null;
  const min = toNumber(match[1]);
  const max = match[3] ? toNumber(match[3]) : null;
  const plural = (n: number) => (n === 1 ? 'year' : 'years');
  const label =
    max !== null
      ? `${min} to ${max} ${plural(max)}`
      : `${min}${match[2] ? '+' : ''} ${plural(min)}`;
  return {
    min,
    label,
    fields: fieldList(after, match.index + match[0].length, text),
  };
}

function aboutDuration(months: number): string {
  if (months < 12) return `about ${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.round(months / 12);
  return `about ${years} ${years === 1 ? 'year' : 'years'}`;
}

function orList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

function andList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

// ============================================================================
// Analysis
// ============================================================================

/** "such as Manhattan, Blue Yonder": the names are examples of one thing. */
const EXAMPLES =
  /\b(?:such as|e\.g|for example|like|similar|including|especially|any of|one of|at least one)\b/i;

/**
 * Conditions a resume line cannot show: age, availability, the ability to
 * lift, authorization, enrollment status, an interest. Read as not checkable
 * unless the line also names a tool.
 */
const ELIGIBILITY =
  /^(?:must\s+(?:be\s+)?(?:able\s+to\s+(?:lift|stand|sit|walk|work|travel|commute)|available|willing|eligible|authorized|legally|at\s+least\s+\d|\d+|a\s+current|currently|enrolled|18|16|21)|availab|willing(?:ness)?\s+to|able\s+to\s+(?:lift|stand|work\s+(?:weekends|evenings|nights))|(?:an?\s+)?(?:interest|passion|enthusiasm)\s+(?:in|for)\b|(?:must\s+)?(?:have|possess)\s+reliable\s+transportation)/i;

function isDuty(text: string): boolean {
  return (
    startsWithAction(text) ||
    /^(?:you(?:'ll|\s+will)|in\s+this\s+role)\b/i.test(text) ||
    /\bresponsible\s+for\b/i.test(text)
  );
}
const CATEGORY_NOUNS = new Set([
  'software',
  'system',
  'systems',
  'tool',
  'tools',
  'platform',
  'platforms',
  'application',
  'applications',
  'apps',
]);

/** "inventory or logistics software" names two kinds of software: "inventory software", "logistics software". */
function categoryTerms(text: string): RequirementTerm[] {
  const tokens = tokenize(text);
  const roles = tokenRoles(text, tokens);
  const terms: RequirementTerm[] = [];
  tokens.forEach((token, k) => {
    if (!CATEGORY_NOUNS.has(token.lower) || k === 0) return;
    const nouns: number[] = [];
    let j = k - 1;
    while (j >= 0 && nouns.length < 2 && (roles[j] === 'content' || roles[j] === 'weak')) {
      if (!/^[\s-]+$/.test(text.slice(tokens[j].end, tokens[j + 1].start))) break;
      nouns.unshift(j);
      j--;
    }
    if (!nouns.some((n) => roles[n] === 'content')) return;
    const heads = [nouns];
    // "inventory or logistics software": the word before "or" shares the noun.
    const joiner = tokens[nouns[0] - 1];
    const other = tokens[nouns[0] - 2];
    if (joiner && other && /^(?:or|and)$/.test(joiner.lower) && roles[nouns[0] - 2] === 'content') {
      heads.push([nouns[0] - 2]);
    }
    for (const head of heads) {
      const words = head.map((n) => tokens[n].lower).join(' ');
      const key = `${words} ${token.lower.replace(/s$/, '')}`;
      if (terms.some((t) => t.key === key)) continue;
      const span = { start: tokens[head[0]].start, end: token.end };
      terms.push({
        key,
        label: head === nouns ? text.slice(span.start, span.end) : `${words} ${token.text}`,
        source: 'phrase',
        shape: 'phrase',
        variants: [key],
        span,
      });
    }
  });
  return terms;
}

function clauseLabel(text: string, span: SourceSpan): string {
  return text
    .slice(span.start, span.end)
    .replace(/^[\s,;]*(?:and|or)?\s*/i, '')
    .replace(/[\s,;.]+$/, '')
    .trim();
}

/** Reads one requirement: its kind, terms, weak words, and the separate things it asks for. */
export function analyzeRequirement(
  requirementText: string,
  options: TermOptions = {}
): RequirementAnalysis {
  const text = normalizePunctuation(requirementText);
  const { terms, weakTerms, clauses } = extractTermsWithClauses(text, options);
  const acceptsEquivalent = /\bor\s+equivalent\b/i.test(text);
  const named = terms.filter((t) => t.shape === 'named');

  // "No prior experience required", "Must be 18 or older", "Availability to
  // work weekends": nothing a line of a resume can show.
  const cues = findCues(text);
  const negated = Boolean(cues.negated) && !cues.required && !cues.preferred;
  // A capitalized name ("Bellmont") does not make "Must be a current Bellmont student" checkable; a tool would.
  const tools = named.filter((t) => t.source !== 'phrase' || /^[A-Z][A-Z&]{1,5}s?$/.test(t.label));
  const eligibility = ELIGIBILITY.test(text.trim()) && tools.length === 0;
  if (negated || eligibility) {
    return { kind: 'task', terms: [], weakTerms, asks: [], acceptsEquivalent };
  }

  const years = parseYears(text);
  if (years) {
    return {
      kind: 'years',
      terms: years.fields,
      weakTerms,
      asks: [],
      years,
      acceptsEquivalent,
    };
  }

  const levels = terms.filter((t) => DEGREE_KEYS.has(t.key));
  if (levels.length > 0 || /\b(?:degree|diploma)\b/i.test(text)) {
    const asks: RequirementAsk[] = [];
    if (levels.length > 0) {
      const levelLabel = levels[0].label;
      asks.push({
        label: /degree|diploma/i.test(levelLabel) ? levelLabel : `${levelLabel} degree`,
        terms: levels,
        alternatives: true,
      });
    }
    const fieldStart = text.search(
      /\b(?:degree|diploma|bachelor'?s|master'?s|associate'?s|b\.?[as]\.?|m\.?[as]\.?)(?:\s+program)?\s+(?:in|of)\s+/i
    );
    let fields: RequirementTerm[] = [];
    if (fieldStart >= 0) {
      const lead = text
        .slice(fieldStart)
        .match(/^\S+(?:\s+program)?\s+(?:in|of)\s+/i)?.[0] as string;
      const from = fieldStart + lead.length;
      fields = fieldList(text.slice(from).replace(/,?\s*or\s+equivalent\b.*$/i, ''), from, text);
    }
    if (fields.length > 0)
      asks.push({ label: orList(fields.map((f) => f.label)), terms: fields, alternatives: true });
    return {
      kind: 'education',
      terms: [...levels, ...fields],
      weakTerms,
      asks,
      acceptsEquivalent,
    };
  }

  const categories = categoryTerms(text).filter(
    (c) => !named.some((n) => n.span.start < c.span.end && c.span.start < n.span.end)
  );
  if ((named.length > 0 || categories.length > 0) && !isDuty(text)) {
    const examples = EXAMPLES.test(text);
    const alternatives = offersAlternatives(text);
    // Examples name kinds of one thing, so only the tools and the category
    // count. Peers joined by "or" ("healthcare billing or HIPAA") are all
    // alternatives. Tools joined by "and" are each asked for.
    const toolTerms = (
      examples
        ? [...named, ...categories]
        : alternatives
          ? [
              ...terms.filter((t) => !categories.some((c) => overlapsSpan(c.span, t.span))),
              ...categories,
            ]
          : [...named, ...categories]
    ).sort((a, b) => a.span.start - b.span.start);
    const asks =
      examples || alternatives || toolTerms.length === 1
        ? [{ label: orList(toolTerms.map((t) => t.label)), terms: toolTerms, alternatives: true }]
        : toolTerms.map((t) => ({ label: t.label, terms: [t], alternatives: true }));
    return { kind: 'tool', terms: toolTerms, weakTerms, asks, acceptsEquivalent };
  }

  return {
    kind: 'task',
    terms,
    weakTerms,
    asks: clauses.map((clause) => ({
      label: clauseLabel(text, clause.span),
      terms: clause.terms,
      alternatives: clause.alternatives,
    })),
    acceptsEquivalent,
  };
}

// ============================================================================
// Evidence
// ============================================================================

function overlapsSpan(a: SourceSpan, b: SourceSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

function byStrength(a: EvidenceExcerpt, b: EvidenceExcerpt): number {
  return Number(a.listedOnly) - Number(b.listedOnly) || a.start - b.start;
}

/**
 * Whether one line shows an ask. A named term or phrase is enough. Single
 * words need company: two different ones in the line, unless the ask lists
 * them as alternatives or has only one. A title line ("Volunteer, Riverside
 * After-School Program") shows a named term or a phrase, never a lone word.
 */
function lineShows(ask: RequirementAsk, excerpt: EvidenceExcerpt): boolean {
  const byKey = new Map(ask.terms.map((t) => [t.key, t]));
  const hits = [...new Set(excerpt.matches.map((m) => m.termKey))]
    .map((key) => byKey.get(key))
    .filter((t): t is RequirementTerm => Boolean(t));
  if (hits.some((t) => t.shape !== 'word')) return true;
  if (excerpt.kind === 'title' || hits.length === 0) return false;
  const words = ask.terms.filter((t) => t.shape === 'word').length;
  const needed = ask.alternatives || words <= 1 ? 1 : 2;
  return hits.length >= needed;
}

/** Strongest first: work lines before skills lists, named terms and more of them first. */
function rankFor(terms: RequirementTerm[]) {
  const named = new Set(terms.filter((t) => t.shape === 'named').map((t) => t.key));
  return (a: EvidenceExcerpt, b: EvidenceExcerpt) => {
    const score = (e: EvidenceExcerpt) => {
      const keys = new Set(e.matches.map((m) => m.termKey));
      return [...keys].filter((k) => named.has(k)).length * 10 + keys.size;
    };
    return Number(a.listedOnly) - Number(b.listedOnly) || score(b) - score(a) || a.start - b.start;
  };
}

function yearsEvidence(
  analysis: RequirementAnalysis & { years: YearsAsk },
  documentText: string,
  options: EvidenceOptions
): RequirementEvidence {
  const { years, weakTerms } = analysis;
  const base = {
    terms: years.fields,
    kind: 'years' as const,
    weakTerms,
  };
  const doc = readDocument(documentText, { today: options.today });
  if (doc.roles.length === 0) {
    return {
      ...base,
      excerpts: [],
      foundTerms: [],
      missingTerms: years.fields,
      state: 'not-checkable',
      parts: [],
      note: 'No date ranges next to a job title could be read in your resume, so the years cannot be counted.',
    };
  }
  const normalized = normalizePunctuation(documentText);
  const lower = normalized.toLowerCase();
  const total = monthsCovered(doc.roles);
  const enough = (months: number) => months >= years.min * 12 && months > 0;
  const fieldsOr = orList(years.fields.map((f) => f.label));

  if (years.fields.length === 0) {
    const shown = enough(total);
    return {
      ...base,
      excerpts: [],
      foundTerms: [],
      missingTerms: [],
      state: shown ? 'evidence' : 'none',
      parts: [{ label: years.label, shown, terms: [] }],
      note: shown
        ? `Your resume has ${aboutDuration(total)} of dated work.`
        : `Your resume has ${aboutDuration(total)} of dated work; the posting asks for ${years.label}.`,
    };
  }

  const roleHits = new Map<DatedRole, RequirementTerm[]>();
  const matchSpans: { term: RequirementTerm; span: SourceSpan }[] = [];
  for (const role of doc.roles) {
    for (const term of years.fields) {
      for (const variant of term.variants) {
        const spans = findVariant(variant, normalized, lower).filter(
          (s) => s.start >= role.start && s.end <= role.end
        );
        if (spans.length === 0) continue;
        roleHits.set(role, [...(roleHits.get(role) ?? []), term]);
        for (const span of spans) matchSpans.push({ term, span });
      }
    }
  }
  const fieldRoles = [...roleHits.keys()];
  const fieldMonths = monthsCovered(fieldRoles);
  const found = years.fields.filter((f) => fieldRoles.some((r) => roleHits.get(r)?.includes(f)));
  const missing = years.fields.filter((f) => !found.includes(f));
  const matches = matchSpans.map(({ term, span }) => ({
    ...span,
    text: documentText.slice(span.start, span.end),
    termKey: term.key,
    variant: term.key,
  }));
  const excerpts = groupIntoExcerpts(documentText, matches, WORK_LINES).sort(byStrength);
  const foundLabels = andList(found.map((f) => f.label));
  const fieldPart = (shown: boolean): RequirementPart => ({
    label: `experience in ${fieldsOr}`,
    shown,
    terms: years.fields,
    excerpt: shown ? excerpts[0] : undefined,
  });

  if (fieldMonths > 0 && enough(fieldMonths)) {
    return {
      ...base,
      excerpts,
      foundTerms: found,
      missingTerms: missing,
      state: 'evidence',
      parts: [{ label: years.label, shown: true, terms: [] }, fieldPart(true)],
      note: `${capitalize(aboutDuration(fieldMonths))} in roles mentioning ${foundLabels}.`,
    };
  }
  if (fieldMonths > 0) {
    return {
      ...base,
      excerpts,
      foundTerms: found,
      missingTerms: missing,
      state: 'partial',
      parts: [{ label: years.label, shown: false, terms: [] }, fieldPart(true)],
      note: `${capitalize(aboutDuration(fieldMonths))} in roles mentioning ${foundLabels}; the posting asks for ${years.label}.`,
    };
  }
  if (enough(total)) {
    return {
      ...base,
      excerpts: [],
      foundTerms: [],
      missingTerms: years.fields,
      state: 'partial',
      parts: [{ label: years.label, shown: true, terms: [] }, fieldPart(false)],
      note: `Your resume has ${aboutDuration(total)} of dated work, but no role names ${fieldsOr}.`,
    };
  }
  return {
    ...base,
    excerpts: [],
    foundTerms: [],
    missingTerms: years.fields,
    state: 'none',
    parts: [{ label: years.label, shown: false, terms: [] }, fieldPart(false)],
    note: `Your resume has ${aboutDuration(total)} of dated work, and no role names ${fieldsOr}.`,
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Looks for a requirement in a resume or letter. Each separate thing it
 * asks for is shown only by a distinctive term or phrase in a line that can
 * show it; umbrella words, places, and names never count on their own.
 * Offsets in the result point into `documentText`.
 */
export function findRequirementEvidence(
  requirementText: string,
  documentText: string,
  options: EvidenceOptions = {}
): RequirementEvidence {
  const analysis = analyzeRequirement(requirementText, options);
  if (analysis.years) {
    return yearsEvidence(
      analysis as RequirementAnalysis & { years: YearsAsk },
      documentText,
      options
    );
  }
  const { kind, terms, weakTerms, asks } = analysis;
  if (asks.length === 0) {
    return {
      terms,
      excerpts: [],
      foundTerms: [],
      missingTerms: terms,
      state: 'not-checkable',
      kind,
      parts: [],
      weakTerms,
    };
  }
  const kinds = kind === 'education' ? EDUCATION_LINES : WORK_LINES;
  const allMatches = findTermMatches(terms, documentText);
  const candidates = groupIntoExcerpts(documentText, allMatches, kinds).sort(rankFor(terms));
  const used = new Set<EvidenceExcerpt>();
  const shownKeys = new Set<string>();
  const parts: RequirementPart[] = asks.map((ask) => {
    const keys = new Set(ask.terms.map((t) => t.key));
    const showing = candidates.filter((e) => lineShows(ask, e));
    for (const e of showing) {
      used.add(e);
      for (const m of e.matches) if (keys.has(m.termKey)) shownKeys.add(m.termKey);
    }
    const excerpt = showing[0];
    return { label: ask.label, shown: Boolean(excerpt), terms: ask.terms, excerpt };
  });
  const excerpts = candidates.filter((e) => used.has(e));
  const shownCount = parts.filter((p) => p.shown).length;
  const state: EvidenceState =
    shownCount === parts.length ? 'evidence' : shownCount > 0 ? 'partial' : 'none';
  return {
    terms,
    excerpts,
    foundTerms: terms.filter((t) => shownKeys.has(t.key)),
    missingTerms: terms.filter((t) => !shownKeys.has(t.key)),
    state,
    kind,
    parts,
    weakTerms,
    note:
      kind === 'education' && state !== 'evidence' && analysis.acceptsEquivalent
        ? 'The posting also accepts equivalent experience.'
        : undefined,
  };
}
