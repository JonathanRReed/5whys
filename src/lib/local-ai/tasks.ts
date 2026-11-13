/**
 * The six tasks. Each takes plain input, returns typed output with the tier
 * that produced it, and never throws.
 */
import { AUDIENCES, type Audience } from '../glowup-banks/audience';
import { normalizeLine } from '../resume-game/text';
import { cleanModelText, firstLine, QUESTION_CLAIM_KINDS } from './guards';
import {
  buildFollowUpWhyPrompt,
  buildInterviewFollowUpPrompt,
  buildLikelyQuestionsPrompt,
  buildMessageVariantsPrompt,
  buildRewriteBulletPrompt,
  buildTranslateWordingPrompt,
  LIKELY_QUESTION_LIMIT,
  LIKELY_QUESTIONS_SCHEMA,
  MESSAGE_VARIANTS_SCHEMA,
  TRANSLATE_WORDING_SCHEMA,
} from './prompts';
import {
  bulletNotes,
  followUpWhyRules,
  interviewFollowUpRules,
  likelyQuestionsRules,
  messageVariantsRules,
  nextWhyIndex,
  rewriteBulletRules,
  translateWordingRules,
  usablePostingTerms,
} from './rules';
import { parseJsonObject, runTask } from './runner';
import type {
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
  WordingSuggestion,
} from './task-types';
import type { AiResult, TaskOptions } from './types';

// Inputs arrive from forms and storage; coerce so a missing field can never throw.
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter((entry) => entry.trim()) : [];

/** A single line or question a model may return, or null when it is unusable. */
function singleLine(text: string, maxLength: number): string | null {
  const line = firstLine(text);
  return line && line.length <= maxLength ? line : null;
}

// ============================================================================
// 1. rewriteBullet
// ============================================================================

/** Improve a weak resume line without adding a fact. */
export function rewriteBullet(
  input: RewriteBulletInput,
  options?: TaskOptions
): Promise<AiResult<RewriteBulletOutput>> {
  const clean: RewriteBulletInput = { line: str(input?.line) };
  const original = normalizeLine(clean.line) || clean.line.replace(/\s+/g, ' ').trim();
  return runTask<RewriteBulletOutput>(
    {
      rules: () => rewriteBulletRules(clean),
      sources: [clean.line],
      claimFields: (value) => [{ field: 'rewrite', text: value.rewrite }],
      prompt: (retry) => buildRewriteBulletPrompt(clean, retry),
      parse: (text) => {
        const rewrite = singleLine(text, Math.max(240, original.length * 2));
        if (!rewrite) return null;
        return { rewrite, changed: rewrite !== original, notes: bulletNotes(rewrite) };
      },
      rulesSuffice: !original,
    },
    options
  );
}

// ============================================================================
// 2. followUpWhy
// ============================================================================

/** The next why, built from the answers so far. Null once all five are answered. */
export function followUpWhy(
  input: FollowUpWhyInput,
  options?: TaskOptions
): Promise<AiResult<FollowUpWhyOutput>> {
  const clean: FollowUpWhyInput = {
    track: input?.track === 'interest' ? 'interest' : 'career',
    topic: str(input?.topic),
    answers: Array.isArray(input?.answers) ? input.answers.map(str) : [],
  };
  const index = nextWhyIndex(clean.answers);
  return runTask<FollowUpWhyOutput>(
    {
      rules: () => followUpWhyRules(clean),
      sources: [clean.topic, ...clean.answers],
      claimFields: (value) => (value.question ? [{ field: 'question', text: value.question }] : []),
      claimKinds: QUESTION_CLAIM_KINDS,
      prompt: (retry) =>
        buildFollowUpWhyPrompt({ ...clean, answers: clean.answers.slice(0, index) }, retry),
      parse: (text) => {
        const question = singleLine(text, 300);
        return question ? { question } : null;
      },
      // Nothing to follow up on before the first answer, or after the last.
      rulesSuffice: index <= 0,
    },
    options
  );
}

// ============================================================================
// 3. likelyQuestions
// ============================================================================

function matchRequirement(claimed: string, requirements: readonly string[]): string | null {
  const key = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, ' ')
      .trim();
  const wanted = key(claimed);
  if (!wanted) return null;
  return (
    requirements.find((req) => key(req) === wanted) ??
    requirements.find((req) => key(req).includes(wanted) || wanted.includes(key(req))) ??
    null
  );
}

/** Likely interview questions from a posting, each tied to the requirement it tests. */
export function likelyQuestions(
  input: LikelyQuestionsInput,
  options?: TaskOptions
): Promise<AiResult<LikelyQuestionsOutput>> {
  const clean: LikelyQuestionsInput = {
    jobTitle: str(input?.jobTitle),
    company: str(input?.company),
    requirements: strList(input?.requirements).map((line) => line.replace(/\s+/g, ' ').trim()),
    audience: AUDIENCES.includes(input?.audience as Audience) ? input.audience : undefined,
  };
  return runTask<LikelyQuestionsOutput>(
    {
      rules: () => likelyQuestionsRules(clean),
      sources: [clean.jobTitle ?? '', clean.company ?? '', ...clean.requirements],
      claimFields: (value) =>
        value.questions.map((q, index) => ({
          field: `questions.${index}.question`,
          text: q.question,
        })),
      claimKinds: QUESTION_CLAIM_KINDS,
      prompt: (retry) => buildLikelyQuestionsPrompt(clean, retry),
      responseSchema: LIKELY_QUESTIONS_SCHEMA,
      parse: (text) => {
        const json = parseJsonObject(text);
        if (!json || !Array.isArray(json.questions)) return null;
        const questions: LikelyQuestion[] = [];
        for (const item of json.questions) {
          if (!item || typeof item !== 'object') continue;
          const entry = item as Record<string, unknown>;
          const question = singleLine(str(entry.question), 300);
          if (!question) continue;
          questions.push({
            question,
            requirement: matchRequirement(str(entry.requirement), clean.requirements),
          });
          if (questions.length >= LIKELY_QUESTION_LIMIT) break;
        }
        return questions.length ? { questions } : null;
      },
      rulesSuffice: clean.requirements.length === 0,
    },
    options
  );
}

