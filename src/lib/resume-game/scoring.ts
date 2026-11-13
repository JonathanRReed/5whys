/**
 * How a resume line is scored. One score per line, 0 to 100, made of four
 * parts the visitor can see. Nothing else feeds it: no length bonus, no
 * "strong verb" tier, no points for a number that says nothing.
 *
 * 1. Action (20). The line opens with what you did: any verb, past tense
 *    ("Stocked"), base form ("Stock"), or third person ("Stocks"). An
 *    opening that only says you were there ("Helped with", "Responsible
 *    for", "Worked on") earns 8. A verb that only appears later earns 10.
 * 2. What was done (25). The words that name the work, counted after the
 *    opening verb, leaving out small words like "the" and "for". Four or
 *    more earn 25, one to three earn 10. A line with no verb at all earns at
 *    most 10 here, because nothing says it was done.
 * 3. Result (40). The line says what happened because of the work. This is
 *    the largest part, so an honest line with an action, the work, and a
 *    result scores 85 with no number at all. Results are recognized from
 *    plain patterns: a change ("cut shrink", "grew followers"), a state kept
 *    or reached ("kept payroll within 2% of plan", "kept the store on
 *    plan"), an achievement ("passed", "won", "promoted 9 associates"), a
 *    before and after ("from 240 to 610"), a link ("so families could",
 *    "which meant", "so customers waited less", "so new pickers hit full
 *    rate"), a target reached ("met quota", "hit full rate"), a purpose
 *    that says how much ("to save the lab 6 hours a week"), or a result
 *    phrase ("zero incidents", "with no shortages", "went 600 days without
 *    a lost-time injury", "no orders missed", "used by the other 11
 *    stores"). A "so" clause in the present ("so the office runs") says
 *    what the work was for, not what happened. A
 *    purpose alone ("to raise funds") is an aim, not a result, and earns
 *    15. A line that says the attempt failed earns nothing here.
 * 4. Measure (15). A number that says what it counts: "40 boxes", "twenty
 *    customers", "3 posts a week", "6 hours", "2%", "$1,400", "€500". A bare
 *    number ("30") earns nothing. Years ("in 2024", "the 2024 season"), date
 *    ranges, and phone numbers are not measures; "2026 invoices" is. A team size or
 *    headcount ("a 14-person team", "team of 5", "with 62 associates",
 *    "supervised 12 volunteers") is scope, not a result, and earns nothing
 *    here.
 *
 * A line at STRONG_SCORE or above is labeled strong. The same text always
 * gets the same score.
 */
import { STOPWORDS } from './constants';
import { STRONG_SCORE } from './thresholds';
import { hasBuriedVerb, leadingAction } from './verbs';

export const PART_MAX = { action: 20, work: 25, result: 40, measure: 15 } as const;
/** Result points for a line that says only what the work was for. */
export const AIM_POINTS = 15;
/** What each part is called wherever it is shown. */
export const PART_LABELS = {
  action: 'What you did',
  work: 'What the work was',
  result: 'What happened because of it',
  measure: 'A number that says what it counts',
} as const;
export { STRONG_SCORE };

// A number that reads as a measure: counts, money, percentages, multipliers.
const NUMBER_TOKEN = /[$€£₹₦¥]?\d[\d,]*(?:\.\d+)?%?(?:[kKmMxX]\b)?/g;
const YEAR = /^(?:19|20)\d{2}$/;
const DATE_RANGE = /\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/gi;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g;
const ORDINAL = /^\d+(?:st|nd|rd|th)$/i;
// A grade point average is a record of school, not a measure of the work:
// "GPA 3.6", "GPA: 3.6/4.0", "3.6 GPA", "3.8 cumulative GPA".
const GPA =
  /\bGPA\b\s*(?::\s*|of\s+)?\d\.\d{1,2}(?:\s*\/\s*\d(?:\.\d{1,2})?)?|\b\d\.\d{1,2}(?:\s*\/\s*\d(?:\.\d{1,2})?)?\s+(?:[a-z]+\s+)?GPA\b/gi;
