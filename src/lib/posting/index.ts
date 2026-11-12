/**
 * Posting engine: section-aware parsing of a pasted job posting, source spans,
 * an editable requirement list, alias-aware evidence matching, coverage
 * counts, and vague-phrase questions. Pure functions, no network, no DOM.
 */

export {
  type CoverageRow,
  type CoverageState,
  type CoverageSummary,
  describeCoverage,
  summarizeCoverage,
} from './coverage';
export {
  extractRequirementLines,
  type JdExtractionResult,
  MAX_REQUIREMENT_LINES,
} from './lines';
export {
  type EvidenceExcerpt,
  extractRequirementTerms,
  findRequirementEvidence,
  findTermMatches,
  type RequirementEvidence,
  type RequirementTerm,
  type TermMatch,
  type TermOptions,
  type TermSource,
} from './match';
export {
  type ParsedPosting,
  type ParseOptions,
  type PostingHeading,
  parsePosting,
  type SetAsideLine,
  type SetAsideReason,
  sliceSpan,
} from './parse';
export {
  type AddRequirementOptions,
  addRequirement,
  bulletsFromRequirements,
  bulletToRequirement,
  carryOverDecisions,
  confirmAllSuggested,
  confirmedRequirements,
  confirmRequirement,
  countBySection,
  decodePostingToBullets,
  dismissRequirement,
  editRequirementText,
  removeRequirement,
  requirementsFromBullets,
  requirementToBullet,
  restoreRequirement,
  type SectionCounts,
  setRequirementSection,
} from './requirements';
export { SAMPLE_POSTING, SAMPLE_POSTING_COMPANY, SAMPLE_POSTING_TITLE } from './sample';
export {
  decideSection,
  findCues,
  type HeadingMeaning,
  headingMeaning,
  type LineCues,
  type SectionContext,
} from './sections';
export { GENERIC_TERMS } from './terms';
export {
  type ClassificationBasis,
  isPostingSection,
  isSourceSpan,
  type OccupationLookup,
  type OccupationMatch,
  POSTING_SECTIONS,
  type PostingRequirement,
  type PostingSection,
  type RequirementOrigin,
  type RequirementStatus,
  type SectionClassification,
  type SourceSpan,
} from './types';
export {
  findVaguePhrases,
  VAGUE_PHRASES,
  type VaguePhrase,
  type VaguePhraseHit,
} from './vague-phrases';
