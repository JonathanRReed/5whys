/**
 * A factual note about the dates on a resume: gaps of more than six months
 * between dated roles, and roles that ended more than fifteen years ago.
 * Information only. It never changes a score, and it never says a gap or a
 * long career is a problem; each fact comes with one plain sentence on what
 * people commonly do. Roles are read by the same reader that counts years of
 * experience against a posting (posting/resume-lines.ts), so the two agree.
 */
import { type MonthStamp, readDocument } from '../posting/resume-lines';
import { detectResumeStructure } from './structure';

/** A stretch longer than this many months with no dated role is listed. */
const GAP_MONTHS = 6;
/** A role that ended more than this many years ago is listed as older. */
const OLDER_YEARS = 15;

const MONTH_NAMES = [
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

const NAMES_A_MONTH =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b|\b\d{1,2}\/(?:19|20)\d{2}\b|\b(?:spring|summer|fall|autumn|winter)\s+(?:19|20)\d{2}\b/i;

interface DateGap {
  /** "2015" or "March 2017", as precise as the resume is. */
  after: string;
  before: string;
}

interface OlderRole {
  heading: string;
  endYear: number;
}

interface DatesNote {
  gaps: DateGap[];
  olderRoles: OlderRole[];
  /** The last role's end, when no role runs to today and the stretch since is long. */
  sinceLast: string | null;
  /** How dates written with numbers only were read, in plain sentences. */
  readings: string[];
  /** Plain sentences for the report, in order. */
  sentences: string[];
}

const key = (stamp: MonthStamp) => stamp.year * 12 + (stamp.month - 1);
const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3));

// "01/07/2025": day, month, year, or month, day, year.
const FULL_NUMERIC = /\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})\b/g;
// "2021.09", "2021/09", "2021-09": year first.
const YEAR_MONTH = /\b((?:19|20)\d{2})[./-](\d{1,2})\b(?![./-]\d)/g;
// "05.2027": month and year with a dot, which the role reader does not read.
const DOT_MONTH_YEAR = /\b(\d{1,2})\.((?:19|20)\d{2})\b/g;

const valid = (month: number) => month >= 1 && month <= 12;

/**
 * Dates written with numbers only, rewritten as "Mon YYYY" so the role reader
 * can place them, with a plain sentence saying how each kind was read. A
 * full date is read day first when any date on the resume can only be day
 * first ("31/08/2025"); otherwise month first, the US order.
 */
export function readNumericDates(text: string): { text: string; readings: string[] } {
  const readings: string[] = [];
  const full = [...text.matchAll(FULL_NUMERIC)];
  const dayFirst = full.some((match) => Number(match[1]) > 12 && valid(Number(match[2])));
  let rewritten = text.replace(FULL_NUMERIC, (whole, a: string, b: string, year: string) => {
    const month = Number(dayFirst ? b : a);
    return valid(month) ? `${SHORT_MONTHS[month - 1]} ${year}` : whole;
  });
  if (dayFirst) {
    const example = full.find((match) => Number(match[1]) <= 12 && Number(match[2]) <= 12);
    const shown = full.find((match) => Number(match[1]) > 12) ?? full[0];
    const day = Number(shown[1]);
    const month = Number(shown[2]);
    readings.push(
      `Read ${shown[0]} as ${day} ${MONTH_NAMES[month - 1]} ${shown[3]}, day first.${
        example
          ? ` A US reader may take ${example[0]} as ${MONTH_NAMES[Number(example[1]) - 1]} ${Number(example[2])}.`
          : ''
      } Writing ${SHORT_MONTHS[month - 1]} ${shown[3]} avoids that.`
    );
  }
  const yearFirst: Array<[string, string, string]> = [];
  rewritten = rewritten.replace(YEAR_MONTH, (whole, year: string, month: string) => {
    if (!valid(Number(month))) return whole;
    yearFirst.push([whole, year, month]);
    return `${SHORT_MONTHS[Number(month) - 1]} ${year}`;
  });
  rewritten = rewritten.replace(DOT_MONTH_YEAR, (whole, month: string, year: string) =>
    valid(Number(month)) ? `${SHORT_MONTHS[Number(month) - 1]} ${year}` : whole
  );
  if (yearFirst.length > 0) {
    const [whole, year, month] = yearFirst[0];
    readings.push(
      `Read ${whole} as ${MONTH_NAMES[Number(month) - 1]} ${year}. US resumes usually write it ${SHORT_MONTHS[Number(month) - 1]} ${year}.`
    );
  }
  return { text: rewritten, readings };
}

