/**
 * Reads a resume (or letter) as typed lines, so the evidence check knows
 * which lines can show what. A degree line can show a degree but not a
 * warehouse system; an objective sentence can show neither, because it says
 * what the person wants, not what they did. Job title lines with dates are
 * grouped into roles, so years of experience can be counted from the dates
 * the resume gives instead of guessed.
 */

import { ACTION_VERBS as RESUME_ACTION_VERBS } from '../resume-game/constants';
import { ACTION_VERBS } from './lexicon';
import { splitSentences, trimmedSegment, wordCount } from './text';
import type { SourceSpan } from './types';

export type DocumentLineKind =
  /** Name, email, phone, links. */
  | 'contact'
  | 'heading'
  /** A summary, profile, or objective sentence: what the person wants or says about themselves. */
  | 'summary'
  | 'education'
  | 'certification'
  /** A skills list. Evidence, but listed rather than shown in use. */
  | 'skills'
  /** A job title, organization, or date line. */
  | 'title'
  /** An achievement, duty, or project line. */
  | 'experience'
  /** A short line that is none of the above. */
  | 'other';

export interface DocumentLine extends SourceSpan {
  text: string;
  kind: DocumentLineKind;
  /** True for skills lists ("Skills: Python, SQL"), which list rather than show. */
  listedOnly: boolean;
  /** Index into `roles` when the line belongs to a dated role. */
  role: number | null;
}

export interface MonthStamp {
  year: number;
  /** 1 to 12. */
  month: number;
}

export interface DatedRole extends SourceSpan {
  /** The title and date lines that head the role, joined. */
  heading: string;
  /** Offsets of the heading lines. */
  headingSpan: SourceSpan;
  from: MonthStamp;
  to: MonthStamp;
  /** True when the range ends in "present", "current", or "now". */
  ongoing: boolean;
}

export interface ReadDocument {
  lines: DocumentLine[];
  roles: DatedRole[];
}

export interface ReadOptions {
  /** What "present" means. Defaults to now. */
  today?: Date;
}

/** The kind of section a heading opens. */
export type ResumeSectionKind =
  | 'summary'
  | 'education'
  | 'skills'
  | 'certification'
  | 'experience'
  | 'other';
type Section = ResumeSectionKind | null;

const GLYPH = /^[•\-*◦○●‣⁃▪■–—·]\s*/;
const EMAIL = /\S+@\S+\.\S+/;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
const URL = /\b(?:https?:\/\/|www\.|linkedin\.com|github\.com)/i;
const EDUCATION_WORDS =
  /\b(?:university|college|institute|academy|bachelor|master|associate of|associate'?s|gpa|dean'?s list|honou?r roll|high school|diploma|ged|expected (?:graduation|grad|may|june|december)|class of|cum laude|coursework)\b/i;
/** Degree abbreviations, in capitals only: "B.S.", "BA", "MBA". */
const DEGREE_ABBREVIATION =
  /\b(?:B\.\s?[AS]\.?|M\.\s?[AS]\.?|BA|BS|BSc|B\.Sc|MA|MS|MSc|M\.Sc|MBA|AAS|A\.A\.S?|Ph\.?D)(?![A-Za-z])/;
const EDUCATION = {
  test: (line: string) => EDUCATION_WORDS.test(line) || DEGREE_ABBREVIATION.test(line),
};
const SKILLS_LABEL =
  /^(?:technical\s+|computer\s+|core\s+|relevant\s+|key\s+)?(?:skills|tools|technologies|software|languages|proficiencies|competencies)\b[^:\n]{0,30}:/i;
const JOB_TITLE_WORDS =
  /\b(?:intern|internship|assistant|associate|analyst|coordinator|specialist|manager|supervisor|engineer|developer|designer|consultant|representative|volunteer|tutor|cashier|barista|server|clerk|technician|fellow|president|treasurer|secretary|captain|member|founder|lead|director|officer|agent|attendant|host|cook|crew|guide|aide|counselor|mentor|leader)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
  spring: 3,
  summer: 6,
  fall: 9,
  autumn: 9,
  winter: 12,
};

