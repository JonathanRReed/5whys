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
  visible: number;
  hidden: number;
  /** Measure-like numbers inside the scored bullets (years and phones excluded). */
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
  impactCoverage?: number;
  keywordDensity?: KeywordDensityItem[];
  benchmarkScore?: number;
  uniqueVerbCount?: number;
  quantifiedBulletPercent?: number;
  avgBulletLength?: number;
  passiveVoicePercent?: number;
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
  bullets: BulletRecord[];
  selectedBulletId: string | null;
  lastAnalyzedAt: string | null;
  signalReport: SignalReport;
};
