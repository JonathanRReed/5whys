/**
 * Questions an interviewer would actually ask about one requirement, by
 * what kind of requirement it is. Pure functions, no model.
 *
 * The rehearsal room once turned an address line into "Tell me about a time
 * you showed this: "Northgate Logistics Partners, Columbus, OH"". So a line
 * is questioned only when it names a skill, a tool, a task, or a quality,
 * and never when it reads as a location, a description of the employer, or
 * pay and logistics.
 */

import {
  type Audience,
  detectSkillsFromText,
  getQuestionsForSkill,
  type QuestionPrompt,
  questionFits,
  SKILL_MAP,
} from '../glowup-banks';
import { mentionsKnownTool } from './guards';

export type RequirementKind =
  /** Degrees, certificates, licences, availability, lifting: checked, not interviewed. */
  | 'eligibility'
  /** A named tool or system: Excel, a warehouse management system. */
  | 'tool'
  /** Years or background in a field. */
  | 'experience'
  /** Something the job does: "Coordinate shipment schedules". */
  | 'task'
  /** A quality or ability: "Strong communication skills". */
  | 'quality'
  /** An interest the employer hopes for: "An interest in food access". */
  | 'interest'
  /** Coursework in a subject. */
  | 'coursework';

export interface RequirementQuestion {
  question: string;
  kind: Exclude<RequirementKind, 'eligibility'>;
  skillIds: string[];
  /** The bank question used, when one was. */
  questionId?: string;
  strongAnswer: string;
  commonMistake: string;
}

export interface RequirementQuestionContext {
  audience?: Audience;
  company?: string;
  jobTitle?: string;
  /** Question texts already chosen. */
  used?: ReadonlySet<string>;
  /** Skills the whole posting names, for gating technical bank questions. */
  postingSkillIds?: Iterable<string>;
  /** How many task questions came before, so the two task patterns alternate. */
  taskIndex?: number;
  /** Extra check on bank question text (the invented-claim guard). */
  accept?: (text: string) => boolean;
}

// ============================================================================
// Lines that are not requirements
// ============================================================================

const STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
/** "Columbus, OH (hybrid", "Austin, TX | Remote": a city and state, then the end of the place. */
const CITY_STATE = new RegExp(
  `\\b[A-Z][a-zA-Z.]+(?:\\s[A-Z][a-zA-Z.]+)*,\\s*(?:${STATES})\\b(?=\\s*(?:$|\\(|\\||·|-|–|,|\\d|USA\\b|US\\b))`
);
const WORKPLACE = /\b(?:remote|hybrid|on[- ]?site|in[- ]office)\b/i;
const EMPLOYER_IS =
  /\b(?:is|are)\s+(?:an?|the)\s+(?:[\w-]+\s+){0,5}(?:company|provider|firm|organization|organisation|agency|nonprofit|non-profit|business|brand|retailer|leader|employer|startup|group|network|platform|chain|operator|manufacturer|distributor|school|district|department|hospital|bank)\b/i;
const DESCRIBES =
  /^(?:we|we're|we are|our|this is|this role|the ideal|you will be|you'll be|join\b|about\b|looking for\b|as\s+(?:an?\s+|the\s+|our\s+)?\w+(?:\s+\w+)?\s+(?:you|we)\b)/i;
/** Pay, perks, and how to apply. Each pattern is narrow so a real duty is not caught. */
const LOGISTICS: RegExp[] = [
  /\$\s?\d/,
  /\bper (?:hour|year|month|week)\b/i,
  /\b(?:salary|compensation|wages?|401\(?k\)?|pto|stipend|equal opportunity|we offer|start date)\b/i,
  /\b(?:annual|signing|sign-on|performance)\s+bonus\b|\bbonus (?:up to|of|eligible|potential)\b/i,
  /\b(?:full|medical|dental|health|great|competitive|our)\s+benefits\b|\bbenefits (?:include|package)\b/i,
  /\bapply (?:now|today|online|by|at|here)\b|\bto apply\b|\bapplication (?:deadline|process)\b/i,
];
const SHORT_JOB_DETAIL = /\b(?:full[- ]time|part[- ]time|paid|unpaid|seasonal|temporary)\b/i;
const VAGUE_ONLY = /\bother duties\b|\bas assigned\b|\bas needed\.?$/i;