// ============================================================================
// 4. messageVariants
// ============================================================================

/** A LinkedIn note, a follow-up email, and an intro-call opener from a letter opener. */
export function messageVariants(
  input: MessageVariantsInput,
  options?: TaskOptions
): Promise<AiResult<MessageVariantsOutput>> {
  const clean: MessageVariantsInput = {
    opener: str(input?.opener),
    role: str(input?.role),
    company: str(input?.company),
    contactName: str(input?.contactName) || undefined,
  };
  return runTask<MessageVariantsOutput>(
    {
      rules: () => messageVariantsRules(clean),
      sources: [clean.opener, clean.role, clean.company, clean.contactName ?? ''],
      claimFields: (value) => [
        { field: 'linkedInMessage', text: value.linkedInMessage },
        { field: 'followUpEmail.subject', text: value.followUpEmail.subject },
        { field: 'followUpEmail.body', text: value.followUpEmail.body },
        { field: 'introCallOpener', text: value.introCallOpener },
      ],
      prompt: (retry) => buildMessageVariantsPrompt(clean, retry),
      responseSchema: MESSAGE_VARIANTS_SCHEMA,
      parse: (text) => {
        const json = parseJsonObject(text);
        if (!json) return null;
        const email = (json.followUpEmail ?? {}) as Record<string, unknown>;
        const linkedInMessage = cleanModelText(str(json.linkedInMessage));
        const subject = firstLine(str(email.subject));
        const body = cleanModelText(str(email.body));
        const introCallOpener = cleanModelText(str(json.introCallOpener));
        if (!linkedInMessage || !subject || !body || !introCallOpener) return null;
        return { linkedInMessage, followUpEmail: { subject, body }, introCallOpener };
      },
      rulesSuffice: !clean.opener.trim() && !clean.role.trim(),
    },
    options
  );
}

// ============================================================================
// 5. translateWording
// ============================================================================

const MAX_TERMS = 6;

/** Professional terms for work the student describes in plain words. */
export function translateWording(
  input: TranslateWordingInput,
  options?: TaskOptions
): Promise<AiResult<TranslateWordingOutput>> {
  const clean: TranslateWordingInput = {
    phrase: str(input?.phrase),
    postingTerms: strList(input?.postingTerms),
  };
  const posting = usablePostingTerms(clean.phrase, clean.postingTerms);
  const postingKeys = new Set(posting.map((term) => term.toLowerCase()));
  return runTask<TranslateWordingOutput>(
    {
      rules: () => translateWordingRules(clean),
      // A posting term naming a tool the student never mentioned is not
      // evidence they used it, so only usable posting terms count as input.
      sources: [clean.phrase, ...posting],
      claimFields: (value) =>
        value.suggestions.map((s, index) => ({ field: `suggestions.${index}.term`, text: s.term })),
      prompt: (retry) => buildTranslateWordingPrompt(clean, retry),
      responseSchema: TRANSLATE_WORDING_SCHEMA,
      parse: (text) => {
        const json = parseJsonObject(text);
        if (!json || !Array.isArray(json.terms)) return null;
        const seen = new Set<string>();
        const suggestions: WordingSuggestion[] = [];
        for (const raw of json.terms) {
          const term = firstLine(str(raw)).replace(/[.]+$/, '');
          const key = term.toLowerCase();
          if (!term || term.length > 60 || seen.has(key)) continue;
          seen.add(key);
          suggestions.push({ term, fromPosting: postingKeys.has(key) });
          if (suggestions.length >= MAX_TERMS) break;
        }
        if (!suggestions.length) return null;
        const honestUse = firstLine(str(json.honestUse)) || translateWordingRules(clean).honestUse;
        return { suggestions, honestUse };
      },
      rulesSuffice: !clean.phrase.trim(),
    },
    options
  );
}

// ============================================================================
// 6. interviewFollowUp
// ============================================================================

/** One follow-up question an interviewer might ask after the student's answer. */
export function interviewFollowUp(
  input: InterviewFollowUpInput,
  options?: TaskOptions
): Promise<AiResult<InterviewFollowUpOutput>> {
  const clean: InterviewFollowUpInput = {
    question: str(input?.question),
    answer: str(input?.answer),
  };
  return runTask<InterviewFollowUpOutput>(
    {
      rules: () => interviewFollowUpRules(clean),
      sources: [clean.question, clean.answer],
      claimFields: (value) => [{ field: 'followUp', text: value.followUp }],
      claimKinds: QUESTION_CLAIM_KINDS,
      prompt: (retry) => buildInterviewFollowUpPrompt(clean, retry),
      parse: (text) => {
        const followUp = singleLine(text, 300);
        return followUp ? { followUp } : null;
      },
      rulesSuffice: !clean.answer.trim(),
    },
    options
  );
}

/**
 * Run a task for a place that shows its result as plain text, with nowhere to
 * flag an addition. If the model's answer still names a number, a person, or
 * a tool the visitor did not write, it is thrown away and the rules answer.
 */
export async function grounded<Input, Output>(
  task: (input: Input, options?: TaskOptions) => Promise<AiResult<Output>>,
  input: Input,
  options?: TaskOptions
): Promise<AiResult<Output>> {
  const result = await task(input, options);
  if (result.inventedClaims.length === 0) return result;
  return task(input, { ...options, rulesOnly: true });
}
