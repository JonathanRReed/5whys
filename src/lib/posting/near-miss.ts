/**
 * "This line may already say it, in other words." For a requirement the
 * resume does not show, finds up to two work lines that plausibly describe
 * the same work in different words: "Coordinated with the DC on truck
 * schedules and freight flow" for "Coordinate inbound and outbound shipment
 * schedules with carriers and warehouse leads".
 *
 * Conservative by design. A line needs two separate things in common with
 * the requirement (after stemming and the authored table in
 * work-synonyms.ts), at least one of them an object of work rather than a
 * verb. A duty can also be bridged by one specific kind of work the table
 * knows, said in other words, on a line that opens with something the
 * person did: "Ran safety meetings" for "run weekly status meetings", "Led
 * rollout of a new WMS" for "go-live readiness". Tool, education, and
 * unreadable requirements get none: a tool is either used or not. A near
 * miss never counts as evidence, and never offers a named tool or
 * credential the line does not have.
 */

import { analyzeRequirement, type EvidenceOptions } from './evidence';
import { findVariant, type RequirementTerm, stem, tokenize, tokenRoles } from './match';
import { notDoneSpans, readDocument, startsWithAction } from './resume-lines';
import { normalizePunctuation } from './text';
import type { SourceSpan } from './types';
import { WORK_SYNONYM_GROUPS, type WorkSynonymGroup } from './work-synonyms';

export interface NearMiss extends SourceSpan {
  /** The resume line, offsets into the resume text. */
  text: string;
  /** The line's own words that line up with the requirement. */
  shared: string[];
  /**
   * The requirement's own words the person could use if the line is truly
   * about that work. Never a claim to add without the work.
   */
  postingTerms: string[];
}

export interface NearMissOptions extends EvidenceOptions {
  /** At most this many lines. Defaults to 2. */
  limit?: number;
  /** Lines already counted as evidence; they are not offered again. */
  exclude?: readonly SourceSpan[];
}

/**
 * The everyday work that belongs to a field named in a years requirement.
 * Only fields with a clear core are listed; "operations" covers almost any
 * job, so it is left to its own word.
 */
const FIELD_WORK: Readonly<Record<string, readonly string[]>> = {
  logistics: [
    'logistics',
    'shipment',
    'warehouse',
    'receiving',
    'carrier',
    'dispatch',
    'pick-pack',
  ],
  'supply chain': ['logistics', 'inventory', 'purchasing', 'carrier', 'warehouse'],
  warehouse: ['warehouse', 'receiving', 'pick-pack', 'inventory', 'shipment'],
  'customer service': ['customer', 'escalation', 'phone', 'service-desk', 'front-desk'],
  retail: ['cash', 'sales', 'merchandising', 'customer', 'inventory'],
  'food service': ['food-prep', 'food-safety', 'serve'],
  scheduling: ['schedule', 'labor'],
  inventory: ['inventory', 'reconcile', 'receiving'],
};

interface ConceptHit extends SourceSpan {
  concept: string;
  kind: 'thing' | 'action';
  /** True when the hit came from the synonym table rather than the word itself. */
  viaTable: boolean;
}

function overlaps(a: SourceSpan, b: SourceSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

function groupHits(group: WorkSynonymGroup, text: string, lower: string): SourceSpan[] {
  const spans: SourceSpan[] = [];
  for (const word of group.words) {
    const capsOnly = word !== word.toLowerCase();
    for (const span of findVariant(word, text, lower)) {
      if (capsOnly && text.slice(span.start, span.end) !== word) continue;
      spans.push(span);
    }
  }
  return spans;
}

/** Concepts per resume line, kept while the same lines are checked against each requirement. */
const lineConcepts = new Map<string, ConceptHit[]>();

function conceptsOfLine(text: string): ConceptHit[] {
  let hits = lineConcepts.get(text);
  if (!hits) {
    if (lineConcepts.size > 500) lineConcepts.clear();
    hits = concepts(text);
    lineConcepts.set(text, hits);
  }
  return hits;
}

/** Concepts in `text`: table groups first (longest match wins), then the stems of other content words. */
function concepts(text: string, region?: (span: SourceSpan) => boolean): ConceptHit[] {
  const lower = text.toLowerCase();
  const candidates: ConceptHit[] = [];
  for (const group of WORK_SYNONYM_GROUPS) {
    for (const span of groupHits(group, text, lower)) {
      if (region && !region(span)) continue;
      candidates.push({ ...span, concept: group.id, kind: group.kind, viaTable: true });
    }
  }
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const hits: ConceptHit[] = [];
  for (const hit of candidates) {
    // One phrase can name two kinds of work ("vendor" is a carrier and a
    // stakeholder); a shorter phrase inside a longer one is dropped.
    const blocked = hits.some(
      (h) => overlaps(h, hit) && !(h.start === hit.start && h.end === hit.end)
    );
    if (!blocked && !hits.some((h) => h.concept === hit.concept && overlaps(h, hit)))
      hits.push(hit);
  }
  const tokens = tokenize(text);
  const roles = tokenRoles(text, tokens);
  tokens.forEach((token, k) => {
    if (roles[k] !== 'content' || token.lower.length < 4) return;
    if (region && !region(token)) return;
    if (hits.some((h) => overlaps(h, token))) return;
    hits.push({
      start: token.start,
      end: token.end,
      concept: `stem:${stem(token.lower).root}`,
      kind: 'thing',
      viaTable: false,
    });
  });
  return hits.sort((a, b) => a.start - b.start);
}

const stems = (words: string) =>
  words
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2)
    .map((w) => stem(w).root);

