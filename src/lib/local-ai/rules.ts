/**
 * Tier 0: every task answered from rules, with no model. Always available,
 * deterministic, and held to the same invented-claim check as model output.
 */
import { buildPrompts, ensureResponsesLength } from '../../components/career-5whys/shared';
import { LINKEDIN_NOTE_LIMIT, namesCompany, namesRole } from '../desk-checks';
import {
  type Audience,
  detectSkillsFromText,
  findQuestionByText,
  getQuestionById,
  type QuestionPrompt,
} from '../glowup-banks';
import { createBulletRecord } from '../resume-game/analysis';
import { generateBulletSuggestions } from '../resume-game/suggestions';
import { normalizeLine } from '../resume-game/text';
import { findInventedClaims, mentionsKnownTool, QUESTION_CLAIM_KINDS } from './guards';
import { LIKELY_QUESTION_LIMIT } from './prompts';
import {
  isDescriptiveLine,
  questionForRequirement,
  type RequirementKind,
  readRequirement,
} from './requirement-questions';
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
import { GENERIC_WORDS, WORDING_DICTIONARY } from './wording-dictionary';

// ============================================================================
// 1. rewriteBullet
// ============================================================================

/** Gerunds that follow "responsible for" and their past tense. */
const GERUND_PAST: Record<string, string> = {
  analyzing: 'analyzed',
  answering: 'answered',
  assisting: 'assisted',
  building: 'built',
  cleaning: 'cleaned',
  coaching: 'coached',
  collecting: 'collected',
  communicating: 'communicated',
  conducting: 'conducted',
  coordinating: 'coordinated',
  creating: 'created',
  delivering: 'delivered',
  designing: 'designed',
  developing: 'developed',
  doing: 'did',
  drafting: 'drafted',
  editing: 'edited',
  ensuring: 'ensured',
  facilitating: 'facilitated',
  fixing: 'fixed',
  giving: 'gave',
  grading: 'graded',
  greeting: 'greeted',
  handling: 'handled',
  helping: 'helped',
  holding: 'held',
  implementing: 'implemented',
  keeping: 'kept',
  leading: 'led',
  maintaining: 'maintained',
  making: 'made',
  managing: 'managed',
  meeting: 'met',
  mentoring: 'mentored',
  monitoring: 'monitored',
  operating: 'operated',
  ordering: 'ordered',
  organizing: 'organized',
  overseeing: 'oversaw',
  planning: 'planned',
  posting: 'posted',
  preparing: 'prepared',
  presenting: 'presented',
  processing: 'processed',
  producing: 'produced',
  providing: 'provided',
  reaching: 'reached',
  recording: 'recorded',
  recruiting: 'recruited',
  researching: 'researched',
  resolving: 'resolved',
  reviewing: 'reviewed',
  running: 'ran',
  scheduling: 'scheduled',
  selling: 'sold',
  sending: 'sent',
  serving: 'served',
  setting: 'set',
  stocking: 'stocked',
  supervising: 'supervised',
  supporting: 'supported',
  taking: 'took',
  teaching: 'taught',
  testing: 'tested',
  tracking: 'tracked',
  training: 'trained',
  tutoring: 'tutored',
  updating: 'updated',
  welcoming: 'welcomed',
  writing: 'wrote',
};

const HEDGE_OPENER =
  /^(?:i\s+(?:was\s+)?)?(?:responsible for|in charge of|duties included|tasked with|my (?:job|role|duties) (?:was|were|included))\s+(\w+ing)\b\s*/i;
const FIRST_PERSON_OPENER = /^i\s+(?=[a-z]+ed\b|ran\b|led\b|wrote\b|built\b|made\b|taught\b)/i;
const FILLER = /\b(?:successfully|various)\s+|,?\s*etc\.?(?=\s|$)/gi;

function capitalizeFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * What the student could still add, read from the line as it now stands.
 * The worked examples are left out: they are someone else's facts.
 */
export function bulletNotes(line: string): string[] {
  const notes = generateBulletSuggestions(createBulletRecord(line, 0)).map((s) =>
    s.fix ? `${s.message} ${s.fix}` : s.message
  );
  if (/^(?:helped|assisted|supported)\b/i.test(line)) {
    notes.unshift('Say which part was yours. Keep "helped" unless you owned it.');
  }
  return [...new Set(notes)];
}

