export type BulletFields = { verb: string; task: string; impact: string; quantifier: string };

export type RepetitiveVerb = {
  verb: string;
  count: number;
};

export type KeywordDensityItem = {
  word: string;
  count: number;
};

export type SignalReport = {
  /** Numbers inside the scored lines that say what they count. */
  numbers: number;
  /** Bullets that open with an action verb. */
  verbs: number;
  wordCount: number;
  bulletCount: number;
  estimatedPages: number;
  sections: string[];
  hardSkills: string[];
  softSkills: string[];
  isOptimalLength: boolean;
  lengthRecommendation: string;
  /** What was scored and what was left out, in one sentence. */
  structureNote?: string;
  skippedLines?: number;
  weakWordCount?: number;
  repetitiveVerbs?: RepetitiveVerb[];
  keywordDensity?: KeywordDensityItem[];
  /*
   * Older sessions also stored composite numbers ("visible", "hidden",
   * "benchmarkScore", "impactCoverage", "uniqueVerbCount",
   * "quantifiedBulletPercent", "avgBulletLength", "passiveVoicePercent").
   * They are retired: such sessions still load, and those fields are
   * dropped on load and never shown.
   */
};

export type BulletRecord = {
  id: string;
  original: string;
  fields: BulletFields;
  /** Score of the line as written. */
  baselineScore: number;
  /** The rewritten line once a field changes; the original until then. */
  improved: string;
  improvedScore: number;
  /** True once the student has changed any field. */
  edited?: boolean;
  weakWords?: string[];
  hasImpact?: boolean;
  isRepetitiveVerb?: boolean;
};

export type StoredResumeSession = {
  resumeText: string;
  /** Persisted so restored drafts do not present older scores as current. */
  needsRescan?: boolean;
  bullets: BulletRecord[];
  selectedBulletId: string | null;
  lastAnalyzedAt: string | null;
  signalReport: SignalReport;
};
