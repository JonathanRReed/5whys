/**
 * Notes about parts of a resume that are not achievement lines. Information
 * only: none of them changes a score, and each one says what it saw in the
 * resume's own words, with one plain sentence on what people commonly do.
 */
import { looksLikeHeading, sectionOf } from '../posting/resume-lines';
import { BUZZWORDS, matchesTerm } from './constants';
import { detectResumeStructure, PERSONAL_DETAIL } from './structure';

const PERSONAL_NAMES: Array<[RegExp, string]> = [
  [/\b(?:date of birth|d\.?o\.?b\.?|birth ?date|born (?:on|in))\b/i, 'date of birth'],
  [/\bage\s*[:：]/i, 'age'],
  [/\b(?:nationality|citizenship)\b/i, 'nationality'],
  [/\b(?:gender|sex)\s*[:：]/i, 'gender'],
  [/\b(?:marital status|married)\b/i, 'marital status'],
  [/\breligion\b/i, 'religion'],
  [/\bphoto(?:graph)?\b/i, 'a photo'],
];

/** "a, b, and c". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Personal details many resumes outside the US carry and US resumes leave
 * out. Null when there are none.
 */
export function readPersonalDetailsNote(
  text: string
): { found: string[]; sentences: string[] } | null {
  const lines = text.split('\n').filter((line) => PERSONAL_DETAIL.test(line));
  if (lines.length === 0) return null;
  const joined = lines.join('\n');
  const found = PERSONAL_NAMES.filter(([pattern]) => pattern.test(joined)).map(([, name]) => name);
  if (found.length === 0) return null;
  return {
    found,
    sentences: [
      `This resume lists ${list(found)}.`,
      'US resumes usually leave these out. US law bars hiring decisions based on most of them, so many employers prefer not to see them.',
    ],
  };
}

// Self-descriptions a summary often leans on. A claim anyone can make.
const SUMMARY_CLAIMS = [
  ...BUZZWORDS,
  'dedicated',
  'motivated',
  'driven',
  'passionate',
  'enthusiastic',
  'reliable',
  'fast-paced',
  'strong work ethic',
  'excellent communication',
];

/** The summary paragraph: lines under a Summary, Profile, or Objective heading. */
function summaryText(text: string): string {
  const lines = text.split('\n').map((line) => line.trim());
  const out: string[] = [];
  let inSummary = false;
  for (const line of lines) {
    if (!line) continue;
    if (looksLikeHeading(line)) {
      inSummary = sectionOf(line) === 'summary';
      continue;
    }
    if (inSummary) out.push(line);
  }
  return out.join(' ');
}

/**
 * The summary is not scored line by line, but it is the paragraph a reader
 * meets first. When it leans on claims anyone can make, say which.
 */
export function readSummaryNote(text: string): { claims: string[]; sentences: string[] } | null {
  const summary = summaryText(text);
  if (!summary) return null;
  const lower = summary.toLowerCase();
  const claims = SUMMARY_CLAIMS.filter((claim) => matchesTerm(summary, claim, lower, claim));
  // "hardworking" and "hard-working" are one claim.
  const unique = claims.filter(
    (claim, index) =>
      !claims.slice(0, index).some((earlier) => earlier.replace('-', '') === claim.replace('-', ''))
  );
  if (unique.length === 0) return null;
  return {
    claims: unique,
    sentences: [
      `Your summary leans on ${list(unique.map((claim) => `"${claim}"`))}. Anyone can say those.`,
      'One or two plain sentences on what you have done and the work you want next say more. The lines below can show the rest.',
    ],
  };
}

/** Lines that state a career break. They are not scored. */
export function careerBreaks(text: string): string[] {
  return detectResumeStructure(text).breaks;
}
