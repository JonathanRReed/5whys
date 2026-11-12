/**
 * Rule-based checks for the application desk. Every result here is computed
 * from what the student wrote; nothing is estimated.
 */
import type { LetterDraft } from './application-desk';
import type { PostingRequirement } from './posting';
import { extractRequirementTerms, findTermMatches } from './posting';

const GENERIC_OPENERS = [
  /^i am writing to (apply|express)/i,
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
  /\?|\b(i would (love|welcome|appreciate)|i('d| would) like to|could we|can we|let me know|happy to|available (to|for)|reach me|contact me|look forward to (speaking|talking|hearing|meeting))\b/i;

/** The four parts joined the way they would be sent. */
export function letterText(letter: LetterDraft): string {
  return [letter.hook, letter.whyYou, letter.whyThem, letter.closingAsk]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** A page of body text at a normal size holds roughly this many words. */
export const ONE_PAGE_WORDS = 400;

export type SendCheckId = 'names' | 'one-page' | 'posting-words' | 'ends-with-ask';

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

const includesName = (text: string, name: string) =>
  name.trim().length > 0 && text.toLowerCase().includes(name.trim().toLowerCase());

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

  return [
    {
      id: 'names',
      label: 'Names the right role and company',
      passed: !written || !namesKnown ? null : hasRole && hasCompany,
      detail: !namesKnown
        ? 'Add the role title and company to this application first.'
        : !written
          ? 'Nothing written yet.'
          : hasRole && hasCompany
            ? `Mentions ${title.trim()} and ${company.trim()}.`
            : `Does not mention ${[!hasRole && title.trim(), !hasCompany && company.trim()]
                .filter(Boolean)
                .join(' or ')}.`,
    },
    {
      id: 'one-page',
      label: 'Fits on one page',
      passed: written ? words <= ONE_PAGE_WORDS : null,
      detail: written
        ? `${words} ${words === 1 ? 'word' : 'words'}. About ${ONE_PAGE_WORDS} fit on a page.`
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
            ? `Touches ${used} of ${confirmed.length} confirmed requirements.`
            : 'Nothing written yet.',
    },
    {
      id: 'ends-with-ask',
      label: 'Ends with an ask',
      passed: letter.closingAsk.trim() ? ASK_PATTERN.test(letter.closingAsk) : null,
      detail: letter.closingAsk.trim()
        ? ASK_PATTERN.test(letter.closingAsk)
          ? 'The closing asks for a next step.'
          : 'The closing does not ask for anything. Name the next step you want.'
        : 'No closing written yet.',
    },
  ];
}
