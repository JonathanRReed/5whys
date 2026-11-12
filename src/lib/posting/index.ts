/**
 * Posting engine: section-aware parsing of a pasted job posting, source spans,
 * an editable requirement list, alias-aware evidence matching, coverage
 * counts, and vague-phrase questions. Pure functions, no network, no DOM.
 */

export { type ConditionKind, type HiringCondition, hiringCondition } from './conditions';
export {
  type CoverageRow,
  type CoverageState,
  type CoverageSummary,
  describeCoverage,
  describeParts,
  summarizeCoverage,
} from './coverage';
export {
  analyzeRequirement,
  type EvidenceOptions,
  type EvidenceState,
  findRequirementEvidence,
  parseYears,
  type RequirementAnalysis,
  type RequirementAsk,
  type RequirementEvidence,
  type RequirementKind,
  type RequirementPart,
  type YearsAsk,
} from './evidence';
export {
  extractRequirementLines,
  type JdExtractionResult,
  MAX_REQUIREMENT_LINES,
} from './lines';
export {
  type EvidenceExcerpt,
  extractRequirementTerms,
  findTermMatches,
  type RequirementTerm,
  type TermMatch,
  type TermOptions,
  type TermShape,
  type TermSource,
} from './match';
export { findNearMisses, type NearMiss, type NearMissOptions } from './near-miss';
export {
  descriptionReason,
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
  confirmsByDefault,
  countBySection,
  decodePostingToBullets,
  dismissRequirement,
  editRequirementText,
  removeRequirement,
  requirementIdMap,
  requirementsFromBullets,
  requirementToBullet,
  restoreRequirement,
  type SectionCounts,
  setRequirementSection,
} from './requirements';
export {
  type DocumentLine,
  type DocumentLineKind,
  readDocument,
} from './resume-lines';
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
export { WORK_SYNONYM_GROUPS, type WorkSynonymGroup } from './work-synonyms';
