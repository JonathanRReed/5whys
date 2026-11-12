/**
 * Shared types for the posting engine. Kept free of imports so the Glow Up
 * store can reference them without pulling in any engine code.
 */

/** Where a requirement sits in the posting. `unclassified` means the evidence was too weak to say. */
export type PostingSection = 'required' | 'preferred' | 'responsibility' | 'unclassified';

export const POSTING_SECTIONS: readonly PostingSection[] = [
  'required',
  'preferred',
  'responsibility',
  'unclassified',
];

export function isPostingSection(value: unknown): value is PostingSection {
  return typeof value === 'string' && (POSTING_SECTIONS as readonly string[]).includes(value);
}

/** Character offsets into a source string: `start` inclusive, `end` exclusive. */
export interface SourceSpan {
  start: number;
  end: number;
}

/** Whether a value is a well-formed span, optionally one that fits inside `text`. */
export function isSourceSpan(value: unknown, text?: string): value is SourceSpan {
  if (!value || typeof value !== 'object') return false;
  const { start, end } = value as { start?: unknown; end?: unknown };
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if ((start as number) < 0 || (end as number) < (start as number)) return false;
  return text === undefined || (end as number) <= text.length;
}

/** How the engine arrived at a section, so the interface can explain it. */
export type ClassificationBasis =
  /** The line sits under a heading that names its section. */
  | 'heading'
  /** The line itself says so ("required", "a plus", "responsible for"). */
  | 'cue'
  /** A heading and an in-line cue agree. */
  | 'heading-and-cue'
  /** The heading and the cue disagree, so the line is left for the student. */
  | 'conflict'
  /** No heading and no cue. */
  | 'none';

export interface SectionClassification {
  section: PostingSection;
  basis: ClassificationBasis;
  /** The heading text the line sat under, when there was one. */
  heading?: string;
  /** The in-line words that decided or contested the section. */
  cue?: string;
}

/** suggested: found by the engine, not yet reviewed. */
export type RequirementStatus = 'suggested' | 'confirmed' | 'dismissed';

export type RequirementOrigin = 'parsed' | 'student';

export interface PostingRequirement {
  id: string;
  /** Display text. Starts as the source sentence; the student may edit it. */
  text: string;
  section: PostingSection;
  status: RequirementStatus;
  origin: RequirementOrigin;
  /** Offsets of the source sentence in the parsed posting; null when the student added it. */
  span: SourceSpan | null;
  /** The engine's own reading, kept after the student changes the section. */
  classification?: SectionClassification;
}

// ============================================================================
// Occupation dataset hook (O*NET titles and software skills, supplied by a
// separate library; this engine never loads data itself)
// ============================================================================

export interface OccupationMatch {
  /** Canonical name, for example "Microsoft Excel" or "Data Analyst". */
  term: string;
  /** Offsets into the text that was passed to the lookup. */
  start: number;
  end: number;
  /** Other spellings that count as the same thing when looking for evidence. */
  aliases?: string[];
  /** Dataset code, for example an O*NET-SOC code or commodity code. */
  code?: string;
}

/**
 * Optional lookup into a title and software-skills dataset. Every method is
 * optional; the engine works with none of them. Implementations must be pure
 * and synchronous over data the caller already loaded.
 */
export interface OccupationLookup {
  /** Software and tools named in the text. */
  matchSoftware?(text: string): OccupationMatch[];
  /** Job titles named in the text. */
  matchTitles?(text: string): OccupationMatch[];
}