// A reference code is a name, not an amount: a regulation or form number
// ("AR 710-2", "CTA 50-900", "FM 3-21.8") or a code with a letter fixed to
// its digits ("92Y", "92Ys", "3D"). "4K" and "10x" are amounts, and stay.
const REFERENCE_CODE = /\b[A-Z]{1,6}(?:\s+Form)?\s+\d+(?:[-.]\d+)+[A-Za-z]?\b/g;
const LETTER_CODE = /\b\d+(?![kKmMxX]\b)(?![kKmM]\s)[A-Z][A-Za-z]*\b/g;
const BARE_NUMBER_CLEAN_PATTERN = /[$€£₹₦¥,%kKmMxX]/g;
const SYMBOL = /[$€£₹₦¥%]|\d[kKmMxX]$/;
const MONEY_OR_PERCENT = /[$€£₹₦¥%]/;

// Number words name an amount as surely as digits do: "twenty customers"
// counts the same as "20 customers". "One" is left out on its own, because
// "one of the", "the one person", and "one-on-one" are not counts.
const SMALL_NUMBER_WORDS =
  'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS_WORDS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const NUMBER_WORD = new RegExp(
  `\\b(?:(?:${TENS_WORDS})(?:[- ](?:one|${SMALL_NUMBER_WORDS}))?(?:\\s+(?:hundred|thousand))?|(?:one|a)\\s+(?:hundred|thousand|dozen)|(?:${SMALL_NUMBER_WORDS})(?:\\s+(?:hundred|thousand))?|one(?=\\s+(?:percent|per cent)\\b)|hundreds|thousands|dozens)\\b`,
  'gi'
);
const HAS_NUMBER_WORD = new RegExp(NUMBER_WORD.source, 'i');
// A word that shows a year is a date, not a count: "in 2024", "fall 2025".
const DATE_BEFORE =
  /\b(?:in|since|from|by|during|until|through|of|for|the|fall|spring|summer|winter|autumn|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|class|year|season|fy|cohort)\s*$/i;
// Plural words after a year-like number that are still about time.
const TIME_UNIT = /^(?:seasons?|semesters?|terms?|years?|graduates?|cohorts?|grads?)$/i;
// Small words a count can carry before what it counts: "200 new members".
const COUNT_ADJECTIVE =
  /^(?:new|more|other|additional|extra|returning|first-time|unique|active|total|regular|repeat|weekly|daily|monthly)$/i;

const PEOPLE =
  /^(?:person|people|persons|members?|associates?|employees?|staff|workers?|volunteers?|cashiers?|servers?|reports|teammates?|tutors?|interns?|managers?|leads?|crew|students?|engineers?|designers?|agents?|nurses?|aides?|drivers?|clerks?|soldiers?|children|kids|sons?|daughters?|grandchildren|siblings)$/i;
// One's own family is who the work was for, never a measure of it.
const FAMILY = /^(?:children|kids|sons?|daughters?|grandchildren|siblings)$/i;
const OWN_FAMILY_BEFORE = /\b(?:raised|raising|my|our|his|her|their)\s+$/i;
const GROUP_OF = /\b(?:team|staff|crew|group|department|class|unit|shift) of\s*$/i;
const WITH_BEFORE = /\bwith\s+(?:a |an |the |about |around |over )?$/i;
const SUPERVISING_BEFORE =
  /\b(?:supervised|supervising|supervise|managed|managing|manage|led|leading|lead|oversaw|overseeing|oversee|directed|directing|ran|running|headed|heading|scheduled|scheduling)\s+(?:a |an |the |my |our )?(?:team of |staff of |crew of )?$/i;

export type MeasureKind = 'measure' | 'scope' | 'bare';
export type FoundNumber = { text: string; kind: MeasureKind };
/** A found number with where its token sits in the line, for highlighting. */
export type NumberSpan = FoundNumber & { token: string; start: number; end: number };

const blank = (match: string) => ' '.repeat(match.length);

