/**
 * Rule-based checks for the application desk. Every result here is computed
 * from what the student wrote; nothing is estimated.
 */
import type { LetterDraft, QualificationRow } from './application-desk';
import type { PostingRequirement } from './posting';
import {
  extractRequirementTerms,
  findTermMatches,
  hiringCondition,
  requirementsFromBullets,
  splitConditions,
} from './posting';
import { countWord, SEND_CHECK_IDS, type SendCheckId } from './send-check-ids';

export { countWord, SEND_CHECK_IDS, type SendCheckId };

/**
 * The confirmed lines of a posting, split into the ones a resume or a letter
 * can show and the conditions of hiring (an age, a licence, citizenship, work
 * authorization, a background check, a physical duty). Every count on the
 * desk is taken from `requirements`, so a condition is never one of the
 * "N of M" and never offered as something to write about.
 */
export function deskRequirements(bullets: Parameters<typeof requirementsFromBullets>[0]): {
  requirements: PostingRequirement[];
  conditions: PostingRequirement[];
} {
  return splitConditions(requirementsFromBullets(bullets).filter((r) => r.status === 'confirmed'));
}

const GENERIC_OPENERS = [
  /^i('m| am) writing (to|because|in (regard|response))/i,
  /^i('m| am) (excited|thrilled|pleased|eager) to apply/i,
  /^i would like to apply/i,
  /^please accept (this|my)/i,
  /^to whom it may concern/i,
  /^my name is\b/i,
  /^i am (a|an) [\w\s-]{0,40}(student|graduate|professional) (and|who|looking|seeking)/i,
  /^i saw your (posting|job|ad)/i,
];

/** True when a hook opens the way most letters do, so it will not stand out. */
export function isGenericOpener(hook: string): boolean {
  const text = hook.trim().replace(/^dear [^,\n]{0,60},\s*/i, '');
  return GENERIC_OPENERS.some((pattern) => pattern.test(text));
}

/**
 * A next step a letter can ask for: a conversation, an interview, a call, a
 * reply, a meeting, or a way to be contacted.
 */
const NEXT_STEP =
  /\b(talk|talking|speak|speaking|chat|conversation|discuss|discussing|interview|interviewing|call|meet|meeting|reply|respond|response|hear back|hear from you|hearing back|hearing from you|contact|reach me|reach out|connect|connecting|schedule|set up a time)\b/i;

/** The sentence asks for it, rather than only mentioning the word. */
const REQUEST =
  /\?|\b(would|could|can|may|might|please|let me know|let's|let us|feel free|i('d| would) (love|like|welcome|appreciate|value)|i hope|look forward|looking forward|happy to|glad to|available|welcome|keen|eager|open to|invite|at your convenience|when you are free)\b/i;

/** Thanks alone is polite, but it does not ask for anything. */
const THANKS_ONLY = /^(thank you|thanks)[^?]*$/i;

/**
 * True when a closing asks for a next step, not only says thanks. A question
 * mark alone is not an ask: "Why is the sky blue?" requests nothing. The
 * sentence must ask for a conversation, interview, call, reply, meeting or
 * contact.
 */
export function asks(closing: string): boolean {
  const sentences = closing
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.some(
    (sentence) =>
      NEXT_STEP.test(sentence) &&
      REQUEST.test(sentence) &&
      !THANKS_ONLY.test(sentence) &&
      !/\blike to thank\b/i.test(sentence)
  );
}

/**
 * Phrases so common in letters that a reader skips them. Shown as
 * information, quoted from the letter, never as a pass or a fail.
 */
const WORN_PHRASES: readonly { phrase: string; pattern: RegExp }[] = [
  { phrase: 'passionate about', pattern: /\bpassionate about\b/i },
  { phrase: 'hard worker', pattern: /\bhard[- ]?worker\b/i },
  { phrase: 'hard-working', pattern: /\bhard[- ]working\b/i },
  { phrase: 'team player', pattern: /\bteam[- ]player\b/i },
  { phrase: 'detail-oriented', pattern: /\bdetail[- ]oriented\b/i },
  { phrase: 'fast learner', pattern: /\b(?:fast|quick) learner\b/i },
  {
    phrase: 'think outside the box',
    pattern: /\b(?:think(?:ing)?|thinker) outside (?:of )?the box\b/i,
  },
  { phrase: 'self-starter', pattern: /\bself[- ]starter\b/i },
  { phrase: 'go-getter', pattern: /\bgo[- ]getter\b/i },
  { phrase: 'results-driven', pattern: /\bresults?[- ]driven\b/i },
  { phrase: 'people person', pattern: /\bpeople person\b/i },
  { phrase: 'go above and beyond', pattern: /\bgo(?:es|ing)? above and beyond\b/i },
  { phrase: 'perfect fit', pattern: /\bperfect fit\b/i },
  { phrase: 'dream job', pattern: /\bdream job\b/i },
  { phrase: 'wear many hats', pattern: /\bwear(?:ing)? many hats\b/i },
];

/**
 * Worn phrases in the body of the letter, each quoted as the visitor wrote
 * it, in the order they appear. Information only: nothing is scored.
 */
export function wornPhrases(letter: Pick<LetterDraft, LetterBodyPart>): string[] {
  const text = letterText(letter);
  return WORN_PHRASES.flatMap(({ pattern }) => {
    const found = text.match(pattern);
    return found ? [{ quote: found[0], at: found.index ?? 0 }] : [];
  })
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.quote);
}

