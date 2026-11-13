/**
 * The set of questions for one session in the rehearsal room: an opener,
 * the questions this visitor will certainly face, the posting's own
 * questions, and a close. Pure; the room supplies the posting questions.
 */

import type { Audience } from './audience';
import { detectSkillsFromText } from './detect';
import {
  findQuestionByText,
  getQuestionById,
  type QuestionPrompt,
  questionFits,
  questionsFor,
  SALARY_QUESTION_ID,
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

/** Skills about working through other people, which a posting question often misses. */
const PEOPLE_SKILLS = ['leadership', 'teamwork'] as const;

const stem = (word: string) => word.replace(/(?:ing|ed|es|s)$/, '');
const WORD_STOP = new Set([
  'about',
  'their',
  'there',
  'what',
  'when',
  'with',
  'your',
  'tell',
  'time',
]);
const contentWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !WORD_STOP.has(w))
      .map(stem)
  );

/**
 * A behavioral bank question for a people requirement ("lead through change
 * and influence without authority"), the one sharing the most words with the
 * line, else the first one tagged with its skill.
 */
function peopleQuestionFor(
  line: { text: string; skillIds: readonly string[] },
  filter: { audience: Audience; postingSkillIds: string[] },
  taken: Set<string>
): QuestionPrompt | null {
  const lineWords = contentWords(line.text);
  const pool = [...PEOPLE_SKILLS, 'communication']
    .flatMap((id) => questionsFor(id, filter))
    .filter(
      (q, index, all) =>
        q.category === 'behavioral' &&
        all.findIndex((x) => x.id === q.id) === index &&
        !taken.has(q.text.toLowerCase())
    );
  let best: { question: QuestionPrompt; score: number } | null = null;
  for (const question of pool) {
    let score = 0;
    for (const w of contentWords(question.text)) if (lineWords.has(w)) score += 2;
    if (question.skillIds.some((id) => line.skillIds.includes(id))) score += 1;
    if (!best || score > best.score) best = { question, score };
  }
  return best && best.score > 0 ? best.question : null;
}

export interface RehearsalPlanInput {
  audience: Audience;
  /** Questions about the posting's requirements, best first. */
  fromPosting?: readonly RehearsalQuestion[];
  /**
   * The posting's requirement lines with their skills. A leadership or
   * teamwork line the posting questions leave out gets a behavioral
   * question of its own.
   */
  requirements?: readonly { text: string; skillIds: readonly string[] }[];
  /** Questions the visitor picked from their packet. Asked right after the opener. */
  chosen?: readonly RehearsalQuestion[];
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
  // What the visitor chose from their packet comes first and takes slots.
  for (const question of input.chosen ?? []) if (add(question)) filled++;

  // A people requirement the posting questions do not reach keeps a slot.
  const fromPosting = input.fromPosting ?? [];
  const reachable = fromPosting.slice(0, Math.max(0, slots - filled));
  const people: RehearsalQuestion[] = [];
  const taken = new Set(seen);
  for (const skill of PEOPLE_SKILLS) {
    if (people.length >= 2) break;
    if (reachable.some((q) => q.skillIds.includes(skill))) continue;
    if (people.some((q) => q.skillIds.includes(skill))) continue;
    const line = (input.requirements ?? []).find((r) => r.skillIds.includes(skill));
    if (!line) continue;
    const question = peopleQuestionFor(line, filter, taken);
    if (!question) continue;
    taken.add(question.text.toLowerCase());
    people.push(fromBank(question, line.text));
  }
  const postingSlots = Math.max(0, slots - filled - people.length);
  let fromLines = 0;
  for (const question of fromPosting) {
    if (fromLines >= postingSlots) break;
    if (add(question)) {
      fromLines++;
      filled++;
    }
  }
  for (const question of people) if (add(question)) filled++;

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
  for (const id of terms) add(bank(id));

  if (closing) plan.push(closing);
  return plan;
}

// ============================================================================
// Question text, packet questions, and the review of one answer
// ============================================================================

/** Words that take "a" although they start with a vowel letter. */
const A_BEFORE_VOWEL = /^(?:u[nr]i|use|usu|uti|one|once|eu|ewe|ur[aio])/i;
/** Words that take "an" although they start with a consonant letter. */
const AN_BEFORE_CONSONANT = /^(?:hour|honest|honou?r|heir)/i;

/**
 * A question built from a posting line, made to read as spoken: "a" or "an"
 * from the next word, and a pasted list after a colon left out ("build an
 * operating cadence: weekly KPI reviews, ..." becomes "build an operating
 * cadence").
 */
export function tidyQuestionText(text: string): string {
  let result = text.replace(/\s+/g, ' ').trim();
  const ending = /[?.]$/.exec(result)?.[0] ?? '';
  const colon = result.indexOf(':');
  if (colon > 0 && colon < result.length - 1) {
    const head = result.slice(0, colon).trim();
    if (head.split(' ').length >= 4) result = `${head}${ending}`;
  }
  return result.replace(
    /\b(a|an|A|An) ([A-Za-z][\w-]*)/g,
    (_match, article: string, word: string) => {
      const vowel = /^[aeiou]/i.test(word)
        ? !A_BEFORE_VOWEL.test(word)
        : AN_BEFORE_CONSONANT.test(word);
      const wanted = vowel ? 'an' : 'a';
      const cased =
        article[0] === article[0].toUpperCase()
          ? wanted[0].toUpperCase() + wanted.slice(1)
          : wanted;
      return `${cased} ${word}`;
    }
  );
}

