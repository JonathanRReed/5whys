/**
 * Prompt builders. Pure functions of their input, covered by snapshot tests.
 *
 * Every prompt is short, tells the model to use only facts in the input,
 * forbids rating, and asks for plain sentence case without em dashes. A retry
 * after a rejected answer adds one stricter paragraph naming what was wrong.
 */
import type {
  FollowUpWhyInput,
  InterviewFollowUpInput,
  LikelyQuestionsInput,
  MessageVariantsInput,
  RewriteBulletInput,
  TranslateWordingInput,
} from './task-types';
import type { ModelPrompt } from './types';

/** What the previous attempt got wrong. Present only on the retry. */
export type PromptRetry = {
  /** Claims the guard rejected, quoted back to the model. Empty for a format problem. */
  claims: readonly string[];
};

/** Most likely-questions a prompt asks for; the rules tier uses the same cap. */
export const LIKELY_QUESTION_LIMIT = 8;
const MAX_FIELD = 1200;
const MAX_REQUIREMENTS = 20;

const BASE_RULES = [
  'You help a student with their own career writing.',
  'Use only facts that are in the input. Do not add numbers, dates, names, employers, tools, or results.',
  'Never rate, score, or grade the student or their writing.',
  'Write in plain sentence case. Do not use em dashes or exclamation marks.',
].join(' ');

function clip(value: string | undefined, max = MAX_FIELD): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

function system(task: string, retry?: PromptRetry): string {
  const parts = [BASE_RULES, task];
  if (retry) {
    const named = retry.claims.length
      ? ` It added things that are not in the input: ${retry.claims.join(', ')}. Leave them out.`
      : '';
    parts.push(
      `Your last answer broke these rules.${named} Use only words and facts from the input, and follow the reply format exactly.`
    );
  }
  return parts.join('\n\n');
}

// 1. rewriteBullet ------------------------------------------------------------

export function buildRewriteBulletPrompt(
  input: RewriteBulletInput,
  retry?: PromptRetry
): ModelPrompt {
  return {
    system: system(
      "Rewrite one resume line so it starts with a clear action verb and reads cleanly. Keep the student's level of ownership: if they helped, the line says they helped. Reply with only the rewritten line.",
      retry
    ),
    user: `Resume line: ${clip(input.line)}`,
  };
}

// 2. followUpWhy --------------------------------------------------------------

export function buildFollowUpWhyPrompt(input: FollowUpWhyInput, retry?: PromptRetry): ModelPrompt {
  const situation =
    input.track === 'career'
      ? 'The student has a target path in mind and is testing the reason.'
      : 'The student is exploring an interest and has no target job yet.';
  const answers = input.answers
    .map((answer) => clip(answer, 400))
    .filter(Boolean)
    .map((answer, index) => `${index + 1}. ${answer}`);
  return {
    system: system(
      `${situation} Ask one short question that goes one level deeper into why this matters to them, built from their own words. Reply with only the question.`,
      retry
    ),
    user: [`Topic: ${clip(input.topic, 200)}`, 'Answers so far:', ...answers].join('\n'),
  };
}

// 3. likelyQuestions ----------------------------------------------------------

export const LIKELY_QUESTIONS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          requirement: { type: 'string' },
        },
        required: ['question', 'requirement'],
      },
    },
  },
  required: ['questions'],
};

export function buildLikelyQuestionsPrompt(
  input: LikelyQuestionsInput,
  retry?: PromptRetry
): ModelPrompt {
  const where = [clip(input.jobTitle, 120) || 'this role', clip(input.company, 120)]
    .filter(Boolean)
    .join(' at ');
  const requirements = input.requirements
    .map((line) => clip(line, 300))
    .filter(Boolean)
    .slice(0, MAX_REQUIREMENTS)
    .map((line) => `- ${line}`);
  return {
    system: system(
      `List up to ${LIKELY_QUESTION_LIMIT} questions an interviewer for this role is likely to ask. Each question tests one requirement; copy that requirement exactly as written. Reply as JSON: {"questions":[{"question":"...","requirement":"..."}]}`,
      retry
    ),
    user: [`Role: ${where}`, 'Requirements:', ...requirements].join('\n'),
  };
}

// 4. messageVariants ----------------------------------------------------------

export const MESSAGE_VARIANTS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    linkedInMessage: { type: 'string' },
    followUpEmail: {
      type: 'object',
      properties: { subject: { type: 'string' }, body: { type: 'string' } },
      required: ['subject', 'body'],
    },
    introCallOpener: { type: 'string' },
  },
  required: ['linkedInMessage', 'followUpEmail', 'introCallOpener'],
};

export function buildMessageVariantsPrompt(
  input: MessageVariantsInput,
  retry?: PromptRetry
): ModelPrompt {
  const lines = [
    `Cover letter opener: ${clip(input.opener)}`,
    `Role: ${clip(input.role, 120)}`,
    `Company: ${clip(input.company, 120)}`,
  ];
  const contact = clip(input.contactName, 80);
  lines.push(
    contact ? `Contact name: ${contact}` : 'Contact name: unknown, greet them without a name'
  );
  return {
    system: system(
      'From the cover letter opener, write three short messages in the student\'s own voice: a LinkedIn connection note under 300 characters, a follow-up email with a subject line, and what to say in the first minute of an intro call. Reply as JSON: {"linkedInMessage":"...","followUpEmail":{"subject":"...","body":"..."},"introCallOpener":"..."}',
      retry
    ),
    user: lines.join('\n'),
  };
}

// 5. translateWording ---------------------------------------------------------

export const TRANSLATE_WORDING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    terms: { type: 'array', items: { type: 'string' } },
    honestUse: { type: 'string' },
  },
  required: ['terms', 'honestUse'],
};

export function buildTranslateWordingPrompt(
  input: TranslateWordingInput,
  retry?: PromptRetry
): ModelPrompt {
  const terms = (input.postingTerms ?? [])
    .map((term) => clip(term, 80))
    .filter(Boolean)
    .slice(0, 30);
  const lines = [`What the student did: ${clip(input.phrase, 400)}`];
  if (terms.length) lines.push(`Terms from the posting: ${terms.join(', ')}`);
  return {
    system: system(
      'Suggest short professional terms for the same work the student describes. Name only work they say they did and never a bigger role than theirs. Do not name software or tools. When a posting term describes the same work, use it. Reply as JSON: {"terms":["..."],"honestUse":"one sentence on when these words are honest to use"}',
      retry
    ),
    user: lines.join('\n'),
  };
}

// 6. interviewFollowUp --------------------------------------------------------

export function buildInterviewFollowUpPrompt(
  input: InterviewFollowUpInput,
  retry?: PromptRetry
): ModelPrompt {
  return {
    system: system(
      "You are a friendly interviewer. Ask one follow-up question about the student's answer, the way a real interviewer would. Do not give feedback. Reply with only the question.",
      retry
    ),
    user: [`Question: ${clip(input.question, 300)}`, `Answer: ${clip(input.answer)}`].join('\n'),
  };
}
