import { buildBullet } from './analysis';
import { gerundToPast, isVerbWord, pastTenseOf } from './verbs';

/**
 * A first resume, built from nothing. The visitor answers a few short
 * questions and this module arranges their words into plain resume text: a
 * name, a contact line, Education, Experience with bullets, and Skills. It
 * never adds a word the visitor did not type, and an empty optional part is
 * left out.
 *
 * The text is written in the shape every reader in the studio already
 * understands, so it is used exactly like a pasted resume:
 *
 *   Maya Torres
 *   maya@example.com | (559) 555-0142 | Fresno, CA
 *
 *   EDUCATION
 *   Fresno City College | Business, expected May 2027
 *
 *   EXPERIENCE
 *   Cashier, FreshWay Market | Jun 2024 - Present
 *   - Counted my cash drawer at close, so my drawer was never short.
 *
 *   SKILLS
 *   Spanish, Google Sheets
 *
 * Bullets carry a "- " mark, which the Resume Game's structure reader, the
 * resume document model, and the posting evidence reader all treat as an
 * achievement line. A role's title and dates sit on one line with " | "
 * before the dates, which the posting reader groups into a dated role.
 */

/** The fewest digits a phone number can have and still be dialled. */
export const MIN_PHONE_DIGITS = 7;

export type ExperienceKind =
  | 'job'
  | 'sitting'
  | 'club'
  | 'volunteer'
  | 'project'
  | 'family'
  | 'other';

export interface DraftLine {
  /** One action word: "Balanced", "Trained". */
  verb: string;
  /** What you did: "my cash drawer at close". */
  task: string;
  /** What happened because of it. Optional, and it does not have to be a number. */
  impact: string;
}

export interface DraftExperience {
  kind: ExperienceKind;
  role: string;
  where: string;
  /** As typed: "June 2024", "6/2024", "2024". Normalized when the resume is built. */
  start: string;
  end: string;
  /** Still doing it: the dates end in "Present". */
  current: boolean;
  lines: DraftLine[];
}

export interface ResumeDraft {
  /** Whether the form was open when it was last changed, so a reload returns to it. */
  open: boolean;
  /** Index into DRAFT_STEPS. */
  step: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  /** True when the visitor chose to leave school out. */
  skipSchool: boolean;
  school: string;
  study: string;
  /** When school ends or ended, as typed. */
  finish: string;
  experiences: DraftExperience[];
  skills: string;
}

export const DRAFT_STEPS = [
  { id: 'you', title: 'You' },
  { id: 'school', title: 'School or training' },
  { id: 'experience', title: 'Experience' },
  { id: 'skills', title: 'Skills' },
] as const;

export type DraftStepId = (typeof DRAFT_STEPS)[number]['id'];

export const MAX_EXPERIENCES = 3;
export const MAX_LINES = 3;
/** Each experience starts with room for two lines; a third can be added. */
const STARTING_LINES = 2;

export const emptyLine = (): DraftLine => ({ verb: '', task: '', impact: '' });

export const emptyExperience = (kind: ExperienceKind = 'job'): DraftExperience => ({
  kind,
  role: '',
  where: '',
  start: '',
  end: '',
  current: false,
  lines: Array.from({ length: STARTING_LINES }, emptyLine),
});

export const emptyDraft = (): ResumeDraft => ({
  open: true,
  step: 0,
  name: '',
  email: '',
  phone: '',
  city: '',
  skipSchool: false,
  school: '',
  study: '',
  finish: '',
  experiences: [emptyExperience()],
  skills: '',
});

/** Gentle, concrete examples for each kind of experience, in the student register. */
export const EXPERIENCE_KINDS: Record<
  ExperienceKind,
  {
    label: string;
    role: string;
    where: string;
    lines: [DraftLine, DraftLine];
  }
