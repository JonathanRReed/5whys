/**
 * The requirement list the student reviews. Every function is pure: it takes
 * the current list and returns a new one, or the same list when nothing
 * changed, so a React state setter can bail out.
 */

import { detectSkillsFromText } from '../glowup-banks';
import type { DecodedBullet } from '../glowup-store';
import { type ParsedPosting, type ParseOptions, parsePosting } from './parse';
import {
  isPostingSection,
  isSourceSpan,
  type PostingRequirement,
  type PostingSection,
  type RequirementStatus,
} from './types';

function update(
  requirements: PostingRequirement[],
  id: string,
  change: (requirement: PostingRequirement) => PostingRequirement
): PostingRequirement[] {
  const index = requirements.findIndex((r) => r.id === id);
  if (index === -1) return requirements;
  const current = requirements[index];
  const next = change(current);
  if (next === current) return requirements;
  const copy = requirements.slice();
  copy[index] = next;
  return copy;
}

function withStatus(status: RequirementStatus) {
  return (requirement: PostingRequirement): PostingRequirement =>
    requirement.status === status ? requirement : { ...requirement, status };
}

/** The student agrees this is a requirement. */
export function confirmRequirement(
  requirements: PostingRequirement[],
  id: string
): PostingRequirement[] {
  return update(requirements, id, withStatus('confirmed'));
}

/** The student says this is not a requirement. It stays in the list so it can be restored. */
export function dismissRequirement(
  requirements: PostingRequirement[],
  id: string
): PostingRequirement[] {
  return update(requirements, id, withStatus('dismissed'));
}

/** Back to `suggested`, undoing a confirm or a dismiss. */
export function restoreRequirement(
  requirements: PostingRequirement[],
  id: string
): PostingRequirement[] {
  return update(requirements, id, withStatus('suggested'));
}

/** The student moves a requirement to another section. The engine's own reading is kept in `classification`. */
export function setRequirementSection(
  requirements: PostingRequirement[],
  id: string,
  section: PostingSection
): PostingRequirement[] {
  if (!isPostingSection(section)) return requirements;
  return update(requirements, id, (r) => (r.section === section ? r : { ...r, section }));
}

/** The student rewords a requirement. The source span still points at the original sentence. */
export function editRequirementText(
  requirements: PostingRequirement[],
  id: string,
  text: string
): PostingRequirement[] {
  const trimmed = text.trim();
  if (!trimmed) return requirements;
  return update(requirements, id, (r) => (r.text === trimmed ? r : { ...r, text: trimmed }));
}

export interface AddRequirementOptions {
  section?: PostingSection;
  /** Defaults to `confirmed`: a requirement the student typed is one they mean. */
  status?: RequirementStatus;
  /** Supply an id to control it; otherwise the next free `s-<n>` is used. */
  id?: string;
}

/** Adds a requirement the student wrote. Blank text is ignored. */
export function addRequirement(
  requirements: PostingRequirement[],
  text: string,
  options: AddRequirementOptions = {}
): PostingRequirement[] {
  const trimmed = text.trim();
  if (!trimmed) return requirements;
  const taken = new Set(requirements.map((r) => r.id));
  let id = options.id;
  if (!id || taken.has(id)) {
    let n = requirements.filter((r) => r.origin === 'student').length + 1;
    while (taken.has(`s-${n}`)) n++;
    id = `s-${n}`;
  }
  return [
    ...requirements,
    {
      id,
      text: trimmed,
      section:
        options.section && isPostingSection(options.section) ? options.section : 'unclassified',
      status: options.status ?? 'confirmed',
      origin: 'student',
      span: null,
    },
  ];
}

/**
 * Removes a requirement the student added. Parsed requirements cannot be
 * removed, only dismissed, so the posting's own sentences never vanish.
 */
export function removeRequirement(
  requirements: PostingRequirement[],
  id: string
): PostingRequirement[] {
  const target = requirements.find((r) => r.id === id);
  if (target?.origin !== 'student') return requirements;
  return requirements.filter((r) => r.id !== id);
}

/**
 * Whether "confirm" without a filter takes this requirement: required and
 * preferred qualifications do; duties and lines the engine could not place
 * wait for the student, because a description sentence swept in here
 * becomes a false row on every other station.
 */
export function confirmsByDefault(requirement: PostingRequirement): boolean {
  return requirement.section === 'required' || requirement.section === 'preferred';
}

/**
 * Confirms every suggested requirement that passes `filter`. By default
 * that is the required and preferred ones (`confirmsByDefault`); pass
 * `() => true` to confirm everything.
 */
export function confirmAllSuggested(
  requirements: PostingRequirement[],
  filter: (requirement: PostingRequirement) => boolean = confirmsByDefault
): PostingRequirement[] {
  let changed = false;
  const next = requirements.map((r) => {
    if (r.status !== 'suggested' || !filter(r)) return r;
    changed = true;
    return { ...r, status: 'confirmed' as const };
  });
  return changed ? next : requirements;
}

export function confirmedRequirements(requirements: PostingRequirement[]): PostingRequirement[] {
  return requirements.filter((r) => r.status === 'confirmed');
}

export type SectionCounts = Record<PostingSection, number>;

/** Requirements per section, leaving out dismissed ones. */
export function countBySection(requirements: PostingRequirement[]): SectionCounts {
  const counts: SectionCounts = { required: 0, preferred: 0, responsibility: 0, unclassified: 0 };
  for (const r of requirements) {
    if (r.status !== 'dismissed') counts[r.section]++;
  }
  return counts;
}

