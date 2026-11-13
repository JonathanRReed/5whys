/**
 * A factual note about the dates on a resume: gaps of more than six months
 * between dated roles, and roles that ended more than fifteen years ago.
 * Information only. It never changes a score, and it never says a gap or a
 * long career is a problem; each fact comes with one plain sentence on what
 * people commonly do. Roles are read by the same reader that counts years of
 * experience against a posting (posting/resume-lines.ts), so the two agree.
 */
import { type MonthStamp, readDocument } from '../posting/resume-lines';

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
  /** Plain sentences for the report, in order. */
  sentences: string[];
}

const key = (stamp: MonthStamp) => stamp.year * 12 + (stamp.month - 1);
const label = (stamp: MonthStamp, monthKnown: boolean) =>
  monthKnown ? `${MONTH_NAMES[stamp.month - 1]} ${stamp.year}` : String(stamp.year);

/**
 * The dates note for a resume, or null when there is nothing to say: fewer
 * than two dated roles and none older than fifteen years.
 */
export function readDatesNote(text: string, today: Date = new Date()): DatesNote | null {
  const roles = readDocument(text, { today }).roles.map((role) => {
    const monthKnown = NAMES_A_MONTH.test(role.heading);
    // "2008 - 2015" could mean any month of either year: read it as widely as
    // it allows, so a gap is only listed when the resume's own dates show it.
    const start = monthKnown ? key(role.from) : role.from.year * 12;
    const end = monthKnown || role.ongoing ? key(role.to) : role.to.year * 12 + 11;
    return { role, monthKnown, start, end };
  });
  if (roles.length === 0) return null;

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

  const now = today.getFullYear() * 12 + today.getMonth();
  const olderRoles: OlderRole[] = ordered
    .filter((entry) => !entry.role.ongoing && now - entry.end > OLDER_YEARS * 12)
    .map((entry) => ({
      heading: entry.role.heading.replace(/\s+/g, ' ').trim(),
      endYear: entry.role.to.year,
    }));

  if (gaps.length === 0 && olderRoles.length === 0) return null;

  const sentences: string[] = [];
  for (const gap of gaps) {
    sentences.push(`No role is listed between ${gap.after} and ${gap.before}.`);
  }
  if (gaps.length > 0) {
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
  return { gaps, olderRoles, sentences };
}