> = {
  job: {
    label: 'A job',
    role: 'Cashier',
    where: 'FreshWay Market',
    lines: [
      {
        verb: 'Counted',
        task: 'my cash drawer at close',
        impact: 'my drawer was never short',
      },
      {
        verb: 'Stocked',
        task: 'the dairy shelves before opening',
        impact: 'shelves were full when doors opened',
      },
    ],
  },
  sitting: {
    label: 'Babysitting or pet sitting',
    role: 'Babysitter',
    where: 'Neighborhood families',
    lines: [
      {
        verb: 'Watched',
        task: 'three kids on weekend evenings',
        impact: 'their parents could work late shifts',
      },
      { verb: 'Kept', task: 'a list of allergies and bedtimes', impact: '' },
    ],
  },
  club: {
    label: 'A club or team',
    role: 'Treasurer',
    where: 'Robotics Club',
    lines: [
      {
        verb: 'Tracked',
        task: 'club spending in a shared sheet',
        impact: 'we stayed under budget',
      },
      {
        verb: 'Ran',
        task: 'the bake sale table',
        impact: 'we raised enough for the trip to state',
      },
    ],
  },
  volunteer: {
    label: 'Volunteering',
    role: 'Volunteer',
    where: 'Harbor Street Food Bank',
    lines: [
      {
        verb: 'Made',
        task: 'a sign-up sheet for weekend shifts',
        impact: 'new volunteers stopped missing shifts',
      },
      { verb: 'Sorted', task: 'donations by date', impact: 'less food was thrown out' },
    ],
  },
  project: {
    label: 'A class project',
    role: 'Team member',
    where: 'Intro to Business',
    lines: [
      { verb: 'Wrote', task: "the survey for our group's market study", impact: '' },
      {
        verb: 'Presented',
        task: 'our findings to the class',
        impact: 'our group was picked to present again',
      },
    ],
  },
  family: {
    label: 'Caring for family',
    role: 'Family caregiver',
    where: '',
    lines: [
      {
        verb: 'Picked up',
        task: 'my two younger brothers from school every weekday',
        impact: 'my parents could keep their work hours',
      },
      { verb: 'Planned', task: 'weekday dinners and the grocery list', impact: '' },
    ],
  },
  other: {
    label: 'Something else',
    role: 'Lawn care',
    where: 'Neighbors on my street',
    lines: [
      {
        verb: 'Mowed',
        task: 'four lawns every Saturday in summer',
        impact: 'two neighbors asked me back the next year',
      },
      { verb: 'Raked', task: 'leaves and bagged them each fall', impact: '' },
    ],
  },
};

const KINDS = Object.keys(EXPERIENCE_KINDS) as ExperienceKind[];

/** Placeholders for the school step. High school for a first job; college otherwise. */
export const SCHOOL_EXAMPLES = {
  college: { school: 'Fresno City College', study: 'Business', finish: 'May 2027' },
  highSchool: {
    school: 'Roosevelt High School',
    study: 'High school diploma',
    finish: 'June 2027',
  },
} as const;
export type SchoolExample = keyof typeof SCHOOL_EXAMPLES;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Array<[RegExp, string]> = [
  [/^jan(uary)?$/, 'Jan'],
  [/^feb(ruary)?$/, 'Feb'],
  [/^mar(ch)?$/, 'Mar'],
  [/^apr(il)?$/, 'Apr'],
  [/^may$/, 'May'],
  [/^june?$/, 'Jun'],
  [/^july?$/, 'Jul'],
  [/^aug(ust)?$/, 'Aug'],
  [/^sept?(ember)?$/, 'Sep'],
  [/^oct(ober)?$/, 'Oct'],
  [/^nov(ember)?$/, 'Nov'],
  [/^dec(ember)?$/, 'Dec'],
  [/^spring$/, 'Spring'],
  [/^summer$/, 'Summer'],
  [/^(fall|autumn)$/, 'Fall'],
  [/^winter$/, 'Winter'],
];
const MONTH_NUMBER = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_INDEX: Record<string, number> = {
  ...Object.fromEntries(MONTH_NUMBER.map((name, index) => [name, index + 1])),
  Spring: 3,
  Summer: 6,
  Fall: 9,
  Winter: 12,
};

export interface MonthYear {
  /** "Jun 2024", "Summer 2024", or "2024". */
  text: string;
  year: number;
  /** 1 to 12; a bare year counts from January. */
  month: number;
}

/**
 * Reads a date as a student might type it: "June 2024", "Jun. 2024",
 * "6/2024", "Fall 2025", or just "2024". The year needs four digits.
 * Returns null when the date cannot be read.
 */
