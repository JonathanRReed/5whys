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
  numbers: number;
  verbs: number;
  wordCount: number;
  bulletCount: number;
  estimatedPages: number;
  sections: string[];
  hardSkills: string[];
  softSkills: string[];
  isOptimalLength: boolean;
  lengthRecommendation: string;
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
  baselineScore: number;
  improved: string;
  improvedScore: number;
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
