/**
 * Skill tagging for one line of a posting. Word-boundary matching, no
 * fabricated confidence: a suggestion lists the words that produced it.
 *
 * Two rules came out of the walkthroughs. A phrase beats its parts:
 * "warehouse management system" is logistics, so its "management" cannot
 * also count as leadership, and "pivot tables" cannot count as adaptability.
 * And an ambiguous word needs its context (see KEYWORD_CONTEXT and each
 * skill's `contextual` words).
 */

import { KEYWORD_CONTEXT, type KeywordContext, SKILL_BANK } from './skills';

export interface SkillSuggestion {
  skillId: string;
  /** The exact keywords from the skill's list that appeared in the text. */
  matchedKeywords: string[];
}

interface Entry {
  skillId: string;
  keyword: string;
  lower: string;
  context?: KeywordContext;
}

const ENTRIES: Entry[] = SKILL_BANK.flatMap((skill) => [
  ...[...skill.keywords, ...(skill.tagOnly ?? [])].map((keyword) => ({
    skillId: skill.id,
    keyword,
    lower: keyword.toLowerCase(),
    context: KEYWORD_CONTEXT[keyword.toLowerCase()],
  })),
  ...Object.entries(skill.contextual ?? {}).map(([keyword, context]) => ({
    skillId: skill.id,
    keyword,
    lower: keyword.toLowerCase(),
    context: { ...KEYWORD_CONTEXT[keyword.toLowerCase()], ...context },
  })),
]);

/** Order of keywords within a skill, so matched keywords keep the bank's order. */
const KEYWORD_ORDER = new Map(ENTRIES.map((entry, index) => [entry, index]));

const isWordChar = (char: string | undefined) => Boolean(char && /[a-z0-9+#]/.test(char));

function fitsContext(lower: string, start: number, end: number, context?: KeywordContext): boolean {
  if (!context) return true;
  const before = lower.slice(0, start);
  const after = lower.slice(end);
  if (context.needsBefore && !context.needsBefore.test(before)) return false;
  if (context.needsAfter && !context.needsAfter.test(after)) return false;
  if (context.needsLine && !context.needsLine.test(lower)) return false;
  if (context.notBefore?.test(before)) return false;
  if (context.notAfter?.test(after)) return false;
  return true;
}

interface Hit {
  entry: Entry;
  start: number;
  end: number;
}

function findHits(lower: string): Hit[] {
  const hits: Hit[] = [];
  for (const entry of ENTRIES) {
    let from = lower.indexOf(entry.lower);
    while (from !== -1) {
      const end = from + entry.lower.length;
      if (
        !isWordChar(lower[from - 1]) &&
        !isWordChar(lower[end]) &&
        fitsContext(lower, from, end, entry.context)
      ) {
        hits.push({ entry, start: from, end });
      }
      from = lower.indexOf(entry.lower, from + 1);
    }
  }
  return hits;
}

/** Longest phrases first; a shorter hit inside or across an accepted one is dropped. */
function longestFirst(hits: Hit[]): Hit[] {
  const sorted = [...hits].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const hit of sorted) {
    const clash = kept.some(
      (other) =>
        hit.start < other.end &&
        other.start < hit.end &&
        // The same words may name two skills at once.
        !(hit.start === other.start && hit.end === other.end)
    );
    if (!clash) kept.push(hit);
  }
  return kept;
}

/**
 * Up to three skills a line tests, most distinct keywords first, then the
 * skill whose first keyword comes earliest in the line.
 */
export function detectSkillsFromText(text: string): SkillSuggestion[] {
  const lower = text.toLowerCase();
  const bySkill = new Map<string, { keywords: Hit[]; first: number }>();
  for (const hit of longestFirst(findHits(lower))) {
    const current = bySkill.get(hit.entry.skillId) ?? { keywords: [], first: hit.start };
    if (!current.keywords.some((k) => k.entry.lower === hit.entry.lower)) {
      current.keywords.push(hit);
    }
    current.first = Math.min(current.first, hit.start);
    bySkill.set(hit.entry.skillId, current);
  }
  return [...bySkill.entries()]
    .sort(([, a], [, b]) => b.keywords.length - a.keywords.length || a.first - b.first)
    .slice(0, 3)
    .map(([skillId, { keywords }]) => ({
      skillId,
      matchedKeywords: keywords
        .sort((a, b) => (KEYWORD_ORDER.get(a.entry) ?? 0) - (KEYWORD_ORDER.get(b.entry) ?? 0))
        .map((k) => k.entry.keyword),
    }));
}
