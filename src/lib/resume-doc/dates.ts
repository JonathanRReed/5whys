import type { DateStyle } from './types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_PATTERN =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sept?\\.?|Oct\\.?|Nov\\.?|Dec\\.?';
const DATE = new RegExp(
  `\\b(?:(${MONTH_PATTERN})\\s+((?:19|20)\\d{2})|(0?[1-9]|1[0-2])[/.-]((?:19|20)\\d{2}))\\b`,
  'gi'
);

export function datesIn(text: string) {
  const links = [...text.matchAll(/(?:https?:\/\/|www\.)\S+/gi)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  return [...text.matchAll(DATE)]
    .filter((match) => !links.some((link) => match.index >= link.start && match.index < link.end))
    .map((match) => ({
      text: match[0],
      index: match.index,
      month: match[1]
        ? MONTHS.findIndex(
            (month) => month.slice(0, 3).toLowerCase() === match[1].slice(0, 3).toLowerCase()
          ) + 1
        : Number(match[3]),
      year: match[2] ?? match[4],
      style: match[1]
        ? MONTHS.some((month) => month.toLowerCase() === match[1].toLowerCase())
          ? 'long-month'
          : 'short-month'
        : 'numeric',
    }));
}

export function formatDates(text: string, style: DateStyle): string {
  const dates = datesIn(text);
  for (const date of dates.reverse()) {
    const month = MONTHS[date.month - 1];
    const replacement =
      style === 'numeric'
        ? `${String(date.month).padStart(2, '0')}/${date.year}`
        : `${style === 'short-month' ? month.slice(0, 3) : month} ${date.year}`;
    text = text.slice(0, date.index) + replacement + text.slice(date.index + date.text.length);
  }
  return text;
}