export function readMonthYear(raw: string): MonthYear | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (!value) return null;
  const numeric = value.match(/^(\d{1,2})\s*[/-]\s*((?:19|20)\d{2})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month < 1 || month > 12) return null;
    return { text: `${MONTH_NUMBER[month - 1]} ${numeric[2]}`, year: Number(numeric[2]), month };
  }
  const worded = value.match(/^([A-Za-z]+)\.?,?\s+((?:19|20)\d{2})$/);
  if (worded) {
    const word = worded[1].toLowerCase();
    const name = MONTHS.find(([pattern]) => pattern.test(word))?.[1];
    if (!name) return null;
    return { text: `${name} ${worded[2]}`, year: Number(worded[2]), month: MONTH_INDEX[name] };
  }
  const year = value.match(/^((?:19|20)\d{2})$/);
  if (year) return { text: year[1], year: Number(year[1]), month: 1 };
  return null;
}

const monthsOf = (date: MonthYear) => date.year * 12 + date.month;

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * One bullet in the visitor's words, through the Resume Game's own builder.
 * The result always joins after "so", which the form shows beside the field:
 * "Counted my drawer at close, so it was never short." A "so" the
 * visitor typed themselves is not doubled.
 */
export function draftBullet(line: DraftLine): string {
  if (!clean(line.verb) && !clean(line.task)) return '';
  const result = clean(line.impact).replace(/^so\b[,\s]*/i, '');
  return buildBullet({
    verb: clean(line.verb),
    task: clean(line.task),
    impact: result ? `so ${result}` : '',
    quantifier: '',
  });
}

/** "Jun 2024 - Present", "2023 - 2024", or "" when no start date was given. */
export function dateRange(experience: DraftExperience): string {
  const start = readMonthYear(experience.start);
  if (!start) return '';
  if (experience.current) return `${start.text} - Present`;
  const end = readMonthYear(experience.end);
  return end ? `${start.text} - ${end.text}` : start.text;
}

/** "Cashier, FreshWay Market | Jun 2024 - Present". */
export function experienceHeading(experience: DraftExperience): string {
  const title = [clean(experience.role), clean(experience.where)].filter(Boolean).join(', ');
  const dates = dateRange(experience);
  return [title, dates].filter(Boolean).join(' | ');
}

function educationLine(draft: ResumeDraft, today: Date): string {
  if (draft.skipSchool) return '';
  const school = clean(draft.school);
  const study = clean(draft.study);
  const finish = readMonthYear(draft.finish);
  if (!school && !study) return '';
  const now = today.getFullYear() * 12 + today.getMonth() + 1;
  const when = finish ? (monthsOf(finish) > now ? `expected ${finish.text}` : finish.text) : '';
  const detail = [study, when].filter(Boolean).join(', ');
  return [school, detail].filter(Boolean).join(' | ');
}

export interface ResumeOutline {
  name: string;
  /** Email, phone, and city, joined with " | ". */
  contact: string;
  education: string;
  experiences: { heading: string; bullets: string[] }[];
  skills: string;
}

/** The resume's parts in the visitor's words, with every empty part left out. */
export function resumeOutline(draft: ResumeDraft, today: Date = new Date()): ResumeOutline {
  return {
    name: clean(draft.name),
    contact: [clean(draft.email), clean(draft.phone), clean(draft.city)]
      .filter(Boolean)
      .join(' | '),
    education: educationLine(draft, today),
    experiences: draft.experiences
      .map((experience) => ({
        heading: experienceHeading(experience),
        bullets: experience.lines.map(draftBullet).filter(Boolean),
      }))
      .filter((experience) => experience.heading || experience.bullets.length > 0),
    skills: clean(draft.skills),
  };
}

/**
 * The resume as plain text. Sections with nothing in them are left out, and
 * so is every empty optional part of a line.
 */
export function assembleResume(draft: ResumeDraft, today: Date = new Date()): string {
  const outline = resumeOutline(draft, today);
  const blocks: string[] = [];
  const top = [outline.name, outline.contact].filter(Boolean).join('\n');
  if (top) blocks.push(top);
  if (outline.education) blocks.push(`EDUCATION\n${outline.education}`);
  if (outline.experiences.length > 0) {
    const roles = outline.experiences.map((experience) =>
      [experience.heading, ...experience.bullets.map((bullet) => `- ${bullet}`)]
        .filter(Boolean)
        .join('\n')
    );
    blocks.push(`EXPERIENCE\n${roles.join('\n\n')}`);
  }
  if (outline.skills) blocks.push(`SKILLS\n${outline.skills}`);
  return blocks.join('\n\n');
}