const MONTH_WORD =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter';
const POINT = `(?:(${MONTH_WORD})\\.?\\s+|(\\d{1,2})\\/)?((?:19|20)\\d{2})`;
const DATE_RANGE = new RegExp(
  `${POINT}\\s*(?:-|–|—|to|until|through)\\s*(?:${POINT}|(present|current|now|today))`,
  'i'
);
const ANY_DATE = new RegExp(
  `\\b(?:${MONTH_WORD})\\.?\\s+(?:19|20)\\d{2}\\b|\\b(?:19|20)\\d{2}\\b`,
  'i'
);

/** What a heading line opens: "CORE SKILLS" opens a skills list. */
export function sectionOf(heading: string): ResumeSectionKind {
  const key = heading
    .toLowerCase()
    .replace(/[:\s]+$/, '')
    .trim();
  if (
    /^(?:professional\s+|career\s+)?(?:summary|objective|profile|about(?: me)?|highlights?|overview)$/.test(
      key
    )
  )
    return 'summary';
  if (/^(?:education|academics?|academic background|education and training)$/.test(key))
    return 'education';
  if (
    /^(?:(?:technical|computer|core|key|relevant|additional)\s+)?(?:skills|competencies|tools|technologies|software|languages|proficiencies|strengths)(?:\s*(?:and|&|,)\s*[a-z]+){0,2}$/.test(
      key
    ) ||
    /^(?:(?:areas?|fields?)\s+of\s+)?expertise$|^skill\s*set$/.test(key)
  )
    return 'skills';
  if (
    /^(?:certifications?|licenses?(?:\s*(?:and|&)\s*certifications?)?|credentials|training)$/.test(
      key
    )
  )
    return 'certification';
  if (
    /(?:experience|employment|work history|history|projects?|volunteer(?:ing)?|leadership|activities|involvement|research|internships?|accomplishments|achievements|service)$/.test(
      key
    )
  )
    return 'experience';
  return 'other';
}

/** True for a short line that opens a section: "EXPERIENCE", "Skills:", "Core Skills". */
export function looksLikeHeading(line: string): boolean {
  const words = wordCount(line);
  if (words === 0 || words > 4 || GLYPH.test(line)) return false;
  if (/:\s*$/.test(line)) return true;
  if (/[A-Z]/.test(line) && line === line.toUpperCase() && !/\d/.test(line)) return true;
  return sectionOf(line) !== 'other' && !/[.,;]/.test(line);
}

const IRREGULAR_PAST = new Set([
  'led',
  'ran',
  'built',
  'wrote',
  'made',
  'taught',
  'drove',
  'kept',
  'oversaw',
  'sold',
  'grew',
  'won',
  'cut',
  'set',
  'put',
  'took',
  'gave',
  'brought',
  'began',
  'found',
  'held',
  'met',
  'spoke',
  'chose',
  'sent',
  'spent',
  'paid',
  'read',
]);

/** Openings that say someone took part without naming an action of their own. */
const INVOLVEMENT_VERBS = [
  'helped',
  'supported',
  'assisted',
  'participated',
  'worked',
  'involved',
  'handled',
  'performed',
  'responsible',
  'aided',
  'volunteered',
  'served',
  'attended',
  'member',
  'tasked',
  'contributed',
];

const LISTED_VERBS = new Set(
  [...RESUME_ACTION_VERBS, ...INVOLVEMENT_VERBS].map((verb) => verb.toLowerCase())
);

/** True when a line opens with something a person did ("Coordinated", "Ran", "Answer"). */
export function startsWithAction(line: string): boolean {
  const first = (line.match(/^[A-Za-z]+/)?.[0] ?? '').toLowerCase();
  if (!first) return false;
  // A word list, on purpose. The Resume Game's looser check also accepts any
  // word shaped like a past tense, which reads "Advanced Excel skills" as an
  // action and turns a tool requirement into a task.
  if (LISTED_VERBS.has(first) || IRREGULAR_PAST.has(first) || ACTION_VERBS.has(first)) return true;
  const bases = [
    first.replace(/ied$/, 'y'),
    first.replace(/ed$/, ''),
    first.replace(/d$/, ''),
    first.replace(/ing$/, ''),
    first.replace(/ing$/, 'e'),
    first.replace(/([bdgmnpt])\1ed$/, '$1'),
    first.replace(/s$/, ''),
  ];
  return bases.some((base) => base.length >= 3 && ACTION_VERBS.has(base));
}

