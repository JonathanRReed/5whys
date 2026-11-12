/**
 * Which confirmed requirements a resume shows evidence for. Counts only: no
 * weights, no percentage, no score.
 */

import {
  type EvidenceOptions,
  type EvidenceState,
  findRequirementEvidence,
  type RequirementKind,
  type RequirementPart,
} from './evidence';
import type { EvidenceExcerpt, RequirementTerm } from './match';
import { findNearMisses, type NearMiss } from './near-miss';
import type { PostingRequirement } from './types';

/**
 * - `evidence`: a distinctive term or phrase appears in a work, project,
 *   skills, or (for a degree) education line.
 * - `partial`: some of the separate things the requirement asks for are
 *   shown, not all; `parts` says which.
 * - `none`: the requirement names things a resume could show, and none are.
 * - `not-checkable`: nothing a text search could find ("Must be 18 or
 *   older"), or the dates needed to count years could not be read.
 */
export type CoverageState = EvidenceState;

export interface CoverageRow {
  requirement: PostingRequirement;
  state: CoverageState;
  terms: RequirementTerm[];
  excerpts: EvidenceExcerpt[];
  foundTerms: RequirementTerm[];
  missingTerms: RequirementTerm[];
  /** How the requirement was read: years, education, tool, or task. */
  kind: RequirementKind;
  /** The separate things it asks for, each shown or not. */
  parts: RequirementPart[];
  /** Umbrella words, places, and names in it, which never count alone. */
  weakTerms: RequirementTerm[];
  /** A plain sentence for the row: years found, or why it cannot be checked. */
  note?: string;
  /**
   * For `none` and `partial` rows: lines that may already describe the work
   * in other words. Never counted as evidence.
   */
  nearMisses: NearMiss[];
}

export interface CoverageSummary {
  rows: CoverageRow[];
  /** Confirmed requirements considered. Every row is one of them. */
  confirmedCount: number;
  withEvidenceCount: number;
  /** Rows that are `none` or `partial`: not fully shown. */
  withoutEvidenceCount: number;
  /** The `partial` rows among `withoutEvidenceCount`. */
  partialCount: number;
  notCheckableCount: number;
}

/**
 * For each confirmed requirement, the lines of `documentText` that show it,
 * how fully, and (when it is not fully shown) lines that may say it in other
 * words. Suggested and dismissed requirements are left out.
 */
export function summarizeCoverage(
  requirements: PostingRequirement[],
  documentText: string,
  options: EvidenceOptions = {}
): CoverageSummary {
  const rows: CoverageRow[] = requirements
    .filter((r) => r.status === 'confirmed')
    .map((requirement) => {
      const evidence = findRequirementEvidence(requirement.text, documentText, options);
      const nearMisses =
        evidence.state === 'none' || evidence.state === 'partial'
          ? findNearMisses(requirement.text, documentText, {
              ...options,
              exclude: evidence.excerpts,
            })
          : [];
      return { requirement, ...evidence, nearMisses };
    });
  const count = (state: CoverageState) => rows.filter((r) => r.state === state).length;
  return {
    rows,
    confirmedCount: rows.length,
    withEvidenceCount: count('evidence'),
    withoutEvidenceCount: count('none') + count('partial'),
    partialCount: count('partial'),
    notCheckableCount: count('not-checkable'),
  };
}

/**
 * The summary as one sentence with its denominator visible, for example
 * "7 of 11 confirmed requirements have evidence in your resume." Only
 * `evidence` rows count; a partly shown requirement is not evidence.
 */
export function describeCoverage(summary: CoverageSummary, documentName = 'your resume'): string {
  const { withEvidenceCount: found, confirmedCount: total } = summary;
  if (total === 0) return 'No confirmed requirements yet.';
  const noun = total === 1 ? 'confirmed requirement' : 'confirmed requirements';
  const verb = found === 1 ? 'has' : 'have';
  return `${found} of ${total} ${noun} ${verb} evidence in ${documentName}.`;
}

/** The labels of a row's parts, split into shown and not shown, for a `partial` row. */
export function describeParts(row: Pick<CoverageRow, 'parts'>): {
  shown: string[];
  notShown: string[];
} {
  return {
    shown: row.parts.filter((p) => p.shown).map((p) => p.label),
    notShown: row.parts.filter((p) => !p.shown).map((p) => p.label),
  };
}
