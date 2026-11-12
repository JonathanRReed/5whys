/**
 * Rule-based checks for the application desk. Every result here is computed
 * from what the student wrote; nothing is estimated.
 */
import type { LetterDraft } from './application-desk';
import type { PostingRequirement } from './posting';
import { extractRequirementTerms, findTermMatches } from './posting';

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

const ASK_PATTERN =
  /\?|\b(i would (love|welcome) (to|the chance|a chance)|i('d| would) like to (talk|speak|meet|discuss|schedule|set up|hear|learn|show|share|walk)|could we|can we|let me know|happy to (talk|speak|meet|share|send)|available (to|for)|reach me|contact me|look forward to (speaking|talking|hearing|meeting))\b/i;

/** Thanks alone is polite, but it does not ask for anything. */
const THANKS_ONLY = /^(thank you|thanks)[^?]*$/i;

/** True when a closing asks for a next step, not only says thanks. */
export function asks(closing: string): boolean {
  const sentences = closing
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.some(
    (sentence) =>
      ASK_PATTERN.test(sentence) &&
      !THANKS_ONLY.test(sentence) &&
      !/\blike to thank\b/i.test(sentence)
  );
}

/** The four parts joined the way they would be sent. */
export function letterText(letter: LetterDraft): string {
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

export type SendCheckId =
  | 'names'
  | 'one-page'
  | 'posting-words'
  | 'ends-with-ask'
  | 'no-placeholders';

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

const includesName = (text: string, name: string) => {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return false;
  const haystack = text.toLowerCase();
  if (haystack.includes(wanted)) return true;
  const core = coreTitle(name).toLowerCase();
  if (core.length > 2 && haystack.includes(core)) return true;
  // A company is usually named by its distinctive first word: "Northgate"
  // for "Northgate Logistics Partners".
  const first = wanted.split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') ?? '';
  return (
    first.length >= 4 &&
    !GENERIC_NAME_WORDS.has(first) &&
    new RegExp(`\\b${first}\\b`).test(haystack)
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

  const hasRole = includesName(text, title);
  const hasCompany = includesName(text, company);
  const namesKnown = Boolean(title.trim() && company.trim());

  const confirmed = requirements.filter((r) => r.status === 'confirmed');
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
