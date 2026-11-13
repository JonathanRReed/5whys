/**
 * Rule-based checks for the application desk. Every result here is computed
 * from what the student wrote; nothing is estimated.
 */
import type { LetterDraft, QualificationRow } from './application-desk';
import type { PostingRequirement } from './posting';
import {
  analyzeRequirement,
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
  return sentences.some((whole) => {
    // "Thank you, I would welcome an interview": the thanks opens the
    // sentence; what follows it can still ask.
    const sentence = whole.replace(THANKS_CLAUSE, '').trim() || whole;
    return (
      REQUEST.test(sentence) &&
      requestsNextStep(sentence) &&
      !(sentence === whole && THANKS_ONLY.test(sentence)) &&
      !/\blike to thank\b/i.test(sentence)
    );
  });
}

/** "Thank you,", "Thanks again for your time;": a thanks that introduces the rest of the sentence. */
const THANKS_CLAUSE =
  /^(?:thank you|thanks)(?:\s+(?:so much|again|very much))?(?:\s+for\s+[^,;:]{1,80})?\s*[,;:]\s*(?=\S)/i;

/** "do not contact me", "no need to reply", "never call": a next step turned down. */
const TURNED_DOWN = /\b(?:not|n't|never|no\s+need\s+to|without)\s+(?:\w+\s+){0,2}$/i;

/** True when a next step is named and not turned down: "Please contact me", not "Please do not contact me". */
function requestsNextStep(sentence: string): boolean {
  const steps = new RegExp(NEXT_STEP.source, 'gi');
  for (const found of sentence.matchAll(steps)) {
    const before = sentence.slice(Math.max(0, (found.index ?? 0) - 40), found.index ?? 0);
    if (!TURNED_DOWN.test(before)) return true;
  }
  return false;
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
  /\b(?:currently enrolled|enrolled (?:in|at)|pursuing (?:a|an) (?:degree|diploma)|high school diploma|ged\b|available to work|availability to work|able to work (?:weekends|evenings|nights|the hours|on[- ]site|in[- ]person|in (?:the )?office|from)|work (?:on[- ]site|in[- ]person) (?:in|at)|must be available|reliable transportation|commut\w*|relocat\w*|monday (?:through|to|-) friday)\b/i;

/** Openers that say how much of a skill, not which: "Working knowledge of", "Strong". */
const SKILL_LEAD =
  /^(?:(?:strong|excellent|solid|basic|good|proven|demonstrated|reliable|advanced|working|some|prior|previous|hands-on|general|great)\s+)*(?:(?:knowledge|understanding|command)\s+of|(?:experience|proficiency|skills?|fluency)\s+(?:in|with|using)|familiarity\s+with|comfort(?:able)?\s+with|ability\s+to|able\s+to)\s+/i;

/**
 * The skill a posting line asks for, short enough to start a sentence: "Working
 * knowledge of Microsoft Excel, including sorting" is "Microsoft Excel".
 */
export function skillName(requirementText: string): string {
  const text = requirementText.trim().replace(/[.;:]+$/, '');
  const analysis = analyzeRequirement(text);
  let name =
    analysis.kind === 'tool' && analysis.asks.length > 0
      ? analysis.asks.map((ask) => ask.label).join(' and ')
      : text
          .replace(SKILL_LEAD, '')
          .split(/,\s*(?:including|such as|especially|ideally|preferably|e\.g\.?)\b|\s+\(/i)[0]
          .replace(/\s+(?:experience|skills?)$/i, '')
          .replace(/^(?:strong|excellent|reliable|solid|good|proven|demonstrated|great)\s+/i, '')
          .trim();
  if (!name) name = text;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Marks a resume line copied into the letter until the visitor has read it in place. */
export const CHECK_RESUME_LINE = '[check this line from your resume]';

/**
 * The "why you" draft from what the visitor marked "have it". Each line names
 * the skill the posting asks for, then the proof: what the visitor typed for
 * it on the qualifications station, or else the resume line that shows it
 * (`evidence`), marked to check, or else "[your proof]". The send check
 * catches anything still in brackets. Conditions of hiring and lines that
 * sell no one (being enrolled, the location, the hours) are skipped. Only the
 * visitor's words and the posting's are used.
 */
export function whyYouDraft(
  requirements: readonly PostingRequirement[],
  rows: readonly QualificationRow[],
  limit = 3,
  evidence: ReadonlyMap<string, string> = new Map()
): string[] {
  const byId = new Map(rows.map((row) => [row.requirementId, row]));
  return (
    requirements
      .filter((r) => r.status === 'confirmed' && byId.get(r.id)?.status === 'have')
      .filter((r) => !hiringCondition(r.text) && !NOT_A_SELLING_POINT.test(r.text))
      .map((r) => {
        const plan = (byId.get(r.id)?.plan ?? '').trim().replace(/\s+/g, ' ');
        const line = (evidence.get(r.id) ?? '')
          .trim()
          .replace(/^[\s•\-*◦–—·]+/, '')
          .replace(/\s+/g, ' ');
        return { skill: skillName(r.text), plan, line };
      })
      // Lines with the visitor's own proof come first, then lines the resume
      // shows, in posting order; a line with nothing behind it yet only fills
      // a place that is left.
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, limit)
      .map(({ skill, plan, line }) => {
        if (plan) return `${skill}: ${sentence(plan)}`;
        if (line) return `${skill}: ${sentence(line)} ${CHECK_RESUME_LINE}`;
        return `${skill}: [your proof]`;
      })
  );
}

const rank = (item: { plan: string; line: string }) => (item.plan ? 2 : item.line ? 1 : 0);

/** The visitor's words as a sentence: a full stop added when there is none. */
const sentence = (text: string) => (/[.?]$/.test(text) ? text : `${text}.`);

/**
 * A name inside a sentence that ends right after it: "at Coastline Supply
 * Co." takes no second full stop.
 */
export function endSentence(text: string): string {
  const trimmed = text.trim();
  return /[.?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
            ? `Mentions ${coreTitle(title) || title.trim()} and ${endSentence(company)}`
            : `Does not mention ${endSentence(
                [!hasRole && (coreTitle(title) || title.trim()), !hasCompany && company.trim()]
                  .filter(Boolean)
                  .join(' or ')
              )}`,
    },
    lengthCheck(written, words),
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

/**
 * Long enough to read as a letter, short enough for about a page. A word
 * count, so it says so: the page itself is not measured.
 */
function lengthCheck(written: boolean, words: number): SendCheck {
  const count = `${words} ${words === 1 ? 'word' : 'words'}`;
  const aim = `Aim for ${LETTER_TARGET_WORDS.min} to ${LETTER_TARGET_WORDS.max}`;
  return {
    id: 'one-page',
    label: 'Length',
    passed: written ? words >= LETTER_TARGET_WORDS.min && words <= ONE_PAGE_WORDS : null,
    detail: !written
      ? 'Nothing written yet.'
      : words < LETTER_TARGET_WORDS.min
        ? `${count}. A letter this short reads as a note. ${aim}.`
        : words > ONE_PAGE_WORDS
          ? `${count}. Past ${ONE_PAGE_WORDS} words a letter usually runs over one page. ${aim}.`
          : `${count}. About a page, counted in words, not measured on the page.`,
  };
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
  /** The marks on the lines the posting lists as required. All zero when it lists none. */
  required: { total: number; have: number; maybe: number; notYet: number };
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
  const required = { total: 0, have: 0, maybe: 0, notYet: 0 };
  let shown = 0;
  let haveShown = 0;
  for (const requirement of requirements) {
    const mark = marks.get(requirement.id) ?? 'unset';
    if (mark === 'have') tally.have += 1;
    else if (mark === 'maybe') tally.maybe += 1;
    else if (mark === 'not-yet') tally.notYet += 1;
    else tally.unset += 1;
    if (requirement.section === 'required') {
      required.total += 1;
      if (mark === 'have') required.have += 1;
      else if (mark === 'maybe') required.maybe += 1;
      else if (mark === 'not-yet') required.notYet += 1;
    }
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
    required,
  };
}

/** "Put the other 2", "Put it", "Put them": the ones marked "have it" that the resume does not show yet. */
function stillToShow(have: number, haveShown: number): string {
  const rest = have - haveShown;
  if (rest <= 0) return '';
  if (rest === 1 && have === 1)
    return " Put it into a bullet or the letter, in the posting's words where it is true.";
  if (rest === have)
    return " Put them into a bullet or the letter, in the posting's words where they are true.";
  return ` Put the other ${rest} into a bullet or the letter, in the posting's words where they are true.`;
}

/** The standing as the sentence the qualifications station shows. */
export function describeStanding(s: Standing): string {
  if (s.total === 0) return 'Every confirmed line is a condition of the job, listed below.';
  const resume =
    s.shown === null
      ? ''
      : s.have > 0 && s.haveShown !== null
        ? `${
            s.have === 1
              ? s.haveShown === 1
                ? ' Your resume already shows the one you have.'
                : ' Your resume does not show the one you have yet.'
              : ` Your resume already shows ${s.haveShown} of the ${s.have} you have.`
          }${stillToShow(s.have, s.haveShown)}`
        : ` Your resume already shows ${s.shown} of the ${s.total}.`;
  if (s.unset === s.total) return `${s.total} to mark.${resume}`;
  const marks = `${s.have} have it, ${s.maybe} maybe, ${s.notYet} not yet${
    s.unset ? `, ${s.unset} still to mark` : ''
  }.`;
  const r = s.required;
  // What the posting itself requires decides the verdict. Lines it lists as
  // preferred, "a plus", or duties are not a reason to hold back.
  const onlyOptionalMissing = r.total > 0 && r.total < s.total && r.notYet === 0;
  const verdict =
    s.unset > 0
      ? ''
      : s.notYet + s.maybe === 0
        ? ' You can show every one of these. Apply.'
        : onlyOptionalMissing
          ? ` Of the ${r.total} required, you have ${r.have}${
              r.maybe ? ` and maybe ${r.maybe}` : ''
            }. What you are missing is not listed as required. That is enough to apply.`
          : (r.total > 0 && r.total < s.total ? r.have >= r.notYet : s.have >= s.notYet)
            ? ' You have more than you are missing. That is enough to apply; plan for the gaps below.'
            : ' You are missing more than you have. You can still apply, and the plan below is where to start.';
  return `${marks}${verdict}${resume}`;
}

/**
 * What the visitor said about the posting's conditions that matters before
 * sending: "I will need sponsorship" against a posting that will not sponsor,
 * or "I do not" meet a condition. One plain line each, from their own marks.
 */
export function conditionWarnings(
  conditions: readonly PostingRequirement[],
  rows: readonly QualificationRow[]
): string[] {
  const marks = new Map(rows.map((row) => [row.requirementId, row.status]));
  const out: string[] = [];
  for (const condition of conditions) {
    const kind = hiringCondition(condition.text);
    const mark = marks.get(condition.id);
    if (!kind) continue;
    if (kind.noSponsorship && mark === 'not-yet') {
      out.push(
        'You said you will need sponsorship, and this posting says it does not sponsor. Ask the recruiter before you apply.'
      );
    } else if (kind.noSponsorship && mark === 'maybe') {
      out.push(
        'You were not sure whether you will need sponsorship, and this posting says it does not sponsor. Ask the recruiter or your international student office before you apply.'
      );
    } else if (!kind.noSponsorship && mark === 'not-yet') {
      out.push(`You said you do not meet this: "${condition.text.trim()}". Ask before you apply.`);
    }
  }
  return [...new Set(out)];
}

/**
 * For a row the resume does not show: the words that were looked for, so the
 * verdict can be checked. "We looked for "retail", "food service" or
 * "warehouse" and did not find them." Null when there is nothing to name.
 */
export function searchedFor(row: {
  kind: string;
  parts: readonly {
    shown: boolean;
    alternatives?: boolean;
    terms: readonly { label: string; span?: { start: number } }[];
  }[];
}): string | null {
  if (row.kind === 'years') return null;
  const groups = row.parts
    .filter((part) => !part.shown && part.terms.length > 0)
    .map((part) => {
      // As the posting wrote them, so "Spanish" and "Excel" keep their capitals;
      // only a word capitalized because it opened the line reads in lower case.
      const labels = [
        ...new Set(
          part.terms.map((t) => {
            const opener = t.span?.start === 0 && /^[A-Z][a-z]/.test(t.label);
            return `"${opener ? t.label.charAt(0).toLowerCase() + t.label.slice(1) : t.label}"`;
          })
        ),
      ];
      if (labels.length === 1) return labels[0];
      const last = labels[labels.length - 1];
      const rest = labels.slice(0, -1).join(', ');
      return part.alternatives ? `${rest} or ${last}` : `${rest} and ${last} on one line`;
    });
  if (groups.length === 0) return null;
  const many = groups.length > 1 || groups[0].includes(' or ') || groups[0].includes(' and ');
  const joined =
    groups.length === 1
      ? groups[0]
      : `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]}`;
  return `We looked for ${joined} and did not find ${
    many ? 'them' : 'it'
  }. If your work counts, say it in a bullet in those words.`;
}

/**
 * The visitor's name, when the resume starts with one: a first line of two to
 * four words, letters only, such as "Marcus Bell" or "RENEE ALVARADO". Null
 * for anything else, so a heading or an address is never offered as a name.
 */
export function nameFromResume(resumeText: string): string | null {
  const first = resumeText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!first || first.length > 60) return null;
  const words = first.split(/\s+/);
  if (words.length < 2 || words.length > 4) return null;
  if (!words.every((w) => /^[\p{L}][\p{L}'’.-]*$/u.test(w))) return null;
  if (
    /^(?:resume|curriculum|vitae|cv|summary|profile|experience|education|skills)$/i.test(words[0])
  )
    return null;
  // "RENEE ALVARADO" reads as Renee Alvarado.
  return first === first.toUpperCase()
    ? words.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    : first;
}

/**
 * Text written from a template that put a full stop after a name that
 * already ended in one ("Coastline Supply Co.."). An ellipsis is left alone.
 */
export function tidyDoubledStop(text: string): string {
  return text.replace(/(?<!\.)\.\.(?!\.)/g, '.');
}

/**
 * True when a message built from the hook does not contain it: the note had
 * no room for the visitor's opening line. Compared on the hook's first words.
 */
export function leavesOutHook(message: string, hook: string): boolean {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const start = words(hook).slice(0, 6).join(' ');
  if (!start || !message.trim()) return false;
  return !words(message).join(' ').includes(start);
}