/** A file name from the visitor's name: "maya-torres-resume". */
export function resumeFileBase(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');
  return slug ? `${slug}-resume` : 'resume';
}

// ---------------------------------------------------------------------------
// The action word
// ---------------------------------------------------------------------------

// Small words that belong to the verb: "Picked up", "Helped out", "Set up".
const PARTICLE = /^(?:up|out|off|in|on|over|down|back|away|through)$/i;

/**
 * A whole sentence typed into the one-word field: "i watch my cousin after
 * school". Returns the action word and the rest, which belongs in "What you
 * did". A leading "I" is dropped. Null when the field already holds one
 * action (a verb, or a verb and its small word: "Picked up").
 */
export function splitActionWord(raw: string): { verb: string; rest: string } | null {
  const words = clean(raw).split(' ').filter(Boolean);
  if (words.length > 1 && /^i$/i.test(words[0])) words.shift();
  if (words.length <= 1) {
    return words.length === 1 && words[0] !== clean(raw) ? { verb: words[0], rest: '' } : null;
  }
  const take = PARTICLE.test(words[1]) ? 2 : 1;
  if (words.length <= take) return null;
  return { verb: words.slice(0, take).join(' '), rest: words.slice(take).join(' ') };
}

/** "watch" -> "Watched", "Picked up" -> "Picked up": the word as an example. */
function exampleVerb(verb: string): string {
  const [first, ...rest] = verb.split(' ');
  const shown = pastTenseOf(first) ?? first.slice(0, 1).toUpperCase() + first.slice(1);
  return [shown, ...rest].join(' ');
}

/** What the form can offer about the action word, never blocking. */
export type ActionWordAdvice =
  | { kind: 'past'; word: string; past: string }
  | { kind: 'not-a-verb'; word: string };

/**
 * A gentle offer about the action word, read with the same verb list the
 * scorer uses. "watch" for something that is over: "Watched?". "babysitting":
 * "Babysat?". A word the scorer would not read as an action is named, so the
 * visitor is not surprised one screen later.
 */
export function actionWordAdvice(raw: string, current: boolean): ActionWordAdvice | null {
  const word = clean(raw).split(' ')[0] ?? '';
  if (!word || !/^[a-z-]+$/i.test(word)) return null;
  const gerund = gerundToPast(word);
  if (gerund && /ing$/i.test(word)) return { kind: 'past', word, past: gerund };
  if (!isVerbWord(word)) return { kind: 'not-a-verb', word };
  if (current) return null;
  const past = pastTenseOf(word);
  return past && past.toLowerCase() !== word.toLowerCase() ? { kind: 'past', word, past } : null;
}

// ---------------------------------------------------------------------------
// Capital letters
// ---------------------------------------------------------------------------

const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'at', 'in', 'on', 'to', 'a', 'an', 'or']);

/** "roosevelt high" -> "Roosevelt High"; "member, robotics team" -> "Member, Robotics Team". */
export function capitalizeName(value: string): string {
  let first = true;
  return value.replace(/[A-Za-z][A-Za-z'’-]*/g, (word) => {
    const keep = !first && SMALL_WORDS.has(word.toLowerCase());
    first = false;
    return keep ? word : word.slice(0, 1).toUpperCase() + word.slice(1);
  });
}

/** One field typed all in lowercase, with how it would read capitalized. */
export interface CapitalFix {
  field: string;
  label: string;
  from: string;
  to: string;
}

// Email addresses and phone numbers are never touched; only names are.
const needsCapitals = (value: string) => /[a-z]/.test(value) && !/[A-Z]/.test(value);

/**
 * Names typed in lowercase on a phone: the visitor's name, the school, the
 * city, each role and where it was. A check the visitor runs with one tap;
 * nothing changes without it.
 */
export function capitalFixes(draft: ResumeDraft): CapitalFix[] {
  const fixes: CapitalFix[] = [];
  const add = (field: string, label: string, value: string) => {
    const from = clean(value);
    if (!from || !needsCapitals(from)) return;
    const to = capitalizeName(from);
    if (to !== from) fixes.push({ field, label, from, to });
  };
  add(fieldId.name, 'Your name', draft.name);
  add(fieldId.city, 'City', draft.city);
  if (!draft.skipSchool) add(fieldId.school, 'School', draft.school);
  draft.experiences.forEach((experience, index) => {
    add(fieldId.role(index), 'Role', experience.role);
    add(fieldId.where(index), 'Where', experience.where);
  });
  return fixes;
}