export function rewriteBulletRules(input: RewriteBulletInput): RewriteBulletOutput {
  const cleaned = normalizeLine(input.line) || input.line.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { rewrite: '', changed: false, notes: [] };

  let rewrite = cleaned;
  const hedge = rewrite.match(HEDGE_OPENER);
  if (hedge) {
    const past = GERUND_PAST[hedge[1].toLowerCase()];
    if (past) rewrite = `${past} ${rewrite.slice(hedge[0].length)}`;
  }
  rewrite = rewrite.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  rewrite = capitalizeFirst(rewrite.replace(FIRST_PERSON_OPENER, ''));

  return { rewrite, changed: rewrite !== cleaned, notes: bulletNotes(rewrite) };
}

// ============================================================================
// 2. followUpWhy
// ============================================================================

/** Index of the next unanswered layer, or -1 when all five are answered. */
export function nextWhyIndex(answers: readonly string[]): number {
  return ensureResponsesLength([...answers]).findIndex((answer) => !answer.trim());
}

export function followUpWhyRules(input: FollowUpWhyInput): FollowUpWhyOutput {
  const answers = ensureResponsesLength([...input.answers]);
  const index = nextWhyIndex(answers);
  if (index === -1) return { question: null };
  return { question: buildPrompts(input.track, input.topic, answers)[index] };
}

// ============================================================================
// 3. likelyQuestions
// ============================================================================

/** General questions after the posting's own, by audience. A career changer is asked why they are changing. */
function generalQuestionIds(audience: Audience): string[] {
  return audience === 'career-changer'
    ? ['q-intro', 'q-chg-why-change', 'q-why-company']
    : ['q-intro', 'q-why-role', 'q-why-company'];
}

/** Kinds are taken in turn, so one posting gives a mix rather than eight duties in a row. */
const KIND_ORDER: readonly RequirementKind[] = [
  'experience',
  'task',
  'tool',
  'quality',
  'interest',
  'coursework',
];

function likelyQuestionSources(input: LikelyQuestionsInput): string[] {
  return [input.jobTitle ?? '', input.company ?? '', ...input.requirements];
}

/**
 * Questions an interviewer would ask about the posting's requirements, each
 * tied to the line it tests, then two general questions. A line that reads
 * as a location, a description of the employer, pay, or an eligibility check
 * (a degree, a licence, lifting) gets no question.
 */
export function likelyQuestionsRules(input: LikelyQuestionsInput): LikelyQuestionsOutput {
  const sources = likelyQuestionSources(input);
  const clean = (text: string) =>
    findInventedClaims(sources, text, { kinds: QUESTION_CLAIM_KINDS }).length === 0;
  const audience = input.audience ?? 'student';
  const generals = generalQuestionIds(audience)
    .filter((id) => id !== 'q-why-company' || input.company)
    .map((id) => getQuestionById(id))
    .filter((q): q is QuestionPrompt => Boolean(q) && clean(q?.text ?? ''))
    .slice(0, 2);
  const budget = Math.max(0, LIKELY_QUESTION_LIMIT - generals.length);

  const names = { company: input.company, jobTitle: input.jobTitle };
  const lines: { requirement: string; kind: RequirementKind; taken: boolean }[] = [];
  for (const raw of input.requirements) {
    const requirement = raw.replace(/\s+/g, ' ').trim();
    if (!requirement || isDescriptiveLine(requirement, names)) continue;
    const reading = readRequirement(requirement);
    if (!reading || reading.kind === 'eligibility') continue;
    lines.push({ requirement, kind: reading.kind, taken: false });
  }
  const postingSkillIds = new Set(
    lines.flatMap((line) => detectSkillsFromText(line.requirement).map((s) => s.skillId))
  );

  const used = new Set<string>(generals.map((q) => q.text));
  const questions: LikelyQuestion[] = [];
  let taskIndex = 0;
  let progress = true;
  while (questions.length < budget && progress) {
    progress = false;
    for (const kind of KIND_ORDER) {
      if (questions.length >= budget) break;
      for (const line of lines) {
        if (line.taken || line.kind !== kind) continue;
        line.taken = true;
        const found = questionForRequirement(line.requirement, {
          ...names,
          audience,
          used,
          postingSkillIds,
          taskIndex,
          accept: clean,
        });
        if (!found || used.has(found.question) || !clean(found.question)) continue;
        used.add(found.question);
        if (found.kind === 'task') taskIndex++;
        questions.push({
          question: found.question,
          requirement: line.requirement,
          skillIds: found.skillIds,
          ...(found.questionId ? { questionId: found.questionId } : {}),
          strongAnswer: found.strongAnswer,
          commonMistake: found.commonMistake,
        });
        progress = true;
        break;
      }
    }
  }
  for (const general of generals) {
    questions.push({
      question: general.text,
      requirement: null,
      skillIds: [],
      questionId: general.id,
      strongAnswer: general.strongAnswer,
      commonMistake: general.commonMistake,
    });
  }
  return { questions };
}