type LetterBodyPart = 'hook' | 'whyYou' | 'whyThem' | 'closingAsk';

/**
 * Lines on a posting that are true of nearly every applicant and do not sell
 * anyone: being enrolled, a diploma, being able to work the hours. They stay
 * on the qualifications list but are not offered as letter material.
 */
const NOT_A_SELLING_POINT =
  /\b(?:currently enrolled|enrolled (?:in|at)|pursuing (?:a|an) (?:degree|diploma)|high school diploma|ged\b|available to work|availability to work|able to work (?:weekends|evenings|nights|the hours)|must be available|reliable transportation)\b/i;

/**
 * The "why you" draft from what the visitor marked "have it": each line from
 * the posting, followed by the proof they typed for it on the qualifications
 * station, or "[your proof]" when they wrote none. Conditions of hiring and
 * lines that do not sell anyone (enrolment, availability) are skipped. Only
 * the visitor's words and the posting's are used.
 */
export function whyYouDraft(
  requirements: readonly PostingRequirement[],
  rows: readonly QualificationRow[],
  limit = 3
): string[] {
  const byId = new Map(rows.map((row) => [row.requirementId, row]));
  return requirements
    .filter((r) => r.status === 'confirmed' && byId.get(r.id)?.status === 'have')
    .filter((r) => !hiringCondition(r.text) && !NOT_A_SELLING_POINT.test(r.text))
    .slice(0, limit)
    .map((r) => {
      const skill = r.text.trim().replace(/[.;:]+$/, '');
      const proof = (byId.get(r.id)?.plan ?? '').trim().replace(/\s+/g, ' ');
      return `${skill}: ${proof ? (/[.?]$/.test(proof) ? proof : `${proof}.`) : '[your proof]'}`;
    });
}

