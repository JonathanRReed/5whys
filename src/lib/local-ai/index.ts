/**
 * The local AI layer. Six tasks, three tiers, no network request.
 *
 * Call a task from a click. It picks a ready model at that moment, or answers
 * from the rules, and never throws. Every result says which tier wrote it and
 * lists any claim the student did not make.
 */

export type { DownloadBrowserModelOptions } from './browser-model';
export {
  BROWSER_MODEL_OPTIONS,
  createBrowserModelProvider,
  downloadBrowserModel,
  getBrowserModelCapability,
} from './browser-model';
export type { ClaimCheckOptions } from './guards';
export { findInventedClaims } from './guards';
export type { PromptRetry } from './prompts';
export {
  buildFollowUpWhyPrompt,
  buildInterviewFollowUpPrompt,
  buildLikelyQuestionsPrompt,
  buildMessageVariantsPrompt,
  buildRewriteBulletPrompt,
  buildTranslateWordingPrompt,
} from './prompts';
export { createProviderRegistry, getDefaultRegistry, registerHostedProvider } from './registry';
export { GENERIC_PROBES } from './rules';
export { DEFAULT_TIMEOUT_MS } from './runner';
export type {
  FollowUpWhyInput,
  FollowUpWhyOutput,
  InterviewFollowUpInput,
  InterviewFollowUpOutput,
  LikelyQuestion,
  LikelyQuestionsInput,
  LikelyQuestionsOutput,
  MessageVariantsInput,
  MessageVariantsOutput,
  RewriteBulletInput,
  RewriteBulletOutput,
  TranslateWordingInput,
  TranslateWordingOutput,
  WhyTrack,
  WordingSuggestion,
} from './task-types';
export {
  followUpWhy,
  interviewFollowUp,
  likelyQuestions,
  messageVariants,
  rewriteBullet,
  translateWording,
} from './tasks';
export type {
  AiResult,
  AiSource,
  BrowserModelCapability,
  BrowserModelState,
  ClaimKind,
  FallbackReason,
  GenerateOptions,
  HostedModelProvider,
  InventedClaim,
  ModelPrompt,
  ModelSource,
  ProviderRegistry,
  TaskOptions,
  TextGenerationProvider,
} from './types';
export { WORDING_DICTIONARY, type WordingEntry } from './wording-dictionary';