function startsWithName(line: string, name?: string): boolean {
  if (!name) return false;
  const first = name.trim().split(/\s+/)[0];
  return Boolean(
    first && first.length > 2 && line.trim().toLowerCase().startsWith(first.toLowerCase())
  );
}

/**
 * True when a line reads as a location, a description of the employer or
 * the role, pay or other logistics, or a vague filler. Such a line never
 * becomes a question, whatever section it was sorted into.
 */
export function isDescriptiveLine(
  line: string,
  context: { company?: string; jobTitle?: string } = {}
): boolean {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return true;
  if (CITY_STATE.test(text)) return true;
  if (/\([^)]*\b(?:remote|hybrid|on[- ]?site|travel)\b[^)]*\)/i.test(text)) return true;
  if (WORKPLACE.test(text) && text.split(' ').length <= 8) return true;
  if (EMPLOYER_IS.test(text)) return true;
  if (DESCRIBES.test(text)) return true;
  if (LOGISTICS.some((pattern) => pattern.test(text))) return true;
  if (SHORT_JOB_DETAIL.test(text) && text.split(' ').length <= 6) return true;
  if (VAGUE_ONLY.test(text)) return true;
  if (startsWithName(text, context.company) && !TASK_VERBS.has(firstWord(text))) return true;
  const title = context.jobTitle?.trim().toLowerCase();
  if (title && title.split(' ').length > 1 && text.toLowerCase().includes(title)) return true;
  return false;
}

// ============================================================================
// Kinds
// ============================================================================

const ELIGIBILITY =
  /\b(?:degree|bachelor'?s?|associate'?s|master'?s|diploma|ged|high school|certificat\w*|certified|licen[cs]e[ds]?|belt|clearance|authori[sz]ed to work|work authori[sz]ation|sponsorship|citizen\w*|enrolled|lift(?:ing)? (?:up to )?\d+|pounds|lbs|background check|drug|travel|driver'?s|valid|bilingual|fluent|fluency|language skills|weekends?|evenings?|overnight|saturdays?|sundays?|mornings|years of age|18 or older|transportation to)\b/i;

const TASK_VERBS = new Set([
  'act',
  'analyze',
  'answer',
  'assist',
  'audit',
  'build',
  'coach',
  'collaborate',
  'communicate',
  'compile',
  'conduct',
  'confirm',
  'coordinate',
  'count',
  'create',
  'deliver',
  'design',
  'develop',
  'document',
  'draft',
  'drive',
  'enter',
  'ensure',
  'execute',
  'facilitate',
  'file',
  'flag',
  'follow',
  'greet',
  'handle',
  'help',
  'implement',
  'improve',
  'lead',
  'load',
  'maintain',
  'manage',
  'monitor',
  'onboard',
  'order',
  'organize',
  'oversee',
  'own',
  'participate',
  'partner',
  'plan',
  'post',
  'prepare',
  'present',
  'process',
  'provide',
  'reconcile',
  'recruit',
  'report',
  'research',
  'resolve',
  'respond',
  'review',
  'run',
  'schedule',
  'serve',
  'set',
  'share',
  'ship',
  'stock',
  'supervise',
  'support',
  'test',
  'track',
  'train',
  'update',
  'write',
]);

const QUALITY_OPENER =
  /^(?:(?:strong|excellent|clear|good|solid|proven|demonstrated|exceptional|effective|great)\s+|(?:the\s+)?(?:ability|able|willingness|willing|comfort|comfortable|capacity) (?:to|with)\b|comfort(?:able)?\s+\w+ing\b|(?:highly\s+)?(?:organized|detail[- ]oriented|motivated|reliable|dependable)\b)/i;

const TOOL_WORDS =
  /\b(?:system|systems|software|tool|tools|platform|platforms|application|applications|suite)\b/i;

function firstWord(text: string): string {
  return (text.match(/^[a-z]+/i)?.[0] ?? '').toLowerCase();
}