/**
 * Concepts the line says with different words from the requirement's own
 * (`ownWords`): "carriers" for "vendors", "safety meetings" for "status
 * meetings". A phrase made only of the requirement's words ("under budget"
 * for "budgets") is the same words, not other words.
 */
function differing(
  hits: ConceptHit[],
  text: string,
  ownWords: ReadonlyMap<string, ReadonlySet<string>>
): Set<string> {
  const ids = new Set<string>();
  for (const hit of hits) {
    if (!hit.viaTable) continue;
    const own = ownWords.get(hit.concept) ?? new Set<string>();
    const lineStems = stems(text.slice(hit.start, hit.end));
    if (lineStems.some((w) => !own.has(w))) ids.add(hit.concept);
  }
  return ids;
}

const ALONE = new Set(WORK_SYNONYM_GROUPS.filter((g) => g.alone).map((g) => g.id));

/**
 * The posting's words for a shared concept: the requirement term that holds
 * it, unless that term trails off into a word that is not part of the work
 * ("stakeholders informed"), when the table's own phrase reads better.
 */
function postingLabelSpan(hit: SourceSpan, holder: RequirementTerm, requirement: string) {
  const tail = requirement.slice(hit.end, holder.span.end);
  return /\b[a-z]+ed\s*$/i.test(tail) ? hit : holder.span;
}

/** Blanks out parenthetical examples ("(on-time shipping, order accuracy)"), keeping offsets. */
function withoutParentheses(text: string): string {
  return text.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length));
}

/** `text` with the spans `find` returns replaced by spaces, keeping offsets. */
function blank(text: string, find: (text: string) => SourceSpan[]): string {
  let out = text;
  for (const span of find(text))
    out = out.slice(0, span.start) + ' '.repeat(span.end - span.start) + out.slice(span.end);
  return out;
}

function mergeLabels(text: string, spans: SourceSpan[]): string[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: SourceSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && (overlaps(last, span) || /^[\s-]*$/.test(text.slice(last.end, span.start)))) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged.map((s) => text.slice(s.start, s.end).trim()).filter(Boolean);
}

/**
 * Up to `limit` resume lines that may describe the requirement's work in
 * other words, each with the posting's own words for it. Empty when nothing
 * is close enough: no answer is better than a wrong one.
 */
