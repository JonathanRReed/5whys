/**
 * Inputs and outputs for the six tasks. Plain data in, plain data out. No
 * output field is a number: nothing here rates the student.
 */

// 1. rewriteBullet ------------------------------------------------------------

export type RewriteBulletInput = {
  /** The resume line as the student wrote it. */
  line: string;
};

export type RewriteBulletOutput = {
  /** The suggested line. Equal to the cleaned original when nothing safe could change. */
  rewrite: string;
  /** False when the suggestion is the original line, cleaned. */
  changed: boolean;
  /** What the student could add that only they know, as questions or short notes. */
  notes: string[];
};

// 2. followUpWhy --------------------------------------------------------------

export type WhyTrack = 'career' | 'interest';

export type FollowUpWhyInput = {
  track: WhyTrack;
  topic: string;
  /** Answers so far, in order. Empty strings mark unanswered layers. */
  answers: readonly string[];
};

export type FollowUpWhyOutput = {
  /** The next question, or null once every layer is answered. */
  question: string | null;
};

// 3. likelyQuestions ----------------------------------------------------------

export type LikelyQuestionsInput = {
  jobTitle?: string;
  company?: string;
  /** Requirement lines from a decoded posting, verbatim. */
  requirements: readonly string[];
};

export type LikelyQuestion = {
  question: string;
  /** The requirement line this question tests, verbatim, or null for a general question. */
  requirement: string | null;
};

export type LikelyQuestionsOutput = {
  questions: LikelyQuestion[];
};

// 4. messageVariants ----------------------------------------------------------

export type MessageVariantsInput = {
  /** The opening of the student's cover letter. */
  opener: string;
  role: string;
  company: string;
  contactName?: string;
};

export type MessageVariantsOutput = {
  /** A short connection note. */
  linkedInMessage: string;
  followUpEmail: { subject: string; body: string };
  /** What to say in the first minute of an intro call. */
  introCallOpener: string;
};

// 5. translateWording ---------------------------------------------------------

export type TranslateWordingInput = {
  /** How the student describes the work, in their own words. */
  phrase: string;
  /** Terms from the posting, if a posting is decoded. */
  postingTerms?: readonly string[];
};

export type WordingSuggestion = {
  /** A professional term for the same work. */
  term: string;
  /** True when the term is the posting's own wording. */
  fromPosting: boolean;
};

export type TranslateWordingOutput = {
  suggestions: WordingSuggestion[];
  /**
   * When to use these words honestly, for example "Use these if you planned
   * the posts yourself." Null when nothing matched.
   */
  honestUse: string | null;
};

// 6. interviewFollowUp --------------------------------------------------------

export type InterviewFollowUpInput = {
  question: string;
  answer: string;
};

export type InterviewFollowUpOutput = {
  followUp: string;
};
