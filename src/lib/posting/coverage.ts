/**
 * Which confirmed requirements a resume shows evidence for. Counts only: no
 * weights, no percentage, no score.
 */

import {
  type EvidenceExcerpt,
  findRequirementEvidence,
  type RequirementTerm,
  type TermOptions,
} from './match';
import type { PostingRequirement } from './types';

export type CoverageState =
  /** At least one of the requirement's terms appears in the text. */
  | 'evidence'
  /** The requirement has terms and none of them appear. */
  | 'none'
  /** The requirement names nothing a text search could find ("Must be 18 or older"). */
  | 'not-checkable';

export interface CoverageRow {
  requirement: PostingRequirement;
  state: CoverageState;
  terms: RequirementTerm[];
  excerpts: EvidenceExcerpt[];
  foundTerms: RequirementTerm[];
  missingTerms: RequirementTerm[];
}

export interface CoverageSummary {
  rows: CoverageRow[];
  /** Confirmed requirements considered. Every row is one of them. */
  confirmedCount: number;
  withEvidenceCount: number;
  withoutEvidenceCount: number;
  notCheckableCount: number;
}

/**
 * For each confirmed requirement, the excerpts of `documentText` that show
 * its terms, or none. Suggested and dismissed requirements are left out.
 */
export function summarizeCoverage(
  requirements: PostingRequirement[],
  documentText: string,
  options: TermOptions = {}
): CoverageSummary {
  const rows: CoverageRow[] = requirements
    .filter((r) => r.status === 'confirmed')
    .map((requirement) => {
      const evidence = findRequirementEvidence(requirement.text, documentText, options);
      const state: CoverageState =
        evidence.terms.length === 0
          ? 'not-checkable'
          : evidence.excerpts.length > 0
            ? 'evidence'
            : 'none';
      return { requirement, state, ...evidence };
    });
  return {
    rows,
    confirmedCount: rows.length,
    withEvidenceCount: rows.filter((r) => r.state === 'evidence').length,
    withoutEvidenceCount: rows.filter((r) => r.state === 'none').length,
    notCheckableCount: rows.filter((r) => r.state === 'not-checkable').length,
  };
}

/**
 * The summary as one sentence with its denominator visible, for example
 * "7 of 11 confirmed requirements have evidence in your resume."
 */
export function describeCoverage(summary: CoverageSummary, documentName = 'your resume'): string {
  const { withEvidenceCount: found, confirmedCount: total } = summary;
  if (total === 0) return 'No confirmed requirements yet.';
  const noun = total === 1 ? 'confirmed requirement' : 'confirmed requirements';
  const verb = found === 1 ? 'has' : 'have';
  return `${found} of ${total} ${noun} ${verb} evidence in ${documentName}.`;
}