/** How a line in the likely-questions list starts when it is a question. */
const ASKS =
  /^(?:tell|walk|describe|give|how|what|why|when|where|which|who|have|can|could|would|do|did|are|is)\b/i;

/**
 * The questions in the packet's likely-questions list: each line that asks
 * something, numbering and bullets stripped, notes ("Tests: ...") left out.
 * The text is the visitor's own (or pasted from elsewhere), so the room
 * only lists these; it asks one only when the visitor ticks it.
 */
export function packetQuestionLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw
      .replace(/^\s*(?:\d+[.)]|[-*\u2022])\s*/, '')
      .replace(/^["\u201c]|["\u201d]$/g, '')
      .trim();
    if (line.length < 8 || line.length > 300) continue;
    if (!line.endsWith('?') && !ASKS.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines;
}

/** A question the visitor picked, with the bank's notes when it is a bank question. */
export function chosenQuestion(text: string): RehearsalQuestion {
  const bank = findQuestionByText(text);
  if (bank) return fromBank(bank);
  return {
    question: text,
    requirement: null,
    skillIds: detectSkillsFromText(text).map((s) => s.skillId),
  };
}

export interface SelfCheckItem {
  id: string;
  label: string;
}

const STORY_CHECK: SelfCheckItem[] = [
  { id: 'answered', label: 'I answered the question that was asked' },
  { id: 'my-part', label: 'I said what I did, not only what the team did' },
  { id: 'result', label: 'I said what happened because of it' },
  { id: 'ending', label: 'I stopped when I was done' },
];

const CHECKS: Record<string, SelfCheckItem[]> = {
  [WORK_AUTHORIZATION_QUESTION_ID]: [
    { id: 'first', label: 'I answered yes or no first' },
    { id: 'status', label: 'I said only what my status allows, in words I have checked' },
    { id: 'fit', label: 'I came back to why I fit the job' },
  ],
  [SALARY_QUESTION_ID]: [
    { id: 'range', label: 'I gave a range, or asked for theirs first' },
    { id: 'basis', label: 'I can say what my range is based on' },
    { id: 'ending', label: 'I stopped when I was done' },
  ],
  'q-availability': [
    { id: 'plain', label: 'I said the days and hours I can count on' },
    { id: 'limits', label: 'I named what I cannot do, such as school hours' },
    { id: 'ending', label: 'I stopped when I was done' },
  ],
  'q-intro': [
    { id: 'now', label: 'I said who I am now, in a sentence or two' },
    { id: 'fits', label: 'I named one thing I have done that fits this job' },
    { id: 'why', label: 'I ended on why I want this job' },
    { id: 'ending', label: 'I stopped when I was done' },
  ],
};

const GENERAL_CHECK: SelfCheckItem[] = [
  { id: 'answered', label: 'I answered the question that was asked' },
  { id: 'specific', label: 'I named something specific about this job or employer' },
  { id: 'tied', label: 'I tied it to something I have done' },
  { id: 'ending', label: 'I stopped when I was done' },
];

/** The "check it yourself" list that fits this question. */
export function selfCheckFor(
  question: Pick<RehearsalQuestion, 'questionId'> | null
): SelfCheckItem[] {
  const id = question?.questionId;
  if (id && CHECKS[id]) return CHECKS[id];
  const bank = id ? getQuestionById(id) : undefined;
  if (bank?.category === 'general') return GENERAL_CHECK;
  return STORY_CHECK;
}

export interface AnswerNote {
  id: 'job' | 'example';
  /** True when the answer has it. */
  found: boolean;
  /** What was found, quoted from the answer, or what to try. */
  text: string;
}

const STOP_TITLE = new Set(['the', 'and', 'for', 'with', 'part', 'time', 'full', 'level', 'entry']);

/** A moment the visitor can point to: something they did, once. */
const MOMENT =
  /\b(?:once|one time|for example|for instance|last (?:week|month|year|summer|spring|fall|winter|semester|term)|this (?:summer|semester|term)|when i|after i)\b|\bi (?:\w+ed|did|made|ran|took|led|built|wrote|taught|kept|found|got|went|gave|told|had|was|caught|fixed|helped|set|sold|began|chose|brought|spoke|met)\b/i;

/**
 * Two things a reader can check in an answer, phrased as questions, never
 * scored: does it name this job, and does it hold one moment the visitor
 * can point to. Each note quotes what it found, so the rule is visible.
 */
export function answerNotes(
  text: string,
  context: { company?: string; jobTitle?: string; askAboutJob: boolean }
): AnswerNote[] {
  const answer = text.replace(/\s+/g, ' ').trim();
  if (!answer) return [];
  const notes: AnswerNote[] = [];
  const lower = answer.toLowerCase();
  if (context.askAboutJob) {
    const names = [
      context.company?.trim(),
      ...(context.jobTitle ?? '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 3 && !STOP_TITLE.has(w)),
    ].filter((w): w is string => Boolean(w));
    const found = names.find((name) =>
      new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lower)
    );
    const where = context.company?.trim() || 'the employer';
    notes.push(
      found
        ? { id: 'job', found: true, text: `It names "${found}".` }
        : {
            id: 'job',
            found: false,
            text: `Does it say why this job? It does not mention ${where} or the work yet.`,
          }
    );
  }
  const sentences = answer.split(/(?<=[.!?])\s+/);
  const moment = sentences.find((sentence) => MOMENT.test(sentence));
  notes.push(
    moment
      ? { id: 'example', found: true, text: `It has a moment you can point to: "${moment.trim()}"` }
      : {
          id: 'example',
          found: false,
          text: 'Is there one example? Try one thing you did, and what happened.',
        }
  );
  return notes;
}