// A resume that is still in school: the stretch since the last job is study.
const IN_SCHOOL = /\b(?:expected|anticipated|class of|currently enrolled|in progress)\b/i;
const label = (stamp: MonthStamp, monthKnown: boolean) =>
  monthKnown ? `${MONTH_NAMES[stamp.month - 1]} ${stamp.year}` : String(stamp.year);

/**
 * The dates note for a resume, or null when there is nothing to say: fewer
 * than two dated roles and none older than fifteen years.
 */
export function readDatesNote(raw: string, today: Date = new Date()): DatesNote | null {
  const { text, readings } = readNumericDates(raw);
  const roles = readDocument(text, { today }).roles.map((role) => {
    const monthKnown = NAMES_A_MONTH.test(role.heading);
    // "2008 - 2015" could mean any month of either year: read it as widely as
    // it allows, so a gap is only listed when the resume's own dates show it.
    const start = monthKnown ? key(role.from) : role.from.year * 12;
    const end = monthKnown || role.ongoing ? key(role.to) : role.to.year * 12 + 11;
    return { role, monthKnown, start, end };
  });
  if (roles.length === 0) {
    return readings.length > 0
      ? { gaps: [], olderRoles: [], sinceLast: null, readings, sentences: readings }
      : null;
  }

  const now = today.getFullYear() * 12 + today.getMonth();
  const gaps: DateGap[] = [];
  const ordered = [...roles].sort((a, b) => a.start - b.start);
  let covered = ordered[0];
  for (const next of ordered.slice(1)) {
    if (next.start - covered.end - 1 > GAP_MONTHS) {
      gaps.push({
        after: label(covered.role.to, covered.monthKnown),
        before: label(next.role.from, next.monthKnown),
      });
    }
    if (next.end > covered.end) covered = next;
  }

  const olderRoles: OlderRole[] = ordered
    .filter((entry) => !entry.role.ongoing && now - entry.end > OLDER_YEARS * 12)
    .map((entry) => ({
      heading: entry.role.heading.replace(/\s+/g, ' ').trim(),
      endYear: entry.role.to.year,
    }));

  // The stretch from the last role to today. A break line on the resume, a
  // role still going, or a resume still in school already accounts for it.
  const latest = ordered.reduce((last, entry) => (entry.end > last.end ? entry : last));
  const sinceLast =
    !roles.some((entry) => entry.role.ongoing) &&
    now - latest.end > GAP_MONTHS &&
    !IN_SCHOOL.test(text) &&
    detectResumeStructure(raw).breaks.length === 0
      ? label(latest.role.to, latest.monthKnown)
      : null;

  if (gaps.length === 0 && olderRoles.length === 0 && !sinceLast && readings.length === 0) {
    return null;
  }

  const sentences: string[] = [...readings];
  for (const gap of gaps) {
    sentences.push(`No role is listed between ${gap.after} and ${gap.before}.`);
  }
  if (sinceLast) {
    sentences.push(`Your last dated role ended in ${sinceLast}, and none runs to today.`);
  }
  if (gaps.length > 0 || sinceLast) {
    sentences.push(
      'Time between jobs is common. If you want to, one short honest line can say what it was, such as caregiving, study, or a layoff.'
    );
  }
  if (olderRoles.length > 0) {
    sentences.push(
      olderRoles.length === 1
        ? `1 role ended more than ${OLDER_YEARS} years ago: ${olderRoles[0].heading}.`
        : `${olderRoles.length} roles ended more than ${OLDER_YEARS} years ago, the most recent of them in ${Math.max(...olderRoles.map((role) => role.endYear))}.`
    );
    sentences.push(
      'People with long careers often shorten older roles to one line each, or group them under a heading such as Earlier experience.'
    );
  }
  return { gaps, olderRoles, sinceLast, readings, sentences };
}