/**
 * After the posting is re-parsed, keeps the student's decisions: requirements
 * they added, and the status, section, and wording of any parsed requirement
 * whose sentence is still there (matched by span, then by original text).
 */
export function carryOverDecisions(
  previous: PostingRequirement[],
  reparsed: PostingRequirement[],
  previousText: string,
  nextText: string
): PostingRequirement[] {
  const byId = new Map(previous.filter((r) => r.origin === 'parsed').map((r) => [r.id, r]));
  const bySentence = new Map<string, PostingRequirement>();
  for (const r of previous) {
    if (r.origin !== 'parsed' || !r.span) continue;
    bySentence.set(previousText.slice(r.span.start, r.span.end), r);
  }
  const merged = reparsed.map((next) => {
    const sentence = next.span ? nextText.slice(next.span.start, next.span.end) : '';
    const sameId = byId.get(next.id);
    const prior =
      sameId?.span && previousText.slice(sameId.span.start, sameId.span.end) === sentence
        ? sameId
        : bySentence.get(sentence);
    if (!prior) return next;
    return { ...next, status: prior.status, section: prior.section, text: prior.text };
  });
  return [...merged, ...previous.filter((r) => r.origin === 'student')];
}

/**
 * Where each parsed requirement went when a posting was decoded again: its
 * old id to its new one, matched on the source sentence. Ids are positions
 * in the text, so an edit above a requirement changes its id without
 * changing the requirement. One that is no longer in the posting is absent.
 */
export function requirementIdMap(
  previous: PostingRequirement[],
  reparsed: PostingRequirement[],
  previousText: string,
  nextText: string
): Map<string, string> {
  const bySentence = new Map<string, string[]>();
  for (const next of reparsed) {
    if (!next.span) continue;
    const sentence = nextText.slice(next.span.start, next.span.end);
    bySentence.set(sentence, [...(bySentence.get(sentence) ?? []), next.id]);
  }
  const map = new Map<string, string>();
  for (const prior of previous) {
    if (prior.origin !== 'parsed' || !prior.span) continue;
    const sentence = previousText.slice(prior.span.start, prior.span.end);
    // The same sentence twice keeps its order.
    const next = bySentence.get(sentence)?.shift();
    if (next) map.set(prior.id, next);
  }
  return map;
}

// ============================================================================
// Glow Up decoded bullets
// ============================================================================

function statusOf(bullet: DecodedBullet): RequirementStatus {
  if (bullet.status === 'ignored') return 'dismissed';
  return bullet.confirmed ? 'confirmed' : 'suggested';
}

/** Reads a saved Glow Up bullet as a requirement. Old bullets come back `unclassified` with no span. */
export function bulletToRequirement(bullet: DecodedBullet): PostingRequirement {
  return {
    id: bullet.id,
    text: bullet.text,
    section: isPostingSection(bullet.section) ? bullet.section : 'unclassified',
    status: statusOf(bullet),
    origin: bullet.origin === 'student' ? 'student' : 'parsed',
    span: isSourceSpan(bullet.sourceSpan) ? bullet.sourceSpan : null,
  };
}

/**
 * Writes a requirement as a Glow Up bullet. Skill tags are kept from the
 * existing bullet when its text is unchanged, and detected afresh otherwise,
 * the same way the decode screen tags a new line.
 */
export function requirementToBullet(
  requirement: PostingRequirement,
  existing?: DecodedBullet
): DecodedBullet {
  let tags: Pick<DecodedBullet, 'primarySkillId' | 'secondarySkillIds' | 'suggestion'>;
  if (existing && existing.text === requirement.text) {
    tags = {
      primarySkillId: existing.primarySkillId,
      secondarySkillIds: existing.secondarySkillIds,
      suggestion: existing.suggestion,
    };
  } else {
    const suggestions = detectSkillsFromText(requirement.text);
    tags = {
      primarySkillId: suggestions[0]?.skillId ?? null,
      secondarySkillIds: suggestions.slice(1).map((s) => s.skillId),
      suggestion: suggestions,
    };
  }
  return {
    ...(existing ?? {}),
    id: requirement.id,
    text: requirement.text,
    status: requirement.status === 'dismissed' ? 'ignored' : 'active',
    ...tags,
    section: requirement.section,
    sourceSpan: requirement.span,
    confirmed: requirement.status === 'confirmed',
    origin: requirement.origin,
  };
}

export function requirementsFromBullets(bullets: DecodedBullet[]): PostingRequirement[] {
  return bullets.map(bulletToRequirement);
}

/** Bullets for a requirement list, reusing skill tags from `existing` bullets with the same id. */
export function bulletsFromRequirements(
  requirements: PostingRequirement[],
  existing: DecodedBullet[] = []
): DecodedBullet[] {
  const byId = new Map(existing.map((b) => [b.id, b]));
  return requirements.map((r) => requirementToBullet(r, byId.get(r.id)));
}

/** Parses a posting straight into Glow Up bullets, for the decode screen and the desk alike. */
export function decodePostingToBullets(
  rawText: string,
  options: ParseOptions = {}
): { parsed: ParsedPosting; bullets: DecodedBullet[] } {
  const parsed = parsePosting(rawText, options);
  return { parsed, bullets: bulletsFromRequirements(parsed.requirements) };
}
