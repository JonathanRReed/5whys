/**
 * The pay and hours a posting states, read by rule. A posting that says
 * "$15.00/hr | 15-25 hrs/week" or "Salary range: $44,000 to $48,000 per year"
 * already answers what the offer worksheet asks for. Only what is written is
 * read: a figure with no period ("$44,000") is left alone rather than guessed
 * to be yearly, and nothing is averaged.
 */
import type { PayPeriod } from '../application-desk';
import { parseAmount } from '../pay-input';

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

/** The trimmed line a match was found on, kept short enough to quote. */
function quote(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  const line = text.slice(start, end === -1 ? undefined : end).trim();
  return line.length > 120 ? `${line.slice(0, 117).trimEnd()}...` : line;
}

/** The pay and hours written in a posting, or null when it states neither. */
export function readPostingPay(text: string): PostingPay | null {
  if (!text.trim()) return null;
  const quotes: string[] = [];
  let basePay: number | null = null;
  let basePayTo: number | null = null;
  let payPeriod: PayPeriod | null = null;
  const pay = text.match(PAY);
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
