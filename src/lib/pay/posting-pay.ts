/**
 * The pay and hours a posting states, read by rule. A posting that says
 * "$15.00/hr | 15-25 hrs/week" or "Salary range: $44,000 to $48,000 per year"
 * already answers what the offer worksheet asks for. Only what is written is
 * read: a figure with no period ("$44,000") is left alone rather than guessed
 * to be yearly, and nothing is averaged.
 */
import type { PayPeriod } from '../application-desk';
import { parseAmount } from '../pay-input';
import { mentionsPay } from '../posting/parse';

export interface PostingPay {
  /** The bottom of the range, or the one figure. */
  basePay: number | null;
  /** The top of a range, when the posting gave one. */
  basePayTo: number | null;
  payPeriod: PayPeriod | null;
  /** Hours a week, or the bottom of a range of hours. */
  hoursPerWeek: number | null;
  /** The top of a range of hours, when the posting gave one. */
  hoursPerWeekTo: number | null;
  /** The posting's own words for the pay and the hours, to show beside the figures. */
  quotes: string[];
}

const AMOUNT = String.raw`\$\s?\d[\d,]*(?:\.\d+)?\s*[kK]?`;
const SECOND = String.raw`\$?\s?\d[\d,]*(?:\.\d+)?\s*[kK]?`;
const UNIT: Array<[RegExp, PayPeriod]> = [
  [/^(?:hour|hr|hourly)$/i, 'hour'],
  [/^(?:week|wk|weekly)$/i, 'week'],
  [/^(?:month|mo|monthly)$/i, 'month'],
  [/^(?:year|yr|annum|annual|annually|yearly)$/i, 'year'],
];
const PAY = new RegExp(
  String.raw`(${AMOUNT})(?:\s*(?:-|–|—|to)\s*(${SECOND}))?\s*(?:(?:\/|per\s+|an?\s+|each\s+)\s*(hour|hr|week|wk|month|mo|year|yr|annum)|(hourly|weekly|monthly|annual(?:ly)?|yearly))\b`,
  'i'
);
const HOURS =
  /\b(\d{1,2}(?:\.\d+)?)(?:\s*(?:-|–|—|to)\s*(\d{1,2}(?:\.\d+)?))?\s*(?:hrs?|hours)\s*(?:\/|per|a|each)\s*(?:week|wk)\b/i;

const amount = (text: string | undefined): number | null => {
  if (!text) return null;
  const parsed = parseAmount(text.replace(/\$/g, '').trim());
  return parsed.ok ? parsed.value : null;
};

const periodOf = (unit: string): PayPeriod | null =>
  UNIT.find(([pattern]) => pattern.test(unit))?.[1] ?? null;

/** Pay on top of base pay: read into no field, since it is not the base. */
const EXTRA_PAY =
  /\b(?:bonus(?:es)?|allowances?|commissions?|tips|overtime|per\s+diem|relocation|reimburse\w*|sign(?:ing|[- ]?on)|incentives?|match(?:ing)?|profit[- ]sharing)\b/gi;
/** Words that make a figure the base pay itself. */
const BASE_PAY =
  /\b(?:salary|salaries|wages?|base|hourly|pay\s+(?:rate|range|band|scale)|starting\s+pay|stipends?|compensation|pays)\b/gi;

const lastIndexOf = (pattern: RegExp, text: string): number => {
  let last = -1;
  for (const found of text.matchAll(pattern)) last = found.index ?? last;
  return last;
};

/**
 * True when a rate is a bonus or an allowance, not base pay: "Annual bonus:
 * $5,000 per year". The nearest word before the figure on its line decides;
 * with none, the words straight after it do ("$5,000 annual bonus").
 */
function isExtraPay(text: string, index: number, length: number): boolean {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const before = text.slice(lineStart, index);
  const extra = lastIndexOf(EXTRA_PAY, before);
  const base = lastIndexOf(BASE_PAY, before);
  if (extra !== -1 || base !== -1) return extra > base;
  const lineEnd = text.indexOf('\n', index);
  const after = text
    .slice(index + length, lineEnd === -1 ? undefined : lineEnd)
    .split(/[,;$]|\bplus\b|\band\b/i)[0];
  return lastIndexOf(EXTRA_PAY, after) !== -1 && lastIndexOf(BASE_PAY, after) === -1;
}

/** The whole line a match was found on. */
function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim();
}

/** That line, kept short enough to quote. */
function quote(text: string, index: number): string {
  const line = lineAt(text, index);
  return line.length > 120 ? `${line.slice(0, 117).trimEnd()}...` : line;
}

/** The pay and hours written in a posting, or null when it states neither. */
export function readPostingPay(text: string): PostingPay | null {
  if (!text.trim()) return null;
  const quotes: string[] = [];
  let basePay: number | null = null;
  let basePayTo: number | null = null;
  let payPeriod: PayPeriod | null = null;
  // The first rate that is the applicant's pay. "Manage $200,000 per year in
  // marketing spend" is money the job handles: the same rule that keeps such
  // a line as a duty in the decoded posting passes over it here.
  const pay = [...text.matchAll(new RegExp(PAY.source, 'gi'))].find(
    (match) =>
      match.index !== undefined &&
      mentionsPay(lineAt(text, match.index)) &&
      !isExtraPay(text, match.index, match[0].length)
  );
  if (pay && pay.index !== undefined) {
    const low = amount(pay[1]);
    const high = amount(pay[2]);
    // "$44-48k": the "k" on the top belongs to the bottom too.
    const sharedK =
      low !== null &&
      high !== null &&
      /k\s*$/i.test(pay[2] ?? '') &&
      !/k/i.test(pay[1]) &&
      low * 1000 <= high;
    basePay = sharedK && low !== null ? low * 1000 : low;
    payPeriod = periodOf(pay[3] ?? pay[4] ?? '');
    if (basePay !== null && high !== null && high > basePay) basePayTo = high;
    if (basePay !== null && payPeriod) quotes.push(quote(text, pay.index));
    else {
      basePay = null;
      payPeriod = null;
    }
  }
  let hoursPerWeek: number | null = null;
  let hoursPerWeekTo: number | null = null;
  const hours = text.match(HOURS);
  if (hours && hours.index !== undefined) {
    const low = Number(hours[1]);
    const high = hours[2] ? Number(hours[2]) : null;
    if (low > 0 && low <= 100) {
      hoursPerWeek = low;
      if (high !== null && high > low && high <= 100) hoursPerWeekTo = high;
      const line = quote(text, hours.index);
      if (!quotes.includes(line)) quotes.push(line);
    }
  }
  if (basePay === null && hoursPerWeek === null) return null;
  return { basePay, basePayTo, payPeriod, hoursPerWeek, hoursPerWeekTo, quotes };
}
