export type BulletFields = { verb: string; task: string; impact: string; quantifier: string };

export type SignalReport = { visible: number; hidden: number; numbers: number; verbs: number };

export type BulletRecord = {
  id: string;
  original: string;
  fields: BulletFields;
  baselineScore: number;
  improved: string;
  improvedScore: number;
};

export type StoredResumeSession = {
  resumeText: string;
  bullets: BulletRecord[];
  selectedBulletId: string | null;
  lastAnalyzedAt: string | null;
  signalReport: SignalReport;
};