/** The four parts joined the way they would be sent. */
export function letterText(letter: Pick<LetterDraft, LetterBodyPart>): string {
  return [letter.hook, letter.whyYou, letter.whyThem, letter.closingAsk]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** A greeting for a name or a team, or a neutral one when neither is known. */
export function greeting(recipient: string): string {
  const name = recipient
    .trim()
    .replace(/^dear\s+/i, '')
    .replace(/[,:]+$/, '');
  return name ? `Dear ${name},` : 'Dear Hiring Team,';
}

/** The whole letter as it would be sent: greeting, the four parts, sign-off. */
export function fullLetter(letter: LetterDraft): string {
  const body = letterText(letter);
  if (!body) return '';
  const signOff = letter.sender.trim() ? `Sincerely,\n${letter.sender.trim()}` : 'Sincerely,';
  return [greeting(letter.recipient), body, signOff].join('\n\n');
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** A page of body text at a normal size holds roughly this many words. */
export const ONE_PAGE_WORDS = 400;
/**
 * A connection note on a free LinkedIn account. Paid accounts allow more;
 * most students are on free ones, so the note is written to fit those.
 */
export const LINKEDIN_NOTE_LIMIT = 200;
/** What to aim for: three or four short paragraphs that get read. */
export const LETTER_TARGET_WORDS = { min: 250, max: 350 } as const;

export interface SendCheck {
  id: SendCheckId;
  label: string;
  /** null when there is not enough written yet to check. */
  passed: boolean | null;
  detail: string;
}

export interface SendCheckInput {
  letter: LetterDraft;
  title: string;
  company: string;
  requirements: PostingRequirement[];
}

/**
 * A posting's title often carries extras a letter would never repeat:
 * "Operations Intern, Summer 2027", "Analyst (Remote)", "Associate - Night
 * shift". The role is named if its core words appear, in order.
 */
export function coreTitle(title: string): string {
  return title
    .replace(/\(.*?\)/g, ' ')
    .split(/\s[-–|]\s|,|:/)[0]
    .replace(/\b(summer|fall|autumn|winter|spring)\b/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether `phrase` appears in `text` as whole words: "Meta" is not in
 * "metadata", and "Data analyst" is not in "Data engineer". Spacing and case
 * do not matter.
 */
function hasPhrase(text: string, phrase: string): boolean {
  const words = phrase.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join('\\s+')}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/** The role is named when its title, or the title's core words, appear whole. */
export const namesRole = (text: string, title: string) => {
  if (!title.trim()) return false;
  if (hasPhrase(text, title)) return true;
  const core = coreTitle(title);
  return core.length > 2 && hasPhrase(text, core);
};

/**
 * The employer is named when its name appears whole, or its distinctive
 * first word does: "Northgate" for "Northgate Logistics Partners".
 */
export const namesCompany = (text: string, company: string) => {
  if (!company.trim()) return false;
  if (hasPhrase(text, company)) return true;
  const first =
    company
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^\p{L}\p{N}&'-]/gu, '') ?? '';
  return (
    first.length >= 4 && !GENERIC_NAME_WORDS.has(first.toLowerCase()) && hasPhrase(text, first)
  );
};

/** First words that do not identify an employer on their own. */
const GENERIC_NAME_WORDS = new Set([
  'the',
  'city',
  'county',
  'state',
  'university',
  'college',
  'national',
  'american',
  'united',
  'first',
  'new',
  'north',
  'south',
  'east',
  'west',
  'general',
  'global',
  'international',
  'community',
  'department',
  'office',
  'marketing',
  'operations',
  'project',
  'program',
  'senior',
  'junior',
  'assistant',
  'associate',
]);

/** Square-bracket placeholders left in from a template, such as "[your proof]". */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{2,60}\]/g) ?? [])];
}

/** The checks the site can compute. Proofreading by another person is not one. */
export function runSendChecks({
  letter,
  title,
  company,
  requirements,
}: SendCheckInput): SendCheck[] {
  const text = letterText(letter);
  const written = text.length > 0;
  const words = countWords(text);

  const hasRole = namesRole(text, title);
  const hasCompany = namesCompany(text, company);
  const namesKnown = Boolean(title.trim() && company.trim());

  // Conditions of hiring are not something a letter shows, so they are not counted.
  const confirmed = splitConditions(
    requirements.filter((r) => r.status === 'confirmed')
  ).requirements;
  const used = confirmed.filter(
    (r) => findTermMatches(extractRequirementTerms(r.text), text).length > 0
  ).length;

  // What is copied and sent also carries the greeting and the signature.
  const placeholders = findPlaceholders([letter.recipient, text, letter.sender].join('\n'));

  return [
    {
      id: 'no-placeholders',
      label: 'Nothing left to fill in',
      passed: written ? placeholders.length === 0 : null,
      detail: !written
        ? 'Nothing written yet.'
        : placeholders.length === 0
          ? 'No bracketed placeholders remain.'
          : `Still to replace: ${placeholders.slice(0, 3).join(', ')}.`,
    },
    {
      id: 'names',
      label: 'Names the right role and company',
      passed: !written || !namesKnown ? null : hasRole && hasCompany,
      detail: !namesKnown
        ? 'Add the role title and company to this application first.'
        : !written
          ? 'Nothing written yet.'
          : hasRole && hasCompany
            ? `Mentions ${coreTitle(title) || title.trim()} and ${company.trim()}.`
            : `Does not mention ${[
                !hasRole && (coreTitle(title) || title.trim()),
                !hasCompany && company.trim(),
              ]
                .filter(Boolean)
                .join(' or ')}.`,
    },
    {
      id: 'one-page',
      label: 'Fits on one page',
      passed: written ? words <= ONE_PAGE_WORDS : null,
      detail: written
        ? `${words} ${words === 1 ? 'word' : 'words'}. Aim for ${LETTER_TARGET_WORDS.min} to ${LETTER_TARGET_WORDS.max}. Past ${ONE_PAGE_WORDS} it will not fit on one page.`
        : 'Nothing written yet.',
    },
    {
      id: 'posting-words',
      label: 'Uses words from the posting',
      passed: written && confirmed.length > 0 ? used > 0 : null,
      detail:
        confirmed.length === 0
          ? 'Confirm some requirements on the posting first.'
          : written
            ? `Touches ${used} of ${confirmed.length} confirmed requirements.${
                used > 0 && used < 2 && confirmed.length > 2
                  ? ' Two or three, each with proof, make a stronger letter.'
                  : ''
              }`
            : 'Nothing written yet.',
    },
    {
      id: 'ends-with-ask',
      label: 'Ends with an ask',
      passed: letter.closingAsk.trim() ? asks(letter.closingAsk) : null,
      detail: letter.closingAsk.trim()
        ? asks(letter.closingAsk)
          ? 'The closing asks for a next step.'
          : 'The closing does not ask for anything. Name the next step you want.'
        : 'No closing written yet.',
    },
  ];
}