const OBJECTIVE =
  /^(?:objective\s*:|seeking\b|looking\s+(?:to|for)\b|to\s+obtain\b|aspiring\b|i\s+am\s+(?:seeking|looking|eager)\b|eager\s+to\b|hoping\s+to\b)/i;

function classifyLine(
  line: string,
  section: Section,
  index: number,
  nextLine: string | undefined
): DocumentLineKind {
  if (EMAIL.test(line) || PHONE.test(line) || URL.test(line)) return 'contact';
  // A first line in title case with no digits is the name: "Jordan Rivera".
  if (
    index === 0 &&
    wordCount(line) <= 4 &&
    !/\d/.test(line) &&
    !GLYPH.test(line) &&
    line.split(/\s+/).every((word) => /^[A-Z]/.test(word))
  ) {
    return 'contact';
  }
  const bare = line.replace(GLYPH, '');
  if (section === 'summary' || OBJECTIVE.test(bare)) return 'summary';
  if (section === 'education') return 'education';
  if (section === 'certification') return 'certification';
  if (section === 'skills' || SKILLS_LABEL.test(bare)) return 'skills';
  if (GLYPH.test(line)) return 'experience';
  const words = wordCount(line);
  // "Lead Software Engineer | Jan 2020 - Jan 2025" starts with a word that is
  // also a verb. A short line with a date range and a job title, a separator,
  // or no sentence in it is a job heading, not an achievement.
  const datedTitle =
    DATE_RANGE.test(line) &&
    words <= 14 &&
    !/[.;]$/.test(line) &&
    (JOB_TITLE_WORDS.test(line) || /\s\|\s/.test(line));
  const action = startsWithAction(line) && !datedTitle;
  if (!action && words <= 14 && (DATE_RANGE.test(line) || (ANY_DATE.test(line) && words <= 10))) {
    // "Library Assistant, State University | Jan 2024 - Dec 2025" is a job:
    // under Experience, or with a job title in it, the employer's name does
    // not make it schooling.
    const job = section === 'experience' || JOB_TITLE_WORDS.test(withoutDegreeNames(line));
    return EDUCATION.test(line) && !job ? 'education' : 'title';
  }
  if (!action && EDUCATION.test(line) && words <= 14 && section !== 'experience')
    return 'education';
  if (
    !action &&
    words <= 12 &&
    !/[.;]$/.test(line) &&
    /[,|]|\s[-–—]\s/.test(line) &&
    (JOB_TITLE_WORDS.test(line) ||
      (nextLine !== undefined && DATE_RANGE.test(nextLine) && wordCount(nextLine) <= 8))
  ) {
    return 'title';
  }
  if (!action && words < 6) return 'other';
  return 'experience';
}