/** The line with bullets, "You will", and trailing punctuation removed. */
function bare(line: string): string {
  return line
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*•·–]\s*/, '')
    .replace(/^(?:you will|you'll|will|responsible for)\s+/i, '')
    .replace(/[.;:]+$/, '')
    .trim();
}

function withoutParentheses(text: string): string {
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "a, b, or related field" -> "a or b"; "Smartsheet, MS Project, or similar tools" -> "Smartsheet or MS Project". */
function tidyList(phrase: string): string {
  const trimmed = phrase
    .replace(
      /,?\s+(?:or|and)\s+(?:an?\s+)?(?:similar|related|equivalent|comparable|another)\b.*$/i,
      ''
    )
    .replace(/,?\s+or equivalent.*$/i, '')
    .replace(/,\s*$/, '')
    .trim();
  const items = trimmed
    .split(/\s*,\s*(?:(?:and|or)\s+)?|\s+or\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length <= 1) return trimmed;
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

/** Cut a phrase at the point where it stops naming the thing and starts explaining it. */
function headPhrase(phrase: string): string {
  return withoutParentheses(phrase)
    .split(
      /\s*(?:;|,\s*(?:including|especially|such as|like|e\.g\.|in a |in an |from )|\s+such as\s+|\s+including\s+|\s+for (?:\w+ing)\b)/i
    )[0]
    .trim();
}

const TOOL_LEAD =
  /^(?:(?:advanced|strong|solid|working|basic|intermediate|expert|hands-on|demonstrated|proven)\s+)*(?:experience|familiarity|proficiency|knowledge|skill|skills|comfort|expertise)\s+(?:with|in|using|of)\s+(.+)$/i;
const TOOL_LEAD_ADJ =
  /^(?:familiar|proficient|comfortable|skilled|fluent|experienced)\s+(?:with|in|using)\s+(.+)$/i;
const SKILLS_TAIL =
  /^(?:(?:advanced|strong|solid|working|basic|intermediate|expert)\s+)?(.+?)\s+(?:skills|proficiency|experience|knowledge)$/i;
const YEARS =
  /^(?:at least\s+|minimum (?:of\s+)?)?\d+\s*(?:\+|-\s*\d+|to\s+\d+)?\s*(?:or more\s+)?years?(?:'|\s+of)?\s+(?:(?:professional|relevant|related|hands-on|proven)\s+)?(?:experience\s+)?(?:(in|with)\s+)?(.+)$/i;

/**
 * Whether a phrase names a tool or system. `atStart` says the phrase opens the
 * sentence, so a capital letter on its first word proves nothing.
 */
function namesTool(phrase: string, atStart = false): boolean {
  if (TOOL_WORDS.test(phrase) || mentionsKnownTool(phrase)) return true;
  // A product name or acronym: "Canva", "Smartsheet", "EDI".
  const rest = atStart ? phrase.replace(/^\S+\s*/, '') : phrase;
  if (/\b[A-Z]/.test(rest)) return true;
  return detectSkillsFromText(phrase).some(({ skillId, matchedKeywords }) => {
    const category = SKILL_MAP.get(skillId)?.category;
    return (
      category === 'technical' ||
      matchedKeywords.some((k) =>
        /^(?:wms|tms|edi|smartsheet|ms project|microsoft office|ms office|excel|spreadsheets?|google sheets|tableau|power bi|kronos)$/i.test(
          k
        )
      )
    );
  });
}

interface Reading {
  kind: RequirementKind;
  /** The words the question will use. */
  phrase: string;
  preposition?: 'in' | 'with';
}

/** What kind of requirement a line is, and the words a question would quote. Null for none. */
export function readRequirement(line: string): Reading | null {
  const text = bare(line);
  if (!text) return null;
  if (ELIGIBILITY.test(text)) return { kind: 'eligibility', phrase: text };

  const interest = text.match(
    /^(?:an?\s+)?(?:genuine\s+|strong\s+)?(?:interest|passion|enthusiasm) (?:in|for)\s+(.+)$/i
  );
  if (interest) return { kind: 'interest', phrase: headPhrase(interest[1]) };

  const coursework = text.match(
    /^(?:coursework|classes|courses|a course|study|studies)\s+(?:in|on)\s+(.+)$/i
  );
  if (coursework) return { kind: 'coursework', phrase: headPhrase(coursework[1]) };

  const years = text.match(YEARS);
  if (years) {
    const phrase = tidyList(
      headPhrase(years[2]).replace(/\s+(?:or (?:a )?related\s+)?experience$/i, '')
    );
    if (phrase)
      return { kind: 'experience', phrase, preposition: years[1] === 'with' ? 'with' : 'in' };
  }

  const lead = text.match(TOOL_LEAD) ?? text.match(TOOL_LEAD_ADJ);
  if (lead) {
    const head = headPhrase(lead[1]);
    const phrase = tidyList(head);
    if (phrase) {
      if (namesTool(head)) return { kind: 'tool', phrase };
      const gerund = /^\w+ing\b/i.test(phrase);
      return {
        kind: 'experience',
        phrase,
        preposition: gerund ? undefined : /^experience\s+in\b/i.test(text) ? 'in' : 'with',
      };
    }
  }

  // "Experience organizing people, events, or schedules"
  const doing = text.match(/^(?:experience|background)\s+(\w+ing\b.+)$/i);
  if (doing) return { kind: 'experience', phrase: tidyList(headPhrase(doing[1])) };

  const tail = withoutParentheses(text).match(SKILLS_TAIL);
  if (tail && namesTool(withoutParentheses(tail[1]), true)) {
    return { kind: 'tool', phrase: tidyList(headPhrase(tail[1])) };
  }
  if (/\bexperience$/i.test(text) && !QUALITY_OPENER.test(text)) {
    const phrase = withoutParentheses(text.replace(/\s+experience$/i, ''));
    if (phrase)
      return {
        kind: 'experience',
        phrase: phrase[0].toLowerCase() + phrase.slice(1),
        preposition: 'in',
      };
  }

  if (TASK_VERBS.has(firstWord(text)) && !QUALITY_OPENER.test(text)) {
    return { kind: 'task', phrase: headPhrase(text) };
  }
  if (
    QUALITY_OPENER.test(text) ||
    detectSkillsFromText(text).some((s) => SKILL_MAP.get(s.skillId)?.category === 'soft')
  ) {
    return { kind: 'quality', phrase: text };
  }
  return null;
}

/**
 * True when a line names a skill, tool, task, quality, or qualification and
 * is not a location, employer description, or logistics sentence.
 */
export function isQuestionableRequirement(
  line: string,
  context: { company?: string; jobTitle?: string } = {}
): boolean {
  if (isDescriptiveLine(line, context)) return false;
  const reading = readRequirement(line);
  return reading !== null && reading.kind !== 'eligibility';
}

// ============================================================================
// Questions
// ============================================================================

function lowerFirst(text: string): string {
  // Keep acronyms and names: "SOPs", "KPIs", "Excel".
  if (/^[A-Z]{2,}/.test(text) || /^[A-Z][a-z]+[A-Z]/.test(text)) return text;
  return text[0] ? text[0].toLowerCase() + text.slice(1) : text;
}

function asTask(phrase: string, past: boolean): string {
  let task = lowerFirst(phrase).replace(/\bour\s+social media\b/gi, 'social media');
  task = task.replace(/\bour\b/gi, 'the');
  if (past) task = task.replace(/\bthe\b/i, 'a');
  return task;
}

const KIND_NOTES: Record<
  Exclude<RequirementKind, 'eligibility' | 'quality' | 'task'> | 'task-walkthrough' | 'task-time',
  { strongAnswer: string; commonMistake: string }
> = {
  tool: {
    strongAnswer:
      'A real task you did with it, what you made or fixed, and how often you used it. If you have not used it, say so and name the closest thing you have used.',
    commonMistake: 'Listing features of the tool instead of what you did with it.',
  },
  experience: {
    strongAnswer:
      "The closest experience you have, said in the posting's words, with one example from it.",
    commonMistake: 'Saying you do not have it and stopping there.',
  },
  'task-walkthrough': {
    strongAnswer:
      'Clear steps in order, who you would talk to, and how you would know it worked. Borrow from something you have done.',
    commonMistake: 'Staying general. Walk through one real or realistic example.',
  },
  'task-time': {
    strongAnswer: 'One real time, what you did yourself, and what came of it.',
    commonMistake: 'Describing what you usually do instead of one time it happened.',
  },
  interest: {
    strongAnswer: 'A specific reason, and something you have already done or read about it.',
    commonMistake: 'A general answer that would fit any employer.',
  },
  coursework: {
    strongAnswer: 'One thing from the class you have used outside it, with the example.',
    commonMistake: 'Listing topics covered instead of what you can do.',
  },
};

const STOP = new Set(
  'a an and are as at be by for from have in is it of on or the to with you your this that what how tell me about time'.split(
    ' '
  )
);
/** Content words, crudely stemmed so "presenting" meets "presented". */
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(?:ing|ed|es|s)$/, ''))
  );

/** The bank question that best fits a quality line for this visitor, or null. */
function bankQuestionFor(
  text: string,
  skillIds: string[],
  context: RequirementQuestionContext
): QuestionPrompt | null {
  const lineWords = words(text);
  let best: { question: QuestionPrompt; score: number; order: number } | null = null;
  let order = 0;
  for (const skillId of skillIds) {
    for (const question of getQuestionsForSkill(skillId)) {
      order++;
      if (context.used?.has(question.text)) continue;
      if (question.category === 'general') continue;
      if (
        !questionFits(question, {
          audience: context.audience,
          postingSkillIds: context.postingSkillIds ?? skillIds,
        })
      )
        continue;
      if (context.accept && !context.accept(question.text)) continue;
      let score = question.skillIds[0] === skillId ? 2 : 0;
      for (const w of words(question.text)) if (lineWords.has(w)) score++;
      // The first skill on the line matters most.
      if (skillId === skillIds[0]) score += 1;
      if (!best || score > best.score || (score === best.score && order < best.order)) {
        best = { question, score, order };
      }
    }
  }
  return best?.question ?? null;
}

/**
 * The question an interviewer would ask about this requirement, or null when
 * it is not one to interview on (eligibility, a description, or nothing a
 * question could test).
 */
export function questionForRequirement(
  line: string,
  context: RequirementQuestionContext = {}
): RequirementQuestion | null {
  if (isDescriptiveLine(line, context)) return null;
  const reading = readRequirement(line);
  if (!reading || reading.kind === 'eligibility' || !reading.phrase) return null;
  const skillIds = detectSkillsFromText(line).map((s) => s.skillId);

  switch (reading.kind) {
    case 'tool':
      return {
        kind: 'tool',
        question: `How have you used ${reading.phrase}, and for what?`,
        skillIds,
        ...KIND_NOTES.tool,
      };
    case 'experience': {
      const phrase = lowerFirst(reading.phrase);
      const joined = reading.preposition ? `${reading.preposition} ${phrase}` : phrase;
      return {
        kind: 'experience',
        question: `Tell me about your experience ${joined}.`,
        skillIds,
        ...KIND_NOTES.experience,
      };
    }
    case 'interest':
      return {
        kind: 'interest',
        question: `What draws you to ${lowerFirst(reading.phrase)}?`,
        skillIds,
        ...KIND_NOTES.interest,
      };
    case 'coursework':
      return {
        kind: 'coursework',
        question: `What have you used from your coursework in ${lowerFirst(reading.phrase)} outside of class?`,
        skillIds,
        ...KIND_NOTES.coursework,
      };
    case 'task': {
      // Students are asked how they would do it; people with work behind
      // them are asked for a time they did. The two alternate after that.
      const startWithPast = context.audience !== 'student';
      const past = (context.taskIndex ?? 0) % 2 === 0 ? startWithPast : !startWithPast;
      const task = asTask(reading.phrase, past);
      return past
        ? {
            kind: 'task',
            question: `Tell me about a time you had to ${task}.`,
            skillIds,
            ...KIND_NOTES['task-time'],
          }
        : {
            kind: 'task',
            question: `Walk me through how you would ${task}.`,
            skillIds,
            ...KIND_NOTES['task-walkthrough'],
          };
    }
    case 'quality': {
      const softFirst = [
        ...skillIds.filter((id) => SKILL_MAP.get(id)?.category === 'soft'),
        ...skillIds.filter((id) => SKILL_MAP.get(id)?.category !== 'soft'),
      ];
      const bank = bankQuestionFor(reading.phrase, softFirst, context);
      if (!bank) return null;
      return {
        kind: 'quality',
        question: bank.text,
        skillIds: bank.skillIds.filter((id) => id !== 'general'),
        questionId: bank.id,
        strongAnswer: bank.strongAnswer,
        commonMistake: bank.commonMistake,
      };
    }
    default:
      return null;
  }
}