export interface Standing {
  have: number;
  maybe: number;
  notYet: number;
  unset: number;
  /** Requirements counted: the confirmed ones that are not conditions of hiring. */
  total: number;
  /** Of those, how many the resume shows, or null with no resume to read. */
  shown: number | null;
  /** Of the ones marked "have it", how many the resume already shows. Null with no resume. */
  haveShown: number | null;
}

/**
 * Where the visitor stands, as one count: their own marks, and how many of
 * those the resume already shows. Both come from the same list of
 * requirements (conditions of hiring left out), so the two can never
 * disagree about what is being counted.
 */
export function standing(
  requirements: readonly PostingRequirement[],
  rows: readonly QualificationRow[],
  evidence: ReadonlyMap<string, 'evidence' | 'partial' | 'none' | 'not-checkable'> | null
): Standing {
  const marks = new Map(rows.map((row) => [row.requirementId, row.status]));
  const tally = { have: 0, maybe: 0, notYet: 0, unset: 0 };
  let shown = 0;
  let haveShown = 0;
  for (const requirement of requirements) {
    const mark = marks.get(requirement.id) ?? 'unset';
    if (mark === 'have') tally.have += 1;
    else if (mark === 'maybe') tally.maybe += 1;
    else if (mark === 'not-yet') tally.notYet += 1;
    else tally.unset += 1;
    if (evidence?.get(requirement.id) === 'evidence') {
      shown += 1;
      if (mark === 'have') haveShown += 1;
    }
  }
  return {
    ...tally,
    total: requirements.length,
    shown: evidence ? shown : null,
    haveShown: evidence ? haveShown : null,
  };
}

/** The standing as the sentence the qualifications station shows. */
export function describeStanding(s: Standing): string {
  if (s.total === 0) return 'Every confirmed line is a condition of the job, listed below.';
  const resume =
    s.shown === null
      ? ''
      : s.have > 0 && s.haveShown !== null
        ? ` Your resume already shows ${s.haveShown} of the ${s.have} you have.${
            s.have - s.haveShown > 0
              ? ` Put the other ${s.have - s.haveShown} into a bullet or the letter, in the posting's words where they are true.`
              : ''
          }`
        : ` Your resume already shows ${s.shown} of the ${s.total}.`;
  if (s.unset === s.total) return `${s.total} to mark.${resume}`;
  const marks = `${s.have} have it, ${s.maybe} maybe, ${s.notYet} not yet${
    s.unset ? `, ${s.unset} still to mark` : ''
  }.`;
  const verdict =
    s.unset > 0
      ? ''
      : s.notYet + s.maybe === 0
        ? ' You can show every one of these. Apply.'
        : s.have >= s.notYet
          ? ' You have more than you are missing. That is enough to apply; plan for the gaps below.'
          : ' You are missing more than you have. You can still apply, and the plan below is where to start.';
  return `${marks}${verdict}${resume}`;
}
