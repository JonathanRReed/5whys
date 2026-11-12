/**
 * Repeated phrases in a posting, without the employer's own name or the job
 * title. "lakeview county ×2" told the student nothing: every posting repeats
 * its own name.
 */

import { getRepeatedTerms, type RepeatedTerm } from '../posting/terms';
import { escapeRegExp } from '../posting/text';

export interface PostingNames {
  company?: string;
  jobTitle?: string;
}

const COMPANY_SUFFIX = /[,\s]+(?:inc|llc|ltd|co|corp|corporation|company|group|partners)\.?$/i;

/** The opening lines of a posting usually carry the title and the employer. */
function headerNames(text: string): PostingNames {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
  const short = (line: string | undefined) =>
    line && line.split(/\s+/).length <= 12 ? line : undefined;
  const second = short(lines[1]);
  return {
    jobTitle: short(lines[0]),
    company: second?.split(/\s*[,|(·–-]\s*/)[0],
  };
}

/** Every way a name shows up in the text: whole, without a suffix, and its leading words. */
function nameForms(name: string | undefined, leading: boolean): string[] {
  const whole = name?.replace(/\s*\([^)]*\)/g, '').trim();
  if (!whole) return [];
  const forms = new Set<string>([whole, whole.replace(COMPANY_SUFFIX, '').trim()]);
  const beforeComma = whole.split(/\s*[,|]\s*/)[0];
  if (beforeComma) forms.add(beforeComma);
  if (leading) {
    const words = whole.replace(COMPANY_SUFFIX, '').split(/\s+/);
    for (let n = words.length - 1; n >= 1; n--) {
      const prefix = words.slice(0, n).join(' ');
      if (prefix.length >= 4) forms.add(prefix);
    }
  }
  return [...forms].filter((form) => form.length >= 3).sort((a, b) => b.length - a.length);
}

/** Phrases that repeat across the posting, leaving out the employer's name and the job title. */
export function postingRepeatedTerms(
  text: string,
  names: PostingNames = {},
  limit = 8
): RepeatedTerm[] {
  const header = headerNames(text);
  const forms = [
    ...nameForms(names.company || header.company, true),
    ...nameForms(names.jobTitle, false),
    ...nameForms(header.jobTitle, false),
  ];
  let cleaned = text;
  for (const form of forms) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(form)}\\b`, 'gi'), '\n');
  }
  return getRepeatedTerms(cleaned, limit);
}