// ============================================================================
// 4. messageVariants
// ============================================================================

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The opener sentence that says the most about the student, ending in a period. */
function openerSentence(opener: string): string {
  const all = sentences(opener);
  const best =
    all.find((s) => !/\b(?:apply|applying|application|position)\b/i.test(s)) ?? all[0] ?? '';
  if (!best) return '';
  return /[.?]$/.test(best) ? best.replace(/!+$/, '.') : `${best.replace(/!+$/, '')}.`;
}

export function messageVariantsRules(input: MessageVariantsInput): MessageVariantsOutput {
  const role = input.role.replace(/\s+/g, ' ').trim() || 'open';
  const company = input.company.replace(/\s+/g, ' ').trim();
  const at = company ? ` at ${company}` : '';
  const contact = input.contactName?.replace(/\s+/g, ' ').trim();
  // A note with no person's name is not addressed to a team: "Hi Hiring Team"
  // reads as a form letter in a direct message.
  const greeting =
    contact && !/^(?:the\s+)?hiring (?:team|manager)$/i.test(contact) ? `Hi ${contact},` : 'Hello,';
  const line = openerSentence(input.opener);
  const withLine = (text: string) => (line ? `${text} ${line}` : text);
  // When the visitor's own line already names the role and the employer, the
  // template does not name them a second time.
  const lineHasRole = Boolean(line) && input.role.trim() !== '' && namesRole(line, input.role);
  const lineHasCompany = !company || (Boolean(line) && namesCompany(line, company));
  const named = lineHasRole && lineHasCompany;
  const roleOnly = lineHasRole && !lineHasCompany;

  // The first form that fits the note: keep the visitor's own line as long as
  // a shorter ask makes room for it, and drop it only when nothing else fits.
  const hello = `${greeting} I am applying for the ${role} role${at}.`;
  const opening = named
    ? `${greeting} ${line} I have applied.`
    : roleOnly
      ? `${greeting} ${line} I have applied to ${company}.`
      : withLine(hello);
  const fullAsk = 'Would you be open to a short conversation about the team?';
  const linkedInMessage =
    [
      `${opening} ${fullAsk}`,
      `${opening} Would you be open to a short conversation?`,
      `${opening} Could we talk for a few minutes?`,
    ].find((text) => text.length <= LINKEDIN_NOTE_LIMIT) ?? `${hello} ${fullAsk}`;

  const body = [
    greeting,
    named
      ? `I recently applied and wanted to follow up. ${line}`
      : roleOnly
        ? `I recently applied to ${company} and wanted to follow up. ${line}`
        : withLine(`I recently applied for the ${role} role${at} and wanted to follow up.`),
    'If it would help, I am glad to share more about my experience. Thank you for your time.',
  ].join('\n\n');

  const introCallOpener = named
    ? `Thank you for making time to talk. ${line} I would like to hear what the work looks like from your side.`
    : roleOnly
      ? `Thank you for making time to talk. ${line} I would like to hear what the work looks like at ${company}.`
      : `${withLine(
          `Thank you for making time to talk. I am interested in the ${role} role${at}.`
        )} I would like to hear what the work looks like from your side.`;

  // A company that ends in a period ("Supply Co.") must not end a sentence
  // with two. An ellipsis the visitor wrote is left alone.
  const onePeriod = (text: string) => text.replace(/(?<!\.)\.\.(?!\.)/g, '.');
  return {
    linkedInMessage: onePeriod(linkedInMessage),
    followUpEmail: {
      subject: `Following up on my ${role} application`,
      body: onePeriod(body),
    },
    introCallOpener: onePeriod(introCallOpener),
  };
}

// ============================================================================
// 5. translateWording
// ============================================================================

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#-]+/)
      .map((word) => word.replace(/^-+|-+$/g, ''))
      .filter((word) => word.length > 2 && !GENERIC_WORDS.has(word))
  );
}

function sharesWord(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) if (b.has(word)) return true;
  return false;
}

/**
 * Posting terms a student may honestly use. A term naming a tool is kept
 * only when the student's own phrase names it too.
 */
