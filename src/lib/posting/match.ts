/**
 * Alias-aware term matching. A requirement is reduced to the terms a resume
 * or letter could actually show (skills, tools, credentials, short work
 * phrases), never to generic words. Each term is then looked for with
 * word-boundary matching that tolerates plural, -ing, and -ed forms.
 */

import { SKILL_BANK } from '../glowup-banks';
import {
  CAPITALIZED_ONLY,
  canonicalTerm,
  SYNONYM_GROUPS,
  synonymsOf,
  UMBRELLA_KEYWORDS,
  WEAK_SKILL_KEYWORDS,
} from './aliases';
import { GENERIC_TERMS, isGenericWord } from './terms';
import {
  escapeRegExp,
  normalizePunctuation,
  splitSentences,
  trimmedSegment,
  wordCount,
} from './text';
import type { OccupationLookup, SourceSpan } from './types';

// ============================================================================
// Morphology
// ============================================================================

function undouble(root: string): string {
  return /([bdgmnpt])\1$/.test(root) ? root.slice(0, -1) : root;
}

/** A crude stem: enough to line up plan / plans / planned / planning. */
function stem(word: string): { root: string; yForm: boolean } {
  if (word.length > 4 && /(?:ies|ied)$/.test(word)) return { root: word.slice(0, -3), yForm: true };
  let w = word;
  if (w.length >= 6 && w.endsWith('ing')) w = undouble(w.slice(0, -3));
  else if (w.length >= 5 && w.endsWith('ed') && !w.endsWith('eed')) w = undouble(w.slice(0, -2));
  else if (/(?:ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (/[^aeiou]y$/.test(w)) return { root: w.slice(0, -1), yForm: true };
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return { root: w, yForm: false };
}

function wordPattern(word: string): { pattern: string; probe: string } {
  if (/^[a-z]+$/.test(word) && word.length >= 4) {
    const { root, yForm } = stem(word);
    if (root.length >= 3) {
      if (yForm) return { pattern: `${root}(?:y|ies|ied|ying)`, probe: root };
      const last = root[root.length - 1];
      const doubled =
        /[bdgmnpt]/.test(last) && /[^aeiou][aeiou][bdgmnpt]$/.test(root)
          ? `|${root}${last}(?:ed|ing)`
          : '';
      return { pattern: `(?:${root}(?:e|es|ed|ing|s)?${doubled})`, probe: root };
    }
  }
  if (/^[a-z]{3}$/.test(word)) return { pattern: `${word}s?`, probe: word };
  return { pattern: escapeRegExp(word), probe: word };
}

const BOUNDARY_BEFORE = '(?<![a-z0-9+#])';
const BOUNDARY_AFTER = '(?![a-z0-9+#])';

interface CompiledVariant {
  regex: RegExp;
  probe: string;
  capitalizedOnly: boolean;
}

const variantCache = new Map<string, CompiledVariant>();

/**
 * A matcher for one spelling. Words may be separated by spaces or hyphens
 * or run together ("front end", "front-end", "frontend"), and each word
 * accepts simple inflections.
 */
function compileVariant(variant: string): CompiledVariant {
  const key = variant.toLowerCase();
  let compiled = variantCache.get(key);
  if (!compiled) {
    const words = key.split(/[\s-]+/).filter(Boolean);
    const parts = words.map(wordPattern);
    compiled = {
      regex: new RegExp(
        `${BOUNDARY_BEFORE}${parts.map((p) => p.pattern).join('[\\s-]*')}${BOUNDARY_AFTER}`,
        'gi'
      ),
      probe: parts[0]?.probe ?? key,
      capitalizedOnly: CAPITALIZED_ONLY.has(key),
    };
    variantCache.set(key, compiled);
  }
  return compiled;
}

/** Every place `variant` occurs in `text` (already lowercased copy in `lower`). */
function findVariant(variant: string, text: string, lower: string): SourceSpan[] {
  const { regex, probe, capitalizedOnly } = compileVariant(variant);
  if (!lower.includes(probe)) return [];
  const spans: SourceSpan[] = [];
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (capitalizedOnly && !/^[A-Z]/.test(match[0])) continue;
    spans.push({ start, end: start + match[0].length });
  }
  return spans;
}

// ============================================================================
// Requirement terms
// ============================================================================

export type TermSource = 'skill-bank' | 'synonym' | 'occupation' | 'phrase';

export interface RequirementTerm {
  /** Lowercase canonical form; two terms with one key are the same term. */
  key: string;
  /** The words as the requirement wrote them. */
  label: string;
  source: TermSource;
  /** The skill-bank skill this term belongs to, when it came from the bank. */
  skillId?: string;
  /** Every spelling that counts as this term in a resume or letter. */
  variants: string[];
  /** Where the term sits in the requirement text. */
  span: SourceSpan;
}

export interface TermOptions {
  /** Optional title and software-skills dataset, supplied by the caller. */
  lookup?: OccupationLookup;
}

interface SkillKeywordEntry {
  keyword: string;
  skillId: string;
  variants: string[];
}

/** Bank keywords that may stand as terms, each with the spellings that count as evidence. */
const SKILL_KEYWORD_ENTRIES: SkillKeywordEntry[] = (() => {
  const usable = (keyword: string) =>
    !WEAK_SKILL_KEYWORDS.has(keyword) && !GENERIC_TERMS.has(keyword);
  const entries: SkillKeywordEntry[] = [];
  for (const skill of SKILL_BANK) {
    const umbrella = new Set(UMBRELLA_KEYWORDS[skill.id] ?? []);
    const skillVariants = skill.keywords.filter(usable).flatMap((k) => [...synonymsOf(k)]);
    for (const keyword of skill.keywords) {
      if (!usable(keyword)) continue;
      const variants = umbrella.has(keyword) ? skillVariants : [...synonymsOf(keyword)];
      entries.push({ keyword, skillId: skill.id, variants: [...new Set(variants)] });
    }
  }
  return entries;
})();

const SYNONYM_ENTRIES: { member: string; group: readonly string[] }[] = SYNONYM_GROUPS.flatMap(
  (group) => group.map((member) => ({ member, group }))
);

const CALENDAR_WORDS = new Set([
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'spring',
  'summer',
  'fall',
  'autumn',
  'winter',
]);

interface Token extends SourceSpan {
  text: string;
  lower: string;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9'+#]*(?:[./-][A-Za-z0-9+#]+)*/g)) {
    const start = match.index ?? 0;
    const raw = match[0].replace(/'s$|'$/, '');
    tokens.push({ start, end: start + raw.length, text: raw, lower: raw.toLowerCase() });
  }
  return tokens;
}