/**
 * Removes what is never a measure: date ranges, phone numbers, and GPAs.
 * Each is replaced by spaces of the same length, so positions in the result
 * are positions in the original line.
 */
function stripNonMeasures(text: string): string {
  return text
    .replace(DATE_RANGE, blank)
    .replace(PHONE, blank)
    .replace(GPA, blank)
    .replace(REFERENCE_CODE, blank)
    .replace(LETTER_CODE, blank);
}

type Candidate = { token: string; index: number; word: boolean };

function candidates(stripped: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of stripped.matchAll(NUMBER_TOKEN)) {
    found.push({ token: match[0], index: match.index ?? 0, word: false });
  }
  for (const match of stripped.matchAll(NUMBER_WORD)) {
    found.push({ token: match[0], index: match.index ?? 0, word: true });
  }
  return found.sort((a, b) => a.index - b.index);
}

/** The word after a count, skipping one small describing word. */
function unitAfter(after: string): { word?: string; text?: string } {
  const first = after.match(/^\s*\+?\s*([a-z][a-z'-]*)/i);
  if (!first) return {};
  if (COUNT_ADJECTIVE.test(first[1])) {
    const second = after.slice(first[0].length).match(/^\s+([a-z][a-z'-]*)/i);
    if (second) return { word: second[1], text: `${first[1]} ${second[1]}` };
  }
  return { word: first[1], text: first[1] };
}

/** True when a year-like number counts something instead: "2026 invoices". */
function yearLikeIsCount(token: string, before: string, unit: string | undefined): boolean {
  if (/,/.test(token)) return true; // "2,000" is never a year.
  if (!unit || STOPWORDS.has(unit.toLowerCase())) return false;
  if (DATE_BEFORE.test(before)) return false;
  return /s$/i.test(unit) && !TIME_UNIT.test(unit);
}

/**
 * Every number in a line that could be a count, sorted into a measure (says
 * what it counts), scope (a team size or headcount), or bare (nothing says
 * what it counts). Years, date ranges, phone numbers, GPAs, and ordinals are
 * left out entirely. Numbers written as words count the same as digits.
 */
export function findNumbers(text: string): FoundNumber[] {
  return findNumberSpans(text).map(({ text: found, kind }) => ({ text: found, kind }));
}

/** findNumbers, with the position of each number's token in the line. */
export function findNumberSpans(text: string): NumberSpan[] {
  if (!/\d/.test(text) && !HAS_NUMBER_WORD.test(text)) return [];
  const stripped = stripNonMeasures(text);
  const found: NumberSpan[] = [];
  for (const { token, index, word } of candidates(stripped)) {
    const bare = token.replace(BARE_NUMBER_CLEAN_PATTERN, '');
    const after = stripped.slice(index + token.length);
    const before = stripped.slice(0, index);
    const hyphenUnit = word ? undefined : after.match(/^-([a-z]+)/i)?.[1];
    const next = unitAfter(after);
    const unit = hyphenUnit ?? next.word;
    if (!word && YEAR.test(bare) && !MONEY_OR_PERCENT.test(token)) {
      if (!yearLikeIsCount(token, before, hyphenUnit ?? next.word)) continue;
    }
    if (!word && ORDINAL.test(token + (after.match(/^[a-z]{2}/i)?.[0] ?? ''))) continue;
    const unitIsPeople = !!unit && PEOPLE.test(unit);
    const unitIsStop = !!unit && STOPWORDS.has(unit.toLowerCase());
    const unitText = hyphenUnit
      ? `${token}-${hyphenUnit}`
      : next.text && !unitIsStop
        ? `${token} ${next.text}`
        : token;

    const span = { token, start: index, end: index + token.length };
    const symbol = SYMBOL.test(token) || /^\s*(?:percent|per cent)\b/i.test(after);
    const isScope =
      (!!unit && FAMILY.test(unit) && OWN_FAMILY_BEFORE.test(before)) ||
      (hyphenUnit !== undefined && unitIsPeople) ||
      (unitIsPeople && (GROUP_OF.test(before) || WITH_BEFORE.test(before))) ||
      (unitIsPeople && SUPERVISING_BEFORE.test(before)) ||
      (GROUP_OF.test(before) && !symbol);
    if (isScope) {
      found.push({ text: unitText, kind: 'scope', ...span });
      continue;
    }
    const unitIsWord = !!unit && !unitIsStop;
    const pairs =
      /^\s*(?:of|to|out of)\s+[$€£₹₦¥]?\d/i.test(after) || /\b(?:from|of|to)\s+$/i.test(before);
    if (symbol || unitIsWord || pairs) {
      found.push({ text: SYMBOL.test(token) ? token : unitText, kind: 'measure', ...span });
    } else {
      found.push({ text: token, kind: 'bare', ...span });
    }
  }
  return found;
}

/** Numbers that say what they count. */
export function findMeasures(text: string): string[] {
  return findNumbers(text)
    .filter((item) => item.kind === 'measure')
    .map((item) => item.text);
}

/**
 * Every measure-like number token in a line, with years and phone numbers
 * removed. Kept for the resume-level counts; scoring uses findNumbers.
 */
export function findQuantifiers(text: string): string[] {
  if (!/\d/.test(text)) return [];
  const tokens = stripNonMeasures(text).match(NUMBER_TOKEN) ?? [];
  return tokens.filter((token) => {
    const bare = token.replace(BARE_NUMBER_CLEAN_PATTERN, '');
    if (YEAR.test(bare) && !MONEY_OR_PERCENT.test(token) && !token.includes(',')) return false;
    if (ORDINAL.test(token)) return false;
    return true;
  });
}

export function hasQuantifier(text: string): boolean {
  return findQuantifiers(text).length > 0;
}

/** True when the line has a number that says what it counts. */
export function hasMeasure(text: string): boolean {
  return findNumbers(text).some((item) => item.kind === 'measure');
}

const NEGATION_PATTERN = /\b(?:not|never|failed to|unable to)\b/i;
const ADOPTION_OUTCOME_PATTERN = /\b(?:adopted|used|approved|accepted|published) by\s+\S+/i;
const OBSTACLE_OUTCOME_PATTERN =
  /\b(?:eliminated|removed|prevented) (?:duplicate|manual|conflicting|inaccessible|redundant|missing|broken)\s+\S+/i;

/**
 * A limited, inspectable cue for a stated qualitative result. This does not
 * verify the claim or infer a business outcome from a tool name alone.
 */
export function hasQualitativeOutcome(text: string): boolean {
  // A keyword match cannot establish an outcome that the line negates.
  if (NEGATION_PATTERN.test(text)) return false;
  return ADOPTION_OUTCOME_PATTERN.test(text) || OBSTACLE_OUTCOME_PATTERN.test(text);
}

const CHANGE_VERBS =
  'cut|reduced|decreased|lowered|shortened|halved|increased|grew|raised|doubled|tripled|saved|boosted|lifted|eliminated|prevented|ended|improved|stopped|recovered|freed up|sped up|attracted';

// Past forms that say something happened: "so new pickers hit full rate".
const IRREGULAR_PAST =
  'hit|met|kept|made|got|went|ran|grew|fell|rose|came|took|won|became|saw|spent|left|sold|beat|knew|found|felt|held|stood|brought|caught|paid|cut';
// Words that cannot be the subject of a "so" clause: "so that", "so as to".
const NOT_SUBJECT =
  '(?:and|or|to|for|with|in|on|at|of|that|as|far|much|many|long|well|are|is|am|be|will|can|may|might|must|should|would)\\b';
// A target reached: "hit full rate", "met quota", "exceeded the sales goal".
const TARGET_REACHED =
  /(?<!\b(?:to|will|would|could|should|might|can)\s)\b(?:hit|met|reached|beat|exceeded|surpassed|made)\s+(?:(?:full|their|our|the|its|every|each|all|daily|weekly|monthly|quarterly|annual|sales|production|pick|productivity|store|team)\s+){0,3}(?:rate|quotas?|goals?|targets?|plan|standards?|pace|deadlines?|numbers|budget|kpis?)\b/i;

const RESULT_PATTERNS: RegExp[] = [
  // Links that lead into what happened.
  /\b(?:resulting in|leading to|which meant|so that|because of (?:this|it|which)|in turn)\b/i,
  /\bwhich (?:led|let|helped|cut|saved|kept|got|made|gave|won|grew|raised|reduced|increased|improved|doubled|freed|ended|stopped|meant)\b/i,
  /\bso (?:[\w'-]+[\s,]+){0,4}?(?:could|can|would|were|was|had|got|stopped|started|no longer|never|did|came|left|finished|always|now)\b/i,
  // "so customers waited less", "so both locations stayed profitable", "so no
  // client order missed a truck", "so new pickers hit full rate": a subject,
  // then a verb that says what happened. "So they are easy to find" says
  // what the work was for, not what happened.
  new RegExp(
    `\\bso\\s+(?:(?:the|our|their|its|my|more|fewer|every|each|no|both|all|new|most|every)\\s+)?(?:(?!${NOT_SUBJECT})[a-z'-]+\\s+){1,3}?(?:never\\s+|no longer\\s+)?(?!(?:and|or|to|for|with|in|on|at|of)\\b)(?:[a-z]{3,}ed|${IRREGULAR_PAST})\\b`,
    'i'
  ),
  TARGET_REACHED,
  // A change, with an object: "cut shrink", "grew followers". "To cut" is an
  // aim, read below.
  new RegExp(
    `(?<!\\b(?:to|will|would|could|should|might|can)\\s)\\b(?:${CHANGE_VERBS})\\s+(?!(?:to|for|with|in|on|at|and|or)\\b)(?!(?:(?:my|our|his|her|their|a|two|three|four|five|\\d+)\\s+)?(?:children|kids|sons?|daughters?|family|grandchildren|siblings)\\b)[\\w$€£₹₦¥]`,
    'i'
  ),
  /,\s*(?:cutting|reducing|decreasing|lowering|shortening|halving|increasing|growing|raising|doubling|tripling|saving|boosting|lifting|eliminating|preventing|ending|improving|stopping|recovering|freeing up|speeding up|delivering|earning|winning|bringing|keeping|getting)\b/i,
  // A state kept or reached: "kept payroll within 2% of plan".
  /\b(?:kept|keeping|got|getting|brought|bringing|finished|completed|delivered|stayed|came in|held)\b[^.;]{0,60}?\b(?:within|on (?:plan|time|schedule|budget|target)|under (?:budget|plan)|ahead of|below (?:plan|budget|target)|above (?:plan|target|goal)|at zero)\b/i,
  // Achievements.
  /\b(?:passed|won|earned|placed|ranked|awarded|praised|recognized)\b/i,
  /\bpromoted (?:\d|to\b|into\b)/i,
  /\b(?:named|selected as|chosen as) (?:an? |the )?\w+ of the (?:month|year|quarter)\b/i,
  // Result phrases.
  /\bzero [a-z]/i,
  /\bno (?:missed|lost|late|errors?|mistakes?|complaints?|incidents?|accidents?|injuries|injury|write-ups?|overtime|returns?|shortages?|overages?|discrepanc(?:y|ies)|variances?|spills?|breakage|no-shows?)\b/i,
  /\bwithout (?:a |an |any |one |a single )?(?:[a-z]+-[a-z-]+ |(?:inventory|safety|reportable|recordable|lost-time|single|customer|client|order|shipping) )?(?:missed|missing|closing|losing|late|errors?|mistakes?|complaints?|incidents?|accidents?|downtime|overtime|shortages?|overages?|discrepanc(?:y|ies)|injur\w*|recordables?|stockouts?|write-ups?)\b/i,
  // "went 600 days without", "412 straight days with no".
  /\b\d[\d,]*\+?\s+(?:straight\s+|consecutive\s+|days?\s+in\s+a\s+row\s+)?(?:days|weeks|months|years|shifts|quarters|audits|inspections)\s+(?:in a row\s+)?(?:without|with no|with zero)\b/i,
  // "no orders missed", "with no deliveries missed".
  /\bno (?:[a-z'-]+\s+){1,3}?(?:missed|lost|dropped|damaged|late|left behind|went unanswered|went unfilled|fell through)\b/i,
  /\b(?:best|highest|lowest|fastest|top|first)\b[^.;]{0,40}\bin (?:the |our |my |its )?(?:district|region|company|store|class|school|state|chain|division|county|league|department)\b/i,
  /\b(?:ahead of schedule|under budget|on budget|on plan)\b/i,
  /\bfrom [$€£₹₦¥]?\d[\d,.]*%?(?:\s+[a-z]+)?\s+to [$€£₹₦¥]?\d/i,
  /\binstead of\b/i,
  /\bwithin [$€£₹₦¥]?\d[\d,.]*%?\s*[a-z]/i,
  /\b(?:\d+|other|every|all) [a-z]+ (?:now )?(?:used|adopted)\b/i,
];

// "to cut overtime" says what the work was for. It counts in full only
// when the line also says how much ("to save the lab 6 hours a week");
// otherwise it is an aim, and earns part of the result points.
const PURPOSE_PATTERN =
  /\bto (?:increase|decrease|reduce|cut|save|improve|boost|grow|raise|lower|double|triple|speed up|eliminate|win|secure|keep|meet|exceed|free up|recover|prevent|resolve|end)\b[^.;]*/i;
// An aim the line never says was met: "Tried to", "Planned to".
const ATTEMPT_PATTERN =
  /\b(?:tried|tries|try|attempted|attempts|attempt|aimed|aims|aim|hoped|hopes|hope|planned|plans|plan|intended|intends|intend|wanted|wants|want|sought|seeks|seek) to\b/i;
// A line that says the work did not reach its goal has no result to count.
const FAILED_PATTERN =
  /\b(?:but|and|yet)\s+(?:it\s+|this\s+|they\s+|we\s+|i\s+)?(?:failed|fell short|did not (?:work|succeed|happen)|didn't (?:work|succeed|happen)|was not|wasn't|were not|weren't|could not|couldn't|never)\b|\bunsuccessful(?:ly)?\b|\bwithout success\b|\b(?:it|this|that) failed\b/i;
// "On time" is a result when work was finished on time, not when the line
// is about showing up: "Responsible for being on time" says nothing happened.
const ON_TIME = /\bon time\b/i;
const ATTENDANCE_ON_TIME =
  /\b(?:be|being|been|am|is|are|was|were|arrive[sd]?|arriving|show(?:ed|s|ing)? up|came in|come in|coming in|clock(?:ed|s|ing)? in|report(?:ed|s|ing)? (?:to work|in))\b[^.;]{0,15}\bon time\b/i;

export type ResultKind = 'result' | 'aim' | 'failed' | 'none';

function onTimeResult(text: string): boolean {
  if (!ON_TIME.test(text) || ATTENDANCE_ON_TIME.test(text)) return false;
  const opening = leadingAction(text);
  return !!opening && !opening.involvement;
}

function purposeKind(text: string): 'result' | 'aim' | null {
  if (ATTEMPT_PATTERN.test(text)) return null;
  const clause = text.match(PURPOSE_PATTERN)?.[0];
  if (!clause) return null;
  const sized =
    /\b(?:by|in) half\b/i.test(clause) ||
    findNumbers(clause).some((item) => item.kind === 'measure');
  return sized ? 'result' : 'aim';
}

/**
 * What the line says happened: a result, only an aim ("to cut overtime"),
 * an attempt that failed, or nothing.
 */
export function resultKind(text: string): ResultKind {
  if (FAILED_PATTERN.test(text)) return 'failed';
  if (
    RESULT_PATTERNS.some((pattern) => pattern.test(text)) ||
    hasQualitativeOutcome(text) ||
    onTimeResult(text)
  ) {
    return 'result';
  }
  return purposeKind(text) ?? 'none';
}

/** True when the line says what happened because of the work. */
export function hasResult(text: string): boolean {
  return resultKind(text) === 'result';
}

/** Kept for callers that ask whether an action connects to a result. */
export function hasOutcomeLink(text: string): boolean {
  return hasResult(text);
}

const CONTENT_WORD = /[a-z][a-z'-]{2,}/g;

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(CONTENT_WORD) ?? []).filter((word) => !STOPWORDS.has(word));
}

export type ScorePart = { points: number; max: number; note: string };
export type ScoreParts = {
  action: ScorePart;
  work: ScorePart;
  result: ScorePart;
  measure: ScorePart;
};

function clean(line: string): string {
  return line
    .replace(/^\s*[-•*◦○●▪–—]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The four parts of a line's score, each with a plain note. */
export function scoreParts(line: string): ScoreParts {
  const text = clean(line);
  const opening = leadingAction(text);
  const buried = !opening && hasBuriedVerb(text);

  const action: ScorePart = opening
    ? opening.involvement
      ? {
          points: 8,
          max: PART_MAX.action,
          note: `Opens with "${opening.text}", which says you were there, not what you did.`,
        }
      : { points: 20, max: PART_MAX.action, note: `Opens with what you did: "${opening.text}".` }
    : buried
      ? { points: 10, max: PART_MAX.action, note: 'What you did comes later in the line.' }
      : { points: 0, max: PART_MAX.action, note: 'Does not start with what you did.' };

  const rest = opening ? text.slice(opening.text.length) : text;
  const words = contentWords(rest).length;
  const hasVerb = !!opening || buried;
  const workPoints = words >= 4 && hasVerb ? 25 : words >= 1 ? 10 : 0;
  const work: ScorePart = {
    points: workPoints,
    max: PART_MAX.work,
    note:
      workPoints === 25
        ? 'Says what the work was.'
        : workPoints === 10
          ? 'Names the work only briefly.'
          : 'Does not say what the work was.',
  };

  const kind = resultKind(text);
  const result: ScorePart =
    kind === 'result'
      ? { points: 40, max: PART_MAX.result, note: 'Says what happened because of the work.' }
      : kind === 'aim'
        ? {
            points: AIM_POINTS,
            max: PART_MAX.result,
            note: 'Says what the work was for, not what happened.',
          }
        : kind === 'failed'
          ? {
              points: 0,
              max: PART_MAX.result,
              note: 'Says the work did not reach its goal, so there is no result to count.',
            }
          : {
              points: 0,
              max: PART_MAX.result,
              note: 'Does not say what happened because of the work.',
            };

  const numbers = findNumbers(text);
  const measured = numbers.find((item) => item.kind === 'measure');
  const scope = numbers.find((item) => item.kind === 'scope');
  const bare = numbers.find((item) => item.kind === 'bare');
  const measure: ScorePart = measured
    ? {
        points: 15,
        max: PART_MAX.measure,
        note: `Has a number that says what it counts: "${measured.text}".`,
      }
    : scope
      ? {
          points: 0,
          max: PART_MAX.measure,
          note: `"${scope.text}" is the size of the group, not a result.`,
        }
      : bare
        ? {
            points: 0,
            max: PART_MAX.measure,
            note: `Has "${bare.text}", but nothing says what it counts.`,
          }
        : {
            points: 0,
            max: PART_MAX.measure,
            note: 'No number. That is fine if you do not have a true one.',
          };

  return { action, work, result, measure };
}

/** One score per line: the sum of its four parts. See the rubric above. */
export function scoreBullet(bullet: string): number {
  if (!clean(bullet)) return 0;
  const parts = scoreParts(bullet);
  const total =
    parts.action.points + parts.work.points + parts.result.points + parts.measure.points;
  return Math.max(0, Math.min(100, total));
}

/** A plain label for a line's score. */
export function scoreLabel(score: number) {
  if (score >= STRONG_SCORE) return { label: 'Strong', color: 'text-love' };
  if (score >= 50) return { label: 'Getting there', color: 'text-gold' };
  return { label: 'Starting point', color: 'text-iris' };
}