export function usablePostingTerms(phrase: string, postingTerms: readonly string[] = []): string[] {
  return postingTerms
    .map((term) => term.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(
      (term) => !mentionsKnownTool(term) || phrase.toLowerCase().includes(term.toLowerCase())
    );
}

const MAX_WORDING_SUGGESTIONS = 6;

export function translateWordingRules(input: TranslateWordingInput): TranslateWordingOutput {
  const phrase = input.phrase.replace(/\s+/g, ' ').trim();
  if (!phrase) return { suggestions: [], honestUse: null };
  const entries = WORDING_DICTIONARY.filter((entry) => entry.match.test(phrase)).slice(0, 2);
  const dictionaryTerms = [...new Set(entries.flatMap((entry) => entry.terms))];

  // Posting terms that name the same work: they share a meaningful word
  // with the dictionary terms or with the student's own phrase.
  const related = contentWords([phrase, ...dictionaryTerms].join(' '));
  const posting = usablePostingTerms(phrase, input.postingTerms).filter((term) =>
    sharesWord(contentWords(term), related)
  );

  const suggestions: WordingSuggestion[] = [];
  const seen = new Set<string>();
  const push = (term: string, fromPosting: boolean) => {
    const key = term.toLowerCase();
    if (seen.has(key) || suggestions.length >= MAX_WORDING_SUGGESTIONS) return;
    seen.add(key);
    suggestions.push({ term, fromPosting });
  };
  for (const term of posting) push(term, true);
  for (const term of dictionaryTerms) push(term, false);

  const honestUse = entries.length
    ? entries.map((entry) => entry.honestUse).join(' ')
    : suggestions.length
      ? "Use the posting's words only for work you actually did."
      : null;
  return { suggestions, honestUse };
}

// ============================================================================
// 6. interviewFollowUp
// ============================================================================

export const GENERIC_PROBES = {
  empty: 'Can you start with what the situation was?',
  ownership: 'What was your part specifically?',
  result: 'What happened as a result?',
  moment: 'Can you walk me through one specific moment from that?',
  difficulty: 'What was the hardest part, and what did you do about it?',
  reflection: 'What would you do differently if you did it again?',
  example: 'Can you give me one example of that?',
  next: 'What would you want to be doing a year into this role?',
} as const;

const RESULT_WORDS =
  /\b(?:result|resulted|so that|which meant|led to|meant|outcome|ended up|in the end|finally|improved|saved|grew|learned|changed|because of (?:that|this)|afterward|after that)\b/i;
const DIFFICULTY_WORDS =
  /\b(?:hard|difficult|challenge|challenging|problem|issue|stuck|mistake|conflict|disagree|disagreed|pushback|wrong|struggled|tough)\b/i;

/**
 * Questions about the person rather than a story: why this field, leaving a
 * job, the time since. "What was your part specifically?" makes no sense after
 * "We were all laid off when the store closed."
 */
const ABOUT_THE_PERSON =
  /^(?:why\b|what (?:draws|interests|made|are your|is your|do you expect|have you been doing|are you most proud)|where do you see|tell me about yourself|walk me through your resume|tell me about leaving|how do (?:we|you) know|this role (?:is|may)|you (?:may|don't)|other candidates)/i;

const SHORT_ANSWER_WORDS = 25;

export function interviewFollowUpRules(input: InterviewFollowUpInput): InterviewFollowUpOutput {
  const answer = input.answer.replace(/\s+/g, ' ').trim();
  if (!answer) return { followUp: GENERIC_PROBES.empty };
  const short = answer.split(' ').length < SHORT_ANSWER_WORDS;

  const bank = findQuestionByText(input.question);
  if (bank?.followUps?.length) {
    // A short answer is asked for more first; a full one gets the next question in.
    return { followUp: short ? bank.followUps[0] : (bank.followUps[1] ?? bank.followUps[0]) };
  }
  if (ABOUT_THE_PERSON.test(input.question.trim())) {
    return { followUp: short ? GENERIC_PROBES.example : GENERIC_PROBES.next };
  }

  const iCount = (answer.match(/\bI\b|\bI'm\b|\bI've\b|\bmy\b|\bme\b/g) ?? []).length;
  const weCount = (answer.match(/\b(?:we|our|us|the team)\b/gi) ?? []).length;
  if (iCount === 0 || weCount > iCount) return { followUp: GENERIC_PROBES.ownership };
  if (!RESULT_WORDS.test(answer)) return { followUp: GENERIC_PROBES.result };
  if (short) return { followUp: GENERIC_PROBES.moment };
  if (!DIFFICULTY_WORDS.test(answer)) return { followUp: GENERIC_PROBES.difficulty };
  return { followUp: GENERIC_PROBES.reflection };
}