function isContentToken(token: Token): boolean {
  return (
    token.lower.length >= 3 &&
    !isGenericWord(token.lower) &&
    !CALENDAR_WORDS.has(token.lower.replace(/s$/, ''))
  );
}

/** Next to each other with only a space, hyphen, or possessive between ("driver's license"). */
function adjacent(text: string, a: Token, b: Token): boolean {
  return /^(?:'s?)?[\s-]+$/.test(text.slice(a.end, b.start));
}

function sentenceInitial(text: string, token: Token): boolean {
  const before = text.slice(0, token.start).trimEnd();
  // After a colon or semicolon a capital usually starts a name ("one of: Canva, Figma").
  return before === '' || /[.!?(•*-]$/.test(before);
}

function phraseTerms(text: string): RequirementTerm[] {
  const tokens = tokenize(text);
  const terms: RequirementTerm[] = [];
  const add = (from: Token, to: Token) => {
    const label = text.slice(from.start, to.end);
    terms.push({
      key: label.toLowerCase(),
      label,
      source: 'phrase',
      variants: [label.toLowerCase()],
      span: { start: from.start, end: to.end },
    });
  };

  const hasLowercase = /[a-z]/.test(text);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    // Two content words in a row: "customer service", "stock shelves".
    if (next && isContentToken(token) && isContentToken(next) && adjacent(text, token, next)) {
      add(token, next);
    }
    // Acronyms: "CPR", "GPA", "POS".
    if (/^[A-Z]{2,6}s?$/.test(token.text) && hasLowercase && isContentToken(token)) {
      add(token, token);
    }
  }

  // Runs of capitalized words: "Google Sheets", "Adobe Creative Suite", "Spanish".
  if (hasLowercase) {
    let run: Token[] = [];
    const flush = () => {
      if (run.length >= 2 || (run.length === 1 && !sentenceInitial(text, run[0]))) {
        add(run[0], run[run.length - 1]);
      }
      run = [];
    };
    for (const token of tokens) {
      const capitalized =
        /^[A-Z]/.test(token.text) && !/^[A-Z]{2,6}s?$/.test(token.text) && isContentToken(token);
      const previous = run[run.length - 1];
      if (capitalized && (!previous || adjacent(text, previous, token))) {
        run.push(token);
      } else {
        flush();
        if (capitalized) run.push(token);
      }
    }
    flush();
  }
  return terms;
}

/**
 * The last resort when a requirement yields no other term: its single
 * content words ("Strong writing and editing skills" asks for writing and
 * editing).
 */
function singleWordTerms(text: string): RequirementTerm[] {
  return tokenize(text)
    .filter((token) => isContentToken(token) && token.lower.length >= 4)
    .map((token) => ({
      key: token.lower,
      label: token.text,
      source: 'phrase' as const,
      variants: [token.lower],
      span: { start: token.start, end: token.end },
    }));
}

function overlaps(a: SourceSpan, b: SourceSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

function contains(outer: SourceSpan, inner: SourceSpan): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/**
 * The terms a requirement asks for. Skill-bank keywords, authored synonyms
 * (degrees, credentials, common tools), and the optional occupation lookup
 * come first; short content phrases fill in where they do not overlap.
 * Generic words ("currently", "enrolled", "degree", "program") never become
 * terms, so "Currently enrolled in a degree program" has none.
 */
export function extractRequirementTerms(
  requirementText: string,
  options: TermOptions = {}
): RequirementTerm[] {
  const text = normalizePunctuation(requirementText);
  const lower = text.toLowerCase();
  const strong: RequirementTerm[] = [];

  for (const entry of SKILL_KEYWORD_ENTRIES) {
    for (const span of findVariant(entry.keyword, text, lower)) {
      strong.push({
        key: canonicalTerm(entry.keyword),
        label: text.slice(span.start, span.end),
        source: 'skill-bank',
        skillId: entry.skillId,
        variants: entry.variants,
        span,
      });
    }
  }

  for (const { member, group } of SYNONYM_ENTRIES) {
    for (const span of findVariant(member, text, lower)) {
      strong.push({
        key: group[0],
        label: text.slice(span.start, span.end),
        source: 'synonym',
        variants: [...group],
        span,
      });
    }
  }

  for (const hit of options.lookup?.matchSoftware?.(text) ?? []) {
    if (hit.start < 0 || hit.end > text.length || hit.end <= hit.start) continue;
    const variants = [hit.term, ...(hit.aliases ?? [])]
      .map((v) => v.toLowerCase())
      .filter((v) => !isGenericWord(v));
    if (variants.length === 0) continue;
    strong.push({
      key: hit.term.toLowerCase(),
      label: text.slice(hit.start, hit.end),
      source: 'occupation',
      variants: [...new Set(variants)],
      span: { start: hit.start, end: hit.end },
    });
  }

  // Longest strong term wins where two overlap ("React Native" over "React").
  strong.sort((a, b) => b.span.end - b.span.start - (a.span.end - a.span.start));
  const accepted: RequirementTerm[] = [];
  for (const term of strong) {
    if (!accepted.some((t) => overlaps(t.span, term.span))) accepted.push(term);
  }

  const phrases = phraseTerms(text).filter(
    (term) => !accepted.some((t) => overlaps(t.span, term.span))
  );
  for (const term of phrases) {
    const swallowed = phrases.some(
      (other) =>
        other !== term &&
        contains(other.span, term.span) &&
        other.span.end - other.span.start > term.span.end - term.span.start
    );
    if (!swallowed) accepted.push(term);
  }
  if (accepted.length === 0) accepted.push(...singleWordTerms(text));

  const seen = new Set<string>();
  return accepted
    .sort((a, b) => a.span.start - b.span.start)
    .filter((term) => {
      if (seen.has(term.key)) return false;
      seen.add(term.key);
      return true;
    });
}

// ============================================================================
// Finding terms in a resume or letter
// ============================================================================

export interface TermMatch extends SourceSpan {
  /** The words as they appear in the searched text. */
  text: string;
  /** The `key` of the requirement term this matched. */
  termKey: string;
  /** The spelling that matched. */
  variant: string;
}

/** Every occurrence of any of `terms` in `text`, in reading order. */
export function findTermMatches(terms: RequirementTerm[], text: string): TermMatch[] {
  const normalized = normalizePunctuation(text);
  const lower = normalized.toLowerCase();
  const matches: TermMatch[] = [];
  for (const term of terms) {
    const forTerm: TermMatch[] = [];
    for (const variant of term.variants) {
      for (const span of findVariant(variant, normalized, lower)) {
        forTerm.push({
          ...span,
          text: text.slice(span.start, span.end),
          termKey: term.key,
          variant,
        });
      }
    }
    // One term, one match per place: keep the longest where spellings overlap.
    forTerm.sort((a, b) => a.start - b.start || b.end - a.end);
    for (const match of forTerm) {
      const last = matches[matches.length - 1];
      if (last && last.termKey === term.key && overlaps(last, match)) continue;
      matches.push(match);
    }
  }
  return matches.sort((a, b) => a.start - b.start || b.end - a.end);
}

export interface EvidenceExcerpt extends SourceSpan {
  /** The line or sentence of the searched text that holds the matches. */
  text: string;
  matches: TermMatch[];
  /**
   * True when the excerpt is a skills list ("Skills: Python, SQL") rather
   * than a line that describes work. The interface may say "listed" instead
   * of "shown".
   */
  listedOnly: boolean;
}

const SKILLS_LABEL =
  /^(?:technical\s+|computer\s+|core\s+|relevant\s+|key\s+)?(?:skills|tools|technologies|software|languages|proficiencies|competencies|certifications)\b[^:\n]{0,30}:/i;
const SKILLS_HEADING =
  /^(?:technical\s+|computer\s+|core\s+|relevant\s+|key\s+|additional\s+)?(?:skills|tools|technologies|software|languages|proficiencies|competencies|certifications)(?:\s*(?:and|&|,)\s*[a-z]+){0,2}\s*:?$/i;

function looksLikeResumeHeading(line: string): boolean {
  const words = wordCount(line);
  if (words === 0 || words > 4) return false;
  return /:\s*$/.test(line) || (line === line.toUpperCase() && /[A-Z]/.test(line));
}

/** Longer lines (letter paragraphs) are cut into sentences so excerpts stay readable. */
const MAX_EXCERPT_LINE = 240;

interface Segment extends SourceSpan {
  text: string;
  listedOnly: boolean;
}

function segmentDocument(text: string): Segment[] {
  const segments: Segment[] = [];
  let inSkills = false;
  let lineStart = 0;
  while (lineStart <= text.length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd).trim();
    if (line) {
      if (looksLikeResumeHeading(line) || SKILLS_HEADING.test(line)) {
        inSkills = SKILLS_HEADING.test(line);
      }
      const cleaned = line.replace(/^[•\-*◦○●‣⁃▪■–·]\s*/, '');
      const listedOnly = inSkills || SKILLS_LABEL.test(cleaned);
      const whole = trimmedSegment(text, lineStart, lineEnd);
      const pieces = !whole
        ? []
        : whole.end - whole.start > MAX_EXCERPT_LINE
          ? splitSentences(text, whole.start, whole.end)
          : [whole];
      for (const piece of pieces) segments.push({ ...piece, listedOnly });
    }
    lineStart = lineEnd + 1;
  }
  return segments;
}

/** Groups matches by the line or sentence that holds them. */
export function groupIntoExcerpts(text: string, matches: TermMatch[]): EvidenceExcerpt[] {
  if (matches.length === 0) return [];
  const excerpts: EvidenceExcerpt[] = [];
  for (const segment of segmentDocument(text)) {
    const inside = matches.filter((m) => m.start >= segment.start && m.end <= segment.end);
    if (inside.length > 0) excerpts.push({ ...segment, matches: inside });
  }
  return excerpts;
}

export interface RequirementEvidence {
  terms: RequirementTerm[];
  excerpts: EvidenceExcerpt[];
  /** Terms with at least one match. */
  foundTerms: RequirementTerm[];
  /** Terms with no match anywhere in the text. */
  missingTerms: RequirementTerm[];
}

/**
 * Looks for a requirement's terms in a resume or letter and returns the
 * excerpts that hold them, with offsets into `documentText`.
 */
export function findRequirementEvidence(
  requirementText: string,
  documentText: string,
  options: TermOptions = {}
): RequirementEvidence {
  const terms = extractRequirementTerms(requirementText, options);
  const matches = findTermMatches(terms, documentText);
  const found = new Set(matches.map((m) => m.termKey));
  return {
    terms,
    excerpts: groupIntoExcerpts(documentText, matches),
    foundTerms: terms.filter((t) => found.has(t.key)),
    missingTerms: terms.filter((t) => !found.has(t.key)),
  };
}