/** "Associate in Business" is a degree, not a job title. */
function withoutDegreeNames(line: string): string {
  return line.replace(/\bassociate(?:['’]?s)?\s+(?:degree|of|in)\b/gi, ' ');
}

function stampOf(monthWord: string | undefined, monthNumber: string | undefined, year: string) {
  const month = monthWord
    ? (MONTHS[monthWord.toLowerCase().replace(/\.$/, '')] ??
      MONTHS[monthWord.toLowerCase().slice(0, 3)] ??
      1)
    : monthNumber
      ? Math.min(Math.max(Number(monthNumber), 1), 12)
      : 1;
  return { year: Number(year), month };
}

/** The first date range in `text`, or null. Missing months count from January. */
export function readDateRange(
  text: string,
  today: Date = new Date()
): { from: MonthStamp; to: MonthStamp; ongoing: boolean } | null {
  const match = text.match(DATE_RANGE);
  if (!match) return null;
  const from = stampOf(match[1], match[2], match[3]);
  const now: MonthStamp = { year: today.getFullYear(), month: today.getMonth() + 1 };
  const months = (stamp: MonthStamp) => stamp.year * 12 + stamp.month;
  // A role that has not started yet is not experience.
  if (months(from) > months(now)) return null;
  if (match[7]) return { from, to: now, ongoing: true };
  const to = stampOf(match[4], match[5], match[6]);
  if (months(to) < months(from)) return null;
  // An expected end date ("Jan 2025 - Dec 2027") counts only up to this month.
  if (months(to) > months(now)) return { from, to: now, ongoing: true };
  return { from, to, ongoing: false };
}

/** Long lines (letter paragraphs) are cut into sentences so excerpts stay readable. */
const MAX_EXCERPT_LINE = 240;

/**
 * Every non-empty line of `text` with its kind, and the roles that carry a
 * readable date range. A role is a run of title and date lines followed by
 * the lines under it, up to the next title block or heading.
 */
export function readDocument(text: string, options: ReadOptions = {}): ReadDocument {
  const today = options.today ?? new Date();
  // The coverage view reads the same resume once per requirement; keep the last reading.
  const monthKey = today.getFullYear() * 12 + today.getMonth();
  if (lastRead && lastRead.text === text && lastRead.monthKey === monthKey) return lastRead.result;
  const result = readDocumentUncached(text, today);
  lastRead = { text, monthKey, result };
  return result;
}

let lastRead: { text: string; monthKey: number; result: ReadDocument } | null = null;

function readDocumentUncached(text: string, today: Date): ReadDocument {
  const raw: { start: number; end: number; text: string }[] = [];
  let lineStart = 0;
  while (lineStart <= text.length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    const segment = trimmedSegment(text, lineStart, lineEnd);
    if (segment) raw.push(segment);
    lineStart = lineEnd + 1;
  }

  const lines: DocumentLine[] = [];
  const roles: DatedRole[] = [];
  let section: Section = null;
  let block: DocumentLine[] = [];
  let currentRole: number | null = null;

  const closeBlock = () => {
    if (block.length === 0) return;
    const heading = block.map((l) => l.text).join(' ');
    const range = readDateRange(heading, today);
    if (range) {
      const headingSpan = { start: block[0].start, end: block[block.length - 1].end };
      roles.push({ ...headingSpan, heading, headingSpan, ...range });
      currentRole = roles.length - 1;
      for (const l of block) l.role = currentRole;
    } else {
      currentRole = null;
    }
    block = [];
  };

  raw.forEach((line, index) => {
    if (looksLikeHeading(line.text)) {
      closeBlock();
      currentRole = null;
      section = sectionOf(line.text);
      lines.push({ ...line, kind: 'heading', listedOnly: false, role: null });
      return;
    }
    const kind = classifyLine(line.text, section, index, raw[index + 1]?.text);
    const listedOnly = kind === 'skills';
    if (kind === 'title') {
      // A job with no bullets, followed straight away by another job: two
      // headings with their own dates are two jobs. A title on one line and
      // its dates on the next are still one.
      if (
        readDateRange(line.text, today) &&
        readDateRange(block.map((l) => l.text).join(' '), today)
      ) {
        closeBlock();
      }
      const entry: DocumentLine = { ...line, kind, listedOnly, role: null };
      block.push(entry);
      lines.push(entry);
      return;
    }
    closeBlock();
    if (kind === 'contact' || kind === 'summary' || kind === 'education') currentRole = null;
    const pieces =
      line.end - line.start > MAX_EXCERPT_LINE
        ? splitSentences(text, line.start, line.end)
        : [line];
    for (const piece of pieces) {
      lines.push({
        ...piece,
        kind,
        listedOnly,
        role: kind === 'experience' ? currentRole : null,
      });
    }
  });
  closeBlock();

  for (let i = 0; i < roles.length; i++) {
    const owned = lines.filter((l) => l.role === i);
    roles[i].end = owned.length ? owned[owned.length - 1].end : roles[i].end;
  }
  return { lines, roles };
}

/** Months covered by a set of ranges, counting overlaps once. */
export function monthsCovered(ranges: { from: MonthStamp; to: MonthStamp }[]): number {
  const covered = new Set<number>();
  for (const { from, to } of ranges) {
    const a = from.year * 12 + from.month;
    const b = to.year * 12 + to.month;
    for (let m = a; m < b; m++) covered.add(m);
  }
  return covered.size;
}

/**
 * A clause that says the work was not done, or is only planned: "Never used
 * Python", "No experience with SQL yet", "Planning to learn Excel next
 * semester". The cue must open a clause, so "Tutored students who wanted to
 * learn Python" still shows Python. "Never missed a shift" is a result, not
 * a denial.
 */
const NOT_DONE = new RegExp(
  [
    '(?:^|[.;:!?]\\s*|,\\s*(?:(?:and|but)\\s+)?|\\s(?:and|but|though|although|yet)\\s+)',
    "(?:i\\s+(?:am\\s+|'m\\s+|have\\s+|'ve\\s+|had\\s+|will\\s+|would\\s+)?)?(?:currently\\s+|still\\s+)?",
    '(?:',
    [
      'never(?!\\s+(?:missed|miss|late|lost|failed|had\\s+an?\\s+(?:error|complaint|incident|accident)|been\\s+late))',
      'not\\s+yet',
      'no\\s+(?:prior\\s+|previous\\s+|formal\\s+|professional\\s+|real\\s+|hands-on\\s+|direct\\s+)?(?:experience|exposure|background|knowledge|training|familiarity)',
      "(?:have|has|had|did|do|does|could|can|was|were)\\s*(?:not|n't)",
      "(?:haven|hasn|hadn|didn|don|doesn|couldn|can|wasn|weren)['’]t",
      'cannot',
      'unable\\s+to',
      'plan(?:s|ning|ned)?\\s+to',
      'will\\s+(?:be\\s+)?(?:learn|learning|take|taking|start|starting|study|studying|use|using|begin|beginning)',
      'going\\s+to',
      'hop(?:e|es|ing)\\s+to',
      'want(?:s|ing)?\\s+to',
      'would\\s+like\\s+to',
      'aim(?:s|ing)?\\s+to',
      'intend(?:s|ing)?\\s+to',
      'looking\\s+forward\\s+to',
      'eager\\s+to',
      'wish(?:es)?\\s+to',
      'interested\\s+in\\s+learning',
    ].join('|'),
    ')\\b',
  ].join(''),
  'gi'
);

/**
 * Spans of `text` that say something was not done or is only planned, from
 * the cue to the end of its sentence. Matches inside them are not evidence.
 */
export function notDoneSpans(text: string): SourceSpan[] {
  const spans: SourceSpan[] = [];
  let lineStart = 0;
  while (lineStart <= text.length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    const raw = text.slice(lineStart, lineEnd);
    const glyph = raw.match(/^\s*(?:[•\-*◦○●‣⁃▪■–—·]\s*)?/)?.[0].length ?? 0;
    const line = raw.slice(glyph);
    for (const match of line.matchAll(NOT_DONE)) {
      const from = (match.index ?? 0) + match[0].search(/\S/);
      const stop = line.slice(from).search(/[.;!?](?:\s|$)/);
      const to = stop >= 0 ? from + stop : line.length;
      spans.push({ start: lineStart + glyph + from, end: lineStart + glyph + to });
    }
    lineStart = lineEnd + 1;
  }
  return spans;
}

const DATE_POINT = new RegExp(
  `\\b(?:(${MONTH_WORD})\\.?\\s+|(\\d{1,2})\\/)?((?:19|20)\\d{2})\\b`,
  'gi'
);

/** Every month or year a line names, in reading order. Missing months count from January. */
export function datePoints(text: string): MonthStamp[] {
  return [...text.matchAll(DATE_POINT)].map((m) => stampOf(m[1], m[2], m[3]));
}

const IN_PROGRESS =
  /\b(?:expected|anticipated|candidate|in progress|pursuing|currently|enrolled|present|ongoing|to date|working toward)\b/i;

/**
 * True when an education line describes study that is not finished: it says
 * "expected", "in progress", or "present", or its latest date is after today.
 */
export function educationInProgress(line: string, today: Date = new Date()): boolean {
  if (IN_PROGRESS.test(line)) return true;
  const points = datePoints(line);
  if (points.length === 0) return false;
  const latest = Math.max(...points.map((p) => p.year * 12 + p.month));
  return latest > today.getFullYear() * 12 + today.getMonth() + 1;
}
