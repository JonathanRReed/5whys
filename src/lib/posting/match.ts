/**
 * Alias-aware term matching. A requirement is reduced to the terms a resume
 * or letter could actually show: named tools and credentials, multi-word
 * phrases, and (only when a clause has nothing else) its domain words.
 * Generic words are never terms. Weak words ("management", "leadership",
 * "Ohio", a company's name) may sit inside a phrase but never stand alone.
 * Each term is looked for with word-boundary matching that tolerates plural,
 * -ing, and -ed forms; a phrase matches as a phrase, not as one of its words.
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
import {
  ACTION_VERBS,
  COMPANY_SUFFIXES,
  isWeakWord,
  NOT_A_TOOL,
  PLACE_NAMES,
  STATE_CODES,
  WEAK_VERBS,
} from './lexicon';
import { type DocumentLineKind, readDocument } from './resume-lines';
import { GENERIC_TERMS, isGenericWord } from './terms';
import { escapeRegExp, normalizePunctuation } from './text';
import type { OccupationLookup, SourceSpan } from './types';

// ============================================================================
// Morphology
// ============================================================================

function undouble(root: string): string {
  return /([bdgmnpt])\1$/.test(root) ? root.slice(0, -1) : root;
}

/** A crude stem: enough to line up plan / plans / planned / planning. */
export function stem(word: string): { root: string; yForm: boolean } {
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
export function findVariant(variant: string, text: string, lower: string): SourceSpan[] {
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

/**
 * How much a term can prove on its own.
 * - `named`: a tool, credential, acronym, or proper name ("Smartsheet", "WMS").
 * - `phrase`: two words that belong together ("shipment schedules").
 * - `word`: one domain word, used only when its clause has nothing stronger.
 */
export type TermShape = 'named' | 'phrase' | 'word';

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
  /** How much the term can prove on its own. Absent on terms built by older code. */
  shape?: TermShape;
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

/**
 * Skills whose keywords name tools a line can show. Soft skills
 * ("leadership", "communication") and broad domains ("retail", "finance")
 * are left out: their keywords are umbrella words, and the umbrella is how
 * "coached associates" used to count as tracking KPIs.
 */
const TOOL_SKILLS: ReadonlySet<string> = new Set(
  SKILL_BANK.filter(
    (skill) => skill.category === 'technical' || skill.id === 'agile' || skill.id === 'ux'
  ).map((skill) => skill.id)
);

/**
 * Tool-skill keywords that are everyday words in other postings: "mobile
 * pantry", "store security", "sprint to the finish". They are read as plain
 * words, so they need a phrase around them to count.
 */
const AMBIGUOUS_SKILL_WORDS: ReadonlySet<string> = new Set([
  'mobile',
  'security',
  'cloud',
  'infrastructure',
  'architecture',
  'accessibility',
  'rest',
  'node',
  'lambda',
  'sprint',
  'standup',
  'visualization',
  'penetration',
  'vulnerability',
]);

/** Authored synonym groups that name a quality, not a thing a line can show. */
const SOFT_GROUPS: ReadonlySet<string> = new Set(['problem solving']);

/** Bank keywords that may stand as terms, each with the spellings that count as evidence. */
const SKILL_KEYWORD_ENTRIES: SkillKeywordEntry[] = (() => {
  const usable = (keyword: string) =>
    !WEAK_SKILL_KEYWORDS.has(keyword) &&
    !AMBIGUOUS_SKILL_WORDS.has(keyword) &&
    !GENERIC_TERMS.has(keyword) &&
    !isWeakWord(keyword);
  const entries: SkillKeywordEntry[] = [];
  for (const skill of SKILL_BANK) {
    if (!TOOL_SKILLS.has(skill.id)) continue;
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

export interface Token extends SourceSpan {
  text: string;
  lower: string;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9'+#&]*(?:[./-][A-Za-z0-9+#&]+)*/g)) {
    const start = match.index ?? 0;
    const raw = match[0].replace(/'s$|'$/, '');
    tokens.push({ start, end: start + raw.length, text: raw, lower: raw.toLowerCase() });
  }
  return tokens;
}

function isAcronym(token: Token): boolean {
  return /^[A-Z][A-Z&]{1,5}s?$/.test(token.text) && !NOT_A_TOOL.has(token.lower);
}

/**
 * What a token can contribute.
 * - `stop`: generic or function word, never part of a term.
 * - `weak`: an umbrella word; inside a phrase only.
 * - `ignored`: a place or an organization's name; never part of a term.
 * - `content`: a word that can carry a term.
 */
export type TokenRole = 'stop' | 'weak' | 'ignored' | 'content';

/** Words that say how much a posting wants something, not what it wants. */
const PREFERENCE_WORDS = new Set([
  'old',
  'exposure',
  'second',
  'third',
  'another',
  'language',
  'languages',
  'clear',
  'concise',
  'effective',
  'keen',
  'sharp',
  'superb',
  'thorough',
  'helpful',
  'desired',
  'desirable',
  'advantageous',
  'asset',
  'appreciated',
  'considered',
  'toward',
  'towards',
  'similar',
]);

export function isStopWord(lower: string): boolean {
  return (
    isGenericWord(lower) ||
    PREFERENCE_WORDS.has(lower) ||
    CALENDAR_WORDS.has(lower.replace(/s$/, '')) ||
    // Adverbs ("accurately", "independently") describe how, not what.
    /(?:ately|ingly|edly|ently|antly|ously|ively|fully|ally|lessly)$/.test(lower)
  );
}

/** Next to each other with only a space, hyphen, or possessive between ("driver's license"). */
function adjacent(text: string, a: Token, b: Token): boolean {
  return /^(?:'s?)?[\s-]+$/.test(text.slice(a.end, b.start));
}

const capitalized = (token: Token) => /^[A-Z]/.test(token.text);

/** Roles for every token, with places and organization names marked `ignored`. */
export function tokenRoles(text: string, tokens: Token[]): TokenRole[] {
  const roles: TokenRole[] = tokens.map((token) => {
    if (token.lower.length < 2 || NOT_A_TOOL.has(token.lower)) return 'stop';
    if (isAcronym(token)) return 'content';
    if (token.lower.length < 3 || isStopWord(token.lower)) return 'stop';
    if (PLACE_NAMES.has(token.lower)) return 'ignored';
    if (isWeakWord(token.lower)) return 'weak';
    return 'content';
  });
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (
      PLACE_NAMES.has(`${tokens[i].lower} ${tokens[i + 1].lower}`) &&
      adjacent(text, tokens[i], tokens[i + 1])
    ) {
      roles[i] = 'ignored';
      roles[i + 1] = 'ignored';
    }
  }
  // Capitalized runs: "Columbus, OH" is a place, "Larkfield Brands, Inc." an organization.
  let i = 0;
  while (i < tokens.length) {
    if (!capitalized(tokens[i])) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < tokens.length &&
      capitalized(tokens[j + 1]) &&
      adjacent(text, tokens[j], tokens[j + 1])
    )
      j++;
    const after = text.slice(tokens[j].end, tokens[j + 1]?.start ?? text.length);
    const next = tokens[j + 1];
    const afterNext = tokens[j + 2];
    // "Columbus, OH" is a place; "Smartsheet, MS Project" is two tools.
    const stateCode =
      next &&
      /^,\s*$/.test(after) &&
      STATE_CODES.has(next.text) &&
      !(afterNext && capitalized(afterNext) && adjacent(text, next, afterNext));
    const company =
      (j > i && COMPANY_SUFFIXES.has(tokens[j].lower)) ||
      (next && /^,?\s*$/.test(after) && /^(?:inc|llc|ltd|corp)$/i.test(next.text));
    if (stateCode || company) {
      for (let k = i; k <= j; k++) roles[k] = 'ignored';
      if (stateCode && next) roles[j + 1] = 'ignored';
    }
    i = j + 1;
  }
  return roles;
}

function sentenceInitial(text: string, token: Token): boolean {
  const before = text.slice(0, token.start).trimEnd();
  // After a colon or semicolon a capital usually starts a name ("one of: Canva, Figma").
  return before === '' || /[.!?(•*-]$/.test(before);
}

function overlaps(a: SourceSpan, b: SourceSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

const PRONOUNS = new Set(['them', 'it', 'this', 'these', 'those', 'that']);

/**
 * Cuts a requirement into the separate things it asks for: at semicolons,
 * and where "and", "or", or a comma introduces another duty verb ("Track
 * KPIs and prepare weekly reports"). Never inside parentheses, and never
 * before a pronoun ("own them to resolution" continues the clause before).
 */
export function splitClauses(text: string, tokens: Token[] = tokenize(text)): SourceSpan[] {
  const depthAt = (index: number) => {
    let depth = 0;
    for (let k = 0; k < index; k++) {
      if (text[k] === '(') depth++;
      else if (text[k] === ')') depth = Math.max(0, depth - 1);
    }
    return depth;
  };
  const cuts: number[] = [];
  for (let k = 0; k < text.length; k++) {
    if (text[k] === ';' && depthAt(k) === 0) cuts.push(k);
  }
  for (let t = 1; t < tokens.length; t++) {
    const token = tokens[t];
    if (!ACTION_VERBS.has(token.lower)) continue;
    const previous = tokens[t - 1];
    const gap = text.slice(previous.end, token.start);
    const joined = previous.lower === 'and' || previous.lower === 'or';
    if (!joined && !/,\s*$/.test(gap)) continue;
    if (PRONOUNS.has(tokens[t + 1]?.lower ?? '')) continue;
    // "Track budgets and purchase orders": a verb followed straight by a noun it modifies is not a new duty.
    if (token.lower === 'purchase' && tokens[t + 1]?.lower.startsWith('order')) continue;
    const at = joined ? previous.start : previous.end;
    // "Plan and schedule ...", "Build and maintain ...": a lone verb before
    // "and" shares the object that follows, so it is not a clause of its own.
    const since = Math.max(0, ...cuts.filter((c) => c < at));
    const before = tokens.filter((t) => t.start >= since && t.end <= at);
    const loneVerb = before.every(
      (t) =>
        ACTION_VERBS.has(t.lower) || isStopWord(t.lower) || t.lower === 'and' || t.lower === 'or'
    );
    if (depthAt(at) === 0 && !loneVerb) cuts.push(at);
  }
  cuts.sort((a, b) => a - b);
  const spans: SourceSpan[] = [];
  let start = 0;
  for (const cut of cuts) {
    if (cut > start) spans.push({ start, end: cut });
    start = cut;
  }
  if (start < text.length) spans.push({ start, end: text.length });
  return spans;
}

/**
 * Whether a clause lists alternatives ("inventory or logistics", "Spanish or
 * another language"), not counting "30 or more", "18 or older", "or a
 * related field", or "or equivalent".
 */
export function offersAlternatives(clause: string): boolean {
  return /\bor\b/i.test(
    clause.replace(
      /\bor\s+(?:more|older|higher|above|greater|later|less|fewer|equivalent|similar|related|a\s+related|other|another\s+related)\b/gi,
      ' '
    )
  );
}

export interface ExtractedTerms {
  /** Terms a resume line can show, in reading order. */
  terms: RequirementTerm[];
  /** Umbrella words, places, and names the requirement used: never evidence alone. */
  weakTerms: RequirementTerm[];
  /** Each clause with the terms inside it. Clauses with no terms are folded into a neighbour. */
  clauses: { span: SourceSpan; terms: RequirementTerm[]; alternatives: boolean }[];
}

function termFrom(
  text: string,
  span: SourceSpan,
  source: TermSource,
  shape: TermShape,
  variants?: string[]
): RequirementTerm {
  const label = text.slice(span.start, span.end);
  const key = label.toLowerCase();
  return { key, label, source, shape, variants: variants ?? [key], span };
}

/**
 * Terms, weak words, and clauses for one requirement. The engine behind
 * `extractRequirementTerms` and the evidence check.
 */
export function extractTermsWithClauses(
  requirementText: string,
  options: TermOptions = {}
): ExtractedTerms {
  const text = normalizePunctuation(requirementText);
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  const roles = tokenRoles(text, tokens);
  const hasLowercase = /[a-z]/.test(text);
  const ignoredSpan = (span: SourceSpan) =>
    tokens.some((t, k) => roles[k] === 'ignored' && overlaps(t, span));

  const named: RequirementTerm[] = [];
  // The caller's dataset first, so it wins a tie with an authored synonym.
  for (const hit of options.lookup?.matchSoftware?.(text) ?? []) {
    if (hit.start < 0 || hit.end > text.length || hit.end <= hit.start) continue;
    const variants = [hit.term, ...(hit.aliases ?? [])]
      .map((v) => v.toLowerCase())
      .filter((v) => !isGenericWord(v));
    if (variants.length === 0) continue;
    named.push({
      key: hit.term.toLowerCase(),
      label: text.slice(hit.start, hit.end),
      source: 'occupation',
      variants: [...new Set(variants)],
      span: { start: hit.start, end: hit.end },
      shape: 'named',
    });
  }
  for (const entry of SKILL_KEYWORD_ENTRIES) {
    for (const span of findVariant(entry.keyword, text, lower)) {
      if (ignoredSpan(span)) continue;
      named.push({
        key: canonicalTerm(entry.keyword),
        label: text.slice(span.start, span.end),
        source: 'skill-bank',
        skillId: entry.skillId,
        variants: entry.variants,
        span,
        shape: 'named',
      });
    }
  }
  for (const { member, group } of SYNONYM_ENTRIES) {
    if (SOFT_GROUPS.has(group[0])) continue;
    for (const span of findVariant(member, text, lower)) {
      if (ignoredSpan(span)) continue;
      named.push({
        key: group[0],
        label: text.slice(span.start, span.end),
        source: 'synonym',
        variants: [...group],
        span,
        shape: 'named',
      });
    }
  }
  if (hasLowercase) {
    // Acronyms: "WMS", "KPIs", "CPR".
    tokens.forEach((token, k) => {
      if (roles[k] === 'content' && isAcronym(token)) {
        named.push(termFrom(text, token, 'phrase', 'named'));
      }
    });
    // Capitalized runs that are not places or names: "Blue Yonder", "Smartsheet".
    let run: number[] = [];
    const flush = () => {
      const hasContent = run.some((k) => roles[k] === 'content');
      const single = run.length === 1;
      if (run.length > 0 && hasContent && !(single && sentenceInitial(text, tokens[run[0]]))) {
        const span = { start: tokens[run[0]].start, end: tokens[run[run.length - 1]].end };
        named.push(termFrom(text, span, 'phrase', 'named'));
      }
      run = [];
    };
    tokens.forEach((token, k) => {
      const usable =
        capitalized(token) && !isAcronym(token) && (roles[k] === 'content' || roles[k] === 'weak');
      const previous = run[run.length - 1];
      if (usable && (previous === undefined || adjacent(text, tokens[previous], token))) {
        run.push(k);
      } else {
        flush();
        if (usable) run.push(k);
      }
    });
    flush();
  }

  // Longest named term wins where two overlap ("React Native" over "React").
  named.sort((a, b) => b.span.end - b.span.start - (a.span.end - a.span.start));
  const accepted: RequirementTerm[] = [];
  for (const term of named) {
    if (!accepted.some((t) => overlaps(t.span, term.span))) accepted.push(term);
  }

  // Phrases: two words side by side, at least one of them a content word,
  // not opening on a generic verb ("coordinate vendors" is just "vendors").
  for (let k = 0; k + 1 < tokens.length; k++) {
    const a = tokens[k];
    const b = tokens[k + 1];
    const roleA = roles[k];
    const roleB = roles[k + 1];
    if (roleA !== 'content' && roleA !== 'weak') continue;
    if (roleB !== 'content' && roleB !== 'weak') continue;
    if (roleA !== 'content' && roleB !== 'content') continue;
    if (WEAK_VERBS.has(a.lower) || !adjacent(text, a, b)) continue;
    const span = { start: a.start, end: b.end };
    if (accepted.some((t) => overlaps(t.span, span) && t.shape === 'named')) continue;
    accepted.push(termFrom(text, span, 'phrase', 'phrase'));
  }

  // Clauses; a clause with no named term or phrase falls back to its words.
  const clauseSpans = splitClauses(text, tokens);
  const clauses = clauseSpans.map((span) => ({
    span,
    terms: accepted.filter((t) => t.span.start >= span.start && t.span.start < span.end),
  }));
  for (const clause of clauses) {
    // "inventory or logistics", "Spanish or another second language": each
    // alternative may stand alone, so the clause's words are terms too.
    const alternatives = offersAlternatives(text.slice(clause.span.start, clause.span.end));
    if (clause.terms.length > 0 && !alternatives) continue;
    tokens.forEach((token, k) => {
      if (roles[k] !== 'content' || token.lower.length < 3) return;
      if (token.start < clause.span.start || token.end > clause.span.end) return;
      if (accepted.some((t) => overlaps(t.span, token))) return;
      const term = termFrom(text, token, 'phrase', 'word');
      clause.terms.push(term);
      accepted.push(term);
    });
  }
  // Fold clauses with nothing in them ("Build" in "Build and maintain ...") into the next.
  const folded: ExtractedTerms['clauses'] = [];
  let pending: SourceSpan | null = null;
  for (const clause of clauses) {
    const span: SourceSpan = pending ? { start: pending.start, end: clause.span.end } : clause.span;
    if (clause.terms.length === 0) {
      pending = span;
      continue;
    }
    pending = null;
    folded.push({
      span,
      terms: clause.terms.sort((a, b) => a.span.start - b.span.start),
      alternatives: false,
    });
  }
  if (pending && folded.length > 0) {
    const last = folded[folded.length - 1];
    last.span = { start: last.span.start, end: pending.end };
  }

  const seen = new Set<string>();
  const terms = accepted
    .sort((a, b) => a.span.start - b.span.start)
    .filter((term) => {
      if (seen.has(term.key)) return false;
      seen.add(term.key);
      return true;
    });
  for (const clause of folded) {
    clause.terms = clause.terms.filter((t) => terms.includes(t));
    clause.alternatives = offersAlternatives(text.slice(clause.span.start, clause.span.end));
  }

  const weakTerms: RequirementTerm[] = [];
  tokens.forEach((token, k) => {
    if (roles[k] !== 'weak' && roles[k] !== 'ignored') return;
    if (WEAK_VERBS.has(token.lower)) return;
    if (accepted.some((t) => overlaps(t.span, token))) return;
    if (weakTerms.some((t) => t.key === token.lower)) return;
    weakTerms.push(termFrom(text, token, 'phrase', 'word'));
  });

  return { terms, weakTerms, clauses: folded.filter((c) => c.terms.length > 0) };
}

/**
 * The terms a requirement asks for. Named tools and credentials (skill-bank
 * tool keywords, authored synonyms, the optional occupation lookup,
 * acronyms, capitalized names) and two-word phrases come first; a clause
 * with neither falls back to its single domain words. Generic words
 * ("currently", "enrolled", "degree", "program") never become terms, so
 * "Currently enrolled in a degree program" has none. Umbrella words
 * ("management", "leadership"), places, and organization names are never
 * terms on their own.
 */
export function extractRequirementTerms(
  requirementText: string,
  options: TermOptions = {}
): RequirementTerm[] {
  return extractTermsWithClauses(requirementText, options).terms;
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
  /** What kind of line this is: a work line, a skills list, an education line, and so on. */
  kind?: DocumentLineKind;
}

/**
 * Groups matches by the line or sentence that holds them. With `kinds`, only
 * lines of those kinds are kept.
 */
export function groupIntoExcerpts(
  text: string,
  matches: TermMatch[],
  kinds?: ReadonlySet<DocumentLineKind>
): EvidenceExcerpt[] {
  if (matches.length === 0) return [];
  const excerpts: EvidenceExcerpt[] = [];
  for (const line of readDocument(text).lines) {
    if (kinds && !kinds.has(line.kind)) continue;
    const inside = matches.filter((m) => m.start >= line.start && m.end <= line.end);
    if (inside.length > 0) {
      excerpts.push({
        start: line.start,
        end: line.end,
        text: line.text,
        matches: inside,
        listedOnly: line.listedOnly,
        kind: line.kind,
      });
    }
  }
  return excerpts;
}