export function findNearMisses(
  requirementText: string,
  resumeText: string,
  options: NearMissOptions = {}
): NearMiss[] {
  const limit = options.limit ?? 2;
  const requirement = normalizePunctuation(requirementText);
  const analysis = analyzeRequirement(requirement, options);
  if (analysis.kind === 'tool' || analysis.kind === 'education') return [];
  if (analysis.kind === 'task' && analysis.terms.length === 0) return [];
  if (analysis.kind === 'years' && (analysis.years?.fields.length ?? 0) === 0) return [];

  // Where the requirement's concepts come from: for years, its field list only.
  const fieldTerms: RequirementTerm[] = analysis.years?.fields ?? [];
  const inFields = (span: SourceSpan) =>
    fieldTerms.some((f) => f.span.start <= span.start && span.end <= f.span.end);
  const source = withoutParentheses(requirement);
  // A named tool ("Excel") is used or not: a line about spreadsheets does not show it.
  const tools = analysis.terms.filter((t) => t.shape === 'named');
  const notTool = (span: SourceSpan) => !tools.some((t) => overlaps(t.span, span));
  const wanted = concepts(source, (span) =>
    analysis.kind === 'years' ? inFields(span) : notTool(span)
  );
  // A field names an area of work; the table says which everyday work belongs to it.
  for (const field of fieldTerms) {
    for (const id of FIELD_WORK[field.key] ?? []) {
      const group = WORK_SYNONYM_GROUPS.find((g) => g.id === id);
      if (group) wanted.push({ ...field.span, concept: id, kind: group.kind, viaTable: true });
    }
  }
  if (wanted.length === 0) return [];
  const wantedIds = new Set(wanted.map((h) => h.concept));
  const requirementWords = new Map<string, Set<string>>();
  for (const hit of wanted) {
    const set = requirementWords.get(hit.concept) ?? new Set<string>();
    for (const w of stems(source.slice(hit.start, hit.end))) set.add(w);
    requirementWords.set(hit.concept, set);
  }

  const exclude = options.exclude ?? [];
  const doc = readDocument(resumeText, { today: options.today });
  const normalized = normalizePunctuation(resumeText);

  const scored: {
    line: (typeof doc.lines)[number];
    shared: ConceptHit[];
    order: number;
    strength: number;
  }[] = [];
  doc.lines.forEach((line, order) => {
    if (line.kind !== 'experience') return;
    if (exclude.some((span) => overlaps(span, line))) return;
    // "Never coordinated", "Plan to learn": a denial or a plan is not the work.
    const text = blank(normalized.slice(line.start, line.end), notDoneSpans);
    const found = conceptsOfLine(text).filter((h) => wantedIds.has(h.concept));
    const ids = new Set(found.map((h) => h.concept));
    const things = new Set(found.filter((h) => h.kind === 'thing').map((h) => h.concept));
    const places = new Set(found.map((h) => `${h.start}:${h.end}`));
    const words = new Set(found.map((h) => text.slice(h.start, h.end).toLowerCase()));
    // "In other words": at least one shared thing must be said differently.
    // A line that only repeats the requirement's own words is not a near miss.
    const different = differing(found, text, requirementWords);
    if (different.size === 0) return;
    // Two things in common means two places in the requirement too: "client"
    // is a customer and a stakeholder, but it is still one thing asked for.
    const asked = new Set(
      wanted.filter((h) => ids.has(h.concept)).map((h) => `${h.start}:${h.end}`)
    );
    const two =
      (ids.size >= 2 && places.size >= 2 && asked.size >= 2 && things.size >= 1) ||
      // A field list ("logistics") names one area; three different words for it in one line is enough.
      (analysis.kind === 'years' && things.size >= 1 && words.size >= 3);
    // One specific kind of work, said in other words, on a line about something the person did.
    const bridge =
      analysis.kind === 'task' &&
      startsWithAction(text.replace(/^[\s•\-*◦○●‣⁃▪■–—·]+/, '')) &&
      [...different].some((id) => ALONE.has(id));
    if (!two && !bridge) return;
    scored.push({
      line,
      shared: found.map((h) => ({ ...h, start: h.start + line.start, end: h.end + line.start })),
      order,
      strength: two ? 2 : 1,
    });
  });

  const conceptCount = (s: (typeof scored)[number]) => new Set(s.shared.map((h) => h.concept)).size;
  scored.sort(
    (a, b) => b.strength - a.strength || conceptCount(b) - conceptCount(a) || a.order - b.order
  );

  const results: NearMiss[] = [];
  for (const candidate of scored) {
    if (results.length >= limit) break;
    const lineText = blank(
      normalized.slice(candidate.line.start, candidate.line.end),
      notDoneSpans
    );
    const sharedIds = differing(
      candidate.shared.map((h) => ({
        ...h,
        start: h.start - candidate.line.start,
        end: h.end - candidate.line.start,
      })),
      lineText,
      requirementWords
    );
    const lineLower = lineText.toLowerCase();
    // The requirement's own words for the shared concepts, widened to the term that holds them.
    const spans: SourceSpan[] = [];
    for (const hit of wanted) {
      if (!sharedIds.has(hit.concept)) continue;
      const holders = analysis.terms.filter(
        (t) => t.span.start <= hit.start && hit.end <= t.span.end
      );
      if (holders.length === 0) spans.push(hit);
      for (const holder of holders) spans.push(postingLabelSpan(hit, holder, requirement));
    }
    const postingTerms = mergeLabels(requirement, spans).filter(
      (label) => findVariant(label.toLowerCase(), lineText, lineLower).length === 0
    );
    if (postingTerms.length === 0) continue;
    results.push({
      start: candidate.line.start,
      end: candidate.line.end,
      text: resumeText.slice(candidate.line.start, candidate.line.end),
      shared: mergeLabels(normalized, candidate.shared),
      postingTerms: [...new Set(postingTerms)],
    });
  }
  return results;
}
