/**
 * The set of questions for one session in the rehearsal room: an opener,
 * the questions this visitor will certainly face, the posting's own
 * questions, and a close. Pure; the room supplies the posting questions.
 */

import type { Audience } from './audience';
import {
  getQuestionById,
  type QuestionPrompt,
  questionFits,
  questionsFor,
  TERMS_QUESTION_IDS,
  WORK_AUTHORIZATION_QUESTION_ID,
} from './questions';
import { SKILL_MAP } from './skills';

export interface RehearsalQuestion {
  question: string;
  /** The posting line it tests, verbatim, or null for a general question. */
  requirement: string | null;
  /** Skills it tests, for matching the visitor's stories. */
  skillIds: string[];
  /** The bank question, when it came from the bank. */
  questionId?: string;
  /** What a strong answer shows. */
  strongAnswer?: string;
  /** One common mistake. */
  commonMistake?: string;
}

const REHEARSAL_OPENER_ID = 'q-intro';

/** Asked of every career changer: the change itself, leaving the last job, and the time since. */
export const CAREER_CHANGER_MUST_ASK = ['q-chg-why-change', 'q-chg-left-last-job', 'q-chg-gap'];

/** Bank questions that fill a session when the posting gives too few, by audience. */
const STAPLES: Record<Audience, string[]> = {
  student: [
    'q-stu-class-project',
    'q-stu-parttime',
    'q-stu-club',
    'q-team-difficult',
    'q-own-initiative',
    'q-adapt-learn',
    'q-stu-feedback',
    'q-stu-overwhelmed',
  ],
  'early-career': [
    'q-stu-internship',
    'q-own-initiative',
    'q-team-difficult',
    'q-adapt-learn',
    'q-time-priority',
    'q-own-failure',
    'q-comm-feedback',
  ],
  experienced: [
    'q-exp-manage-people',
    'q-exp-process',
    'q-exp-hard-call',
    'q-exp-peer-conflict',
    'q-exp-missed-target',
    'q-exp-mistake',
    'q-exp-numbers',
  ],
  'career-changer': [
    'q-chg-transfer',
    'q-chg-proud',
    'q-chg-learned-system',
    'q-exp-process',
    'q-exp-hard-customer',
    'q-chg-new-domain',
    'q-chg-why-you',
  ],
};

function fromBank(question: QuestionPrompt, requirement: string | null = null): RehearsalQuestion {
  return {
    question: question.text,
    requirement,
    skillIds: question.skillIds.filter((id) => id !== 'general'),
    questionId: question.id,
    strongAnswer: question.strongAnswer,
    commonMistake: question.commonMistake,
  };
}

export interface RehearsalPlanInput {
  audience: Audience;
  /** Questions about the posting's requirements, best first. */
  fromPosting?: readonly RehearsalQuestion[];
  /** Skills the posting names, so technical questions are offered only when asked for. */
  postingSkillIds?: Iterable<string>;
  /**
   * The posting's line about work authorization or sponsorship, verbatim.
   * When there is one, the room asks the sponsorship question and shows it.
   */
  workAuthorizationLine?: string | null;
  /** Questions about the terms of the job the visitor chose to add. */
  extras?: readonly string[];
}

/**
 * Every session opens with "Tell me about yourself". A career changer is
 * always asked why they are changing fields, about leaving the last job, and
 * about the time since. Then come the posting's questions, topped up from
 * the bank when the posting gives too few, and for everyone but a career
 * changer (whose "why change" covers it) a closing "why this role".
 */
export function planRehearsal(input: RehearsalPlanInput): RehearsalQuestion[] {
  const { audience } = input;
  const postingSkillIds = [...(input.postingSkillIds ?? [])];
  const filter = { audience, postingSkillIds };
  const plan: RehearsalQuestion[] = [];
  const seen = new Set<string>();
  const add = (question: RehearsalQuestion | null | undefined) => {
    if (!question) return false;
    const key = question.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    plan.push(question);
    return true;
  };
  const bank = (id: string) => {
    const question = getQuestionById(id);
    return question ? fromBank(question) : null;
  };

  const changer = audience === 'career-changer';
  const closing = changer ? null : bank('q-why-role');
  if (closing) seen.add(closing.question.toLowerCase());

  add(bank(REHEARSAL_OPENER_ID));
  if (changer) for (const id of CAREER_CHANGER_MUST_ASK) add(bank(id));

  const slots = changer ? 5 : 6;
  let filled = 0;
  for (const question of input.fromPosting ?? []) {
    if (filled >= slots) break;
    if (add(question)) filled++;
  }

  // Top up from the bank: first questions on the soft skills the posting
  // names, then this audience's staples.
  const softSkills = postingSkillIds.filter((id) => SKILL_MAP.get(id)?.category === 'soft');
  const candidates: QuestionPrompt[] = [
    ...softSkills.flatMap((id) => questionsFor(id, filter)),
    ...STAPLES[audience]
      .map((id) => getQuestionById(id))
      .filter((q): q is QuestionPrompt => Boolean(q && questionFits(q, filter))),
  ].filter((q) => q.category !== 'general' || STAPLES[audience].includes(q.id));
  for (const question of candidates) {
    if (filled >= slots) break;
    if (add(fromBank(question))) filled++;
  }

  // Terms of the job come after the stories and before the close: the
  // sponsorship question when the posting raises it, then any the visitor
  // added.
  const terms = new Set(input.extras ?? []);
  if (input.workAuthorizationLine) {
    const question = getQuestionById(WORK_AUTHORIZATION_QUESTION_ID);
    if (question) add(fromBank(question, input.workAuthorizationLine));
    terms.delete(WORK_AUTHORIZATION_QUESTION_ID);
  }
  for (const id of TERMS_QUESTION_IDS) if (terms.has(id)) add(bank(id));

  if (closing) plan.push(closing);
  return plan;
}