/** The draft with every name in capitalFixes capitalized. */
export function applyCapitalFixes(draft: ResumeDraft): ResumeDraft {
  const fix = (value: string) =>
    needsCapitals(clean(value)) ? capitalizeName(clean(value)) : value;
  return {
    ...draft,
    name: fix(draft.name),
    city: fix(draft.city),
    school: draft.skipSchool ? draft.school : fix(draft.school),
    experiences: draft.experiences.map((experience) => ({
      ...experience,
      role: fix(experience.role),
      where: fix(experience.where),
    })),
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export interface DraftError {
  /** The id of the field the message belongs to. */
  field: string;
  message: string;
}

export const fieldId = {
  name: 'first-resume-name',
  email: 'first-resume-email',
  phone: 'first-resume-phone',
  city: 'first-resume-city',
  school: 'first-resume-school',
  study: 'first-resume-study',
  finish: 'first-resume-finish',
  skills: 'first-resume-skills',
  kind: (index: number) => `first-resume-exp-${index}-kind`,
  role: (index: number) => `first-resume-exp-${index}-role`,
  where: (index: number) => `first-resume-exp-${index}-where`,
  start: (index: number) => `first-resume-exp-${index}-start`,
  end: (index: number) => `first-resume-exp-${index}-end`,
  current: (index: number) => `first-resume-exp-${index}-current`,
  verb: (index: number, line: number) => `first-resume-exp-${index}-line-${line}-verb`,
  task: (index: number, line: number) => `first-resume-exp-${index}-line-${line}-task`,
  impact: (index: number, line: number) => `first-resume-exp-${index}-line-${line}-impact`,
};

const DATE_HINT = 'Write a month and year, like Jun 2024, or just the year.';

function checkYou(draft: ResumeDraft): DraftError[] {
  const errors: DraftError[] = [];
  if (!clean(draft.name)) errors.push({ field: fieldId.name, message: 'Add your name.' });
  const email = clean(draft.email);
  const phone = clean(draft.phone);
  if (!email && !phone) {
    errors.push({
      field: fieldId.email,
      message: 'Add an email or a phone number, so someone can reach you.',
    });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({
      field: fieldId.email,
      message: 'This email needs an @ and a domain, like name@example.com.',
    });
  }
  if (phone && (phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS || /[a-z]/i.test(phone))) {
    errors.push({
      field: fieldId.phone,
      message: `This phone number needs at least ${MIN_PHONE_DIGITS} digits.`,
    });
  }
  return errors;
}

function checkSchool(draft: ResumeDraft): DraftError[] {
  if (draft.skipSchool) return [];
  const errors: DraftError[] = [];
  if (!clean(draft.school) && (clean(draft.study) || clean(draft.finish))) {
    errors.push({ field: fieldId.school, message: 'Add the name of the school or program.' });
  }
  if (clean(draft.finish) && !readMonthYear(draft.finish)) {
    errors.push({ field: fieldId.finish, message: DATE_HINT });
  }
  return errors;
}

function checkExperiences(draft: ResumeDraft, today: Date): DraftError[] {
  const errors: DraftError[] = [];
  const now = today.getFullYear() * 12 + today.getMonth() + 1;
  let complete = 0;
  draft.experiences.forEach((experience, index) => {
    const lines = experience.lines.map((line) => ({
      verb: clean(line.verb),
      task: clean(line.task),
      impact: clean(line.impact),
    }));
    const anything =
      clean(experience.role) ||
      clean(experience.where) ||
      clean(experience.start) ||
      clean(experience.end) ||
      lines.some((line) => line.verb || line.task || line.impact);
    // An untouched extra experience is simply left out.
    if (!anything && index > 0) return;
    if (!clean(experience.role)) {
      errors.push({
        field: fieldId.role(index),
        message:
          'Add your role. If you had no title, a plain word works: Volunteer, Member, Caregiver.',
      });
    }
    const start = readMonthYear(experience.start);
    if (clean(experience.start) && !start) {
      errors.push({ field: fieldId.start(index), message: DATE_HINT });
    } else if (start && monthsOf(start) > now) {
      errors.push({ field: fieldId.start(index), message: 'This start date is in the future.' });
    }
    if (!experience.current) {
      const end = readMonthYear(experience.end);
      if (clean(experience.end) && !end) {
        errors.push({ field: fieldId.end(index), message: DATE_HINT });
      } else if (end && !start && !clean(experience.start)) {
        errors.push({ field: fieldId.start(index), message: 'Add when it started, too.' });
      } else if (start && end && monthsOf(end) < monthsOf(start)) {
        errors.push({ field: fieldId.end(index), message: 'This ends before it starts.' });
      } else if (start && !clean(experience.end)) {
        errors.push({
          field: fieldId.end(index),
          message: 'Add when it ended, or check "I still do this".',
        });
      }
    }
    let written = 0;
    let started = 0;
    lines.forEach((line, lineIndex) => {
      if (!line.verb && !line.task && !line.impact) return;
      started += 1;
      if (!line.verb) {
        errors.push({
          field: fieldId.verb(index, lineIndex),
          message: 'Start with one action word, like Ran, Made, or Trained.',
        });
      }
      if (!line.task) {
        // A whole sentence in the one-word box: say where the rest goes.
        const split = line.verb ? splitActionWord(line.verb) : null;
        errors.push(
          split?.rest
            ? {
                field: fieldId.verb(index, lineIndex),
                message: `Put only the first word here, like ${exampleVerb(split.verb)}. The rest goes in What you did.`,
              }
            : { field: fieldId.task(index, lineIndex), message: 'Add what you did.' }
        );
      }
      if (line.verb && line.task) written += 1;
    });
    // A line that is started already has its own message above.
    if (written === 0 && started === 0) {
      errors.push({
        field: fieldId.verb(index, 0),
        message: 'Write at least one line: an action word and what you did.',
      });
    } else if (written > 0) {
      complete += 1;
    }
  });
  if (complete === 0 && errors.length === 0) {
    errors.push({
      field: fieldId.role(0),
      message: 'Add one experience. A job, a club, volunteering, or caring for family all count.',
    });
  }
  return errors;
}

/** What still needs fixing on one step, in the order the fields appear. */
export function checkStep(
  draft: ResumeDraft,
  step: DraftStepId,
  today: Date = new Date()
): DraftError[] {
  switch (step) {
    case 'you':
      return checkYou(draft);
    case 'school':
      return checkSchool(draft);
    case 'experience':
      return checkExperiences(draft, today);
    case 'skills':
      return [];
  }
}

/** Every step's problems, with the step each belongs to. */
export function checkDraft(
  draft: ResumeDraft,
  today: Date = new Date()
): Array<DraftError & { step: number }> {
  return DRAFT_STEPS.flatMap((step, index) =>
    checkStep(draft, step.id, today).map((error) => ({ ...error, step: index }))
  );
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 2000) : '');

function normalizeLine(value: unknown): DraftLine {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return { verb: text(data.verb), task: text(data.task), impact: text(data.impact) };
}

function normalizeExperience(value: unknown): DraftExperience | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const lines = (Array.isArray(data.lines) ? data.lines : [])
    .slice(0, MAX_LINES)
    .map(normalizeLine);
  return {
    kind: KINDS.includes(data.kind as ExperienceKind) ? (data.kind as ExperienceKind) : 'job',
    role: text(data.role),
    where: text(data.where),
    start: text(data.start),
    end: text(data.end),
    current: data.current === true,
    lines: lines.length > 0 ? lines : [emptyLine()],
  };
}

/**
 * The saved form, read back from the Resume Game session. Older sessions
 * have none, and anything unreadable is dropped rather than guessed at.
 */
export function normalizeDraft(value: unknown): ResumeDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  const experiences = (Array.isArray(data.experiences) ? data.experiences : [])
    .map(normalizeExperience)
    .filter((entry): entry is DraftExperience => entry !== null)
    .slice(0, MAX_EXPERIENCES);
  const step = typeof data.step === 'number' && Number.isInteger(data.step) ? data.step : 0;
  return {
    open: data.open === true,
    step: Math.min(Math.max(step, 0), DRAFT_STEPS.length - 1),
    name: text(data.name),
    email: text(data.email),
    phone: text(data.phone),
    city: text(data.city),
    skipSchool: data.skipSchool === true,
    school: text(data.school),
    study: text(data.study),
    finish: text(data.finish),
    experiences: experiences.length > 0 ? experiences : [emptyExperience()],
    skills: text(data.skills),
  };
}
