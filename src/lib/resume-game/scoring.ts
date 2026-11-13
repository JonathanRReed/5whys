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
 *    "which meant", "to cut"), or a result phrase ("zero incidents", "best
 *    variance in the district", "used by the other 11 stores").
 * 4. Measure (15). A number that says what it counts: "40 boxes", "3 posts a
 *    week", "6 hours", "2%", "$1,400". A bare number ("30") earns nothing.
 *    Years, date ranges, and phone numbers are not measures. A team size or
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
/** What each part is called wherever it is shown. */
export const PART_LABELS = {
  action: 'What you did',
  work: 'What the work was',
  result: 'What happened because of it',
  measure: 'A number that says what it counts',
} as const;
export { STRONG_SCORE };

// A number that reads as a measure: counts, money, percentages, multipliers.
const NUMBER_TOKEN = /\$?\d[\d,]*(?:\.\d+)?%?(?:[kKmMxX]\b)?/g;
const YEAR = /^(?:19|20)\d{2}$/;
const DATE_RANGE = /\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/gi;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g;
const ORDINAL = /^\d+(?:st|nd|rd|th)$/i;
// A grade point average is a record of school, not a measure of the work:
// "GPA 3.6", "GPA: 3.6/4.0", "3.6 GPA", "3.8 cumulative GPA".
const GPA =
  /\bGPA\b\s*(?::\s*|of\s+)?\d\.\d{1,2}(?:\s*\/\s*\d(?:\.\d{1,2})?)?|\b\d\.\d{1,2}(?:\s*\/\s*\d(?:\.\d{1,2})?)?\s+(?:[a-z]+\s+)?GPA\b/gi;
const BARE_NUMBER_CLEAN_PATTERN = /[$,%kKmMxX]/g;
const SYMBOL = /[$%]|\d[kKmMxX]$/;

const PEOPLE =
  /^(?:person|people|persons|members?|associates?|employees?|staff|workers?|volunteers?|cashiers?|servers?|reports|teammates?|tutors?|interns?|managers?|leads?|crew|students?|engineers?|designers?|agents?|nurses?|aides?|drivers?|clerks?)$/i;
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
  return text.replace(DATE_RANGE, blank).replace(PHONE, blank).replace(GPA, blank);
}

/**
 * Every number in a line that could be a count, sorted into a measure (says
 * what it counts), scope (a team size or headcount), or bare (nothing says
 * what it counts). Years, date ranges, phone numbers, GPAs, and ordinals are
 * left out entirely.
 */
export function findNumbers(text: string): FoundNumber[] {
  return findNumberSpans(text).map(({ text: found, kind }) => ({ text: found, kind }));
}

/** findNumbers, with the position of each number's token in the line. */
export function findNumberSpans(text: string): NumberSpan[] {
  if (!/\d/.test(text)) return [];
  const stripped = stripNonMeasures(text);
  const found: NumberSpan[] = [];
  for (const match of stripped.matchAll(NUMBER_TOKEN)) {
    const token = match[0];
    const index = match.index ?? 0;
    const bare = token.replace(BARE_NUMBER_CLEAN_PATTERN, '');
    if (YEAR.test(bare) && !/[$%]/.test(token)) continue;
    const after = stripped.slice(index + token.length);
    if (ORDINAL.test(token + (after.match(/^[a-z]{2}/i)?.[0] ?? ''))) continue;
    const before = stripped.slice(0, index);
    const hyphenUnit = after.match(/^-([a-z]+)/i)?.[1];
    const nextWord = after.match(/^\s*\+?\s*([a-z][a-z'-]*)/i)?.[1];
    const unit = hyphenUnit ?? nextWord;
    const unitIsPeople = !!unit && PEOPLE.test(unit);
    const unitText = hyphenUnit
      ? `${token}-${hyphenUnit}`
      : nextWord
        ? `${token} ${nextWord}`
        : token;

    const span = { token, start: index, end: index + token.length };
    const isScope =
      (hyphenUnit !== undefined && unitIsPeople) ||
      (unitIsPeople && (GROUP_OF.test(before) || WITH_BEFORE.test(before))) ||
      (unitIsPeople && SUPERVISING_BEFORE.test(before)) ||
      (GROUP_OF.test(before) && !SYMBOL.test(token));
    if (isScope) {
      found.push({ text: unitText, kind: 'scope', ...span });
      continue;
    }
    const unitIsWord = !!unit && !STOPWORDS.has(unit.toLowerCase());
    const pairs =
      /^\s*(?:of|to|out of)\s+\$?\d/i.test(after) || /\b(?:from|of|to)\s+$/i.test(before);
    if (SYMBOL.test(token) || unitIsWord || pairs) {
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
    if (YEAR.test(bare) && !/[$%]/.test(token)) return false;
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
  'cut|reduced|decreased|lowered|shortened|halved|increased|grew|raised|doubled|tripled|saved|boosted|lifted|eliminated|prevented|ended|improved|stopped|recovered|freed up|sped up';

const RESULT_PATTERNS: RegExp[] = [
  // Links that lead into what happened.
  /\b(?:resulting in|leading to|which meant|so that|because of (?:this|it|which)|in turn)\b/i,
  /\bwhich (?:led|let|helped|cut|saved|kept|got|made|gave|won|grew|raised|reduced|increased|improved|doubled|freed|ended|stopped|meant)\b/i,
  /\bso (?:[\w'-]+[\s,]+){0,4}?(?:could|can|would|were|was|had|got|stopped|started|no longer|never|did|came|left|finished|always|now)\b/i,
  /\bto (?:increase|decrease|reduce|cut|save|improve|boost|grow|raise|lower|double|triple|speed up|eliminate|win|secure|keep|meet|exceed|free up|recover|prevent|resolve|end)\b/i,
  // A change, with an object: "cut shrink", "grew followers".
  new RegExp(`\\b(?:${CHANGE_VERBS})\\s+(?!(?:to|for|with|in|on|at|and|or)\\b)[\\w$]`, 'i'),
  /,\s*(?:cutting|reducing|decreasing|lowering|shortening|halving|increasing|growing|raising|doubling|tripling|saving|boosting|lifting|eliminating|preventing|ending|improving|stopping|recovering|freeing up|speeding up|delivering|earning|winning|bringing|keeping|getting)\b/i,
  // A state kept or reached: "kept payroll within 2% of plan".
  /\b(?:kept|keeping|got|getting|brought|bringing|finished|completed|delivered|stayed|came in|held)\b[^.;]{0,60}?\b(?:within|on (?:plan|time|schedule|budget|target)|under (?:budget|plan)|ahead of|below (?:plan|budget|target)|above (?:plan|target|goal)|at zero)\b/i,
  // Achievements.
  /\b(?:passed|won|earned|placed|ranked|awarded|praised|recognized)\b/i,
  /\bpromoted (?:\d|to\b|into\b)/i,
  /\b(?:named|selected as|chosen as) (?:an? |the )?\w+ of the (?:month|year|quarter)\b/i,
  // Result phrases.
  /\bzero [a-z]/i,
  /\bno (?:missed|lost|late|errors?|complaints?|incidents?|injuries|injury|write-ups?|overtime|returns?)\b/i,
  /\bwithout (?:a |any )?(?:missed|missing|closing|losing|late|errors?|complaints?|incidents?|downtime|overtime|injur\w*)\b/i,
  /\b(?:best|highest|lowest|fastest|top|first)\b[^.;]{0,40}\bin (?:the |our |my |its )?(?:district|region|company|store|class|school|state|chain|division|county|league|department)\b/i,
  /\b(?:on time|ahead of schedule|under budget|on budget|on plan)\b/i,
  /\bfrom \$?\d[\d,.]*%?(?:\s+[a-z]+)?\s+to \$?\d/i,
  /\binstead of\b/i,
  /\bwithin \$?\d[\d,.]*%?\s*[a-z]/i,
  /\b(?:\d+|other|every|all) [a-z]+ (?:now )?(?:used|adopted)\b/i,
];

/** True when the line says what happened because of the work. */
export function hasResult(text: string): boolean {
  return RESULT_PATTERNS.some((pattern) => pattern.test(text)) || hasQualitativeOutcome(text);
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

  const resulted = hasResult(text);
  const result: ScorePart = resulted
    ? { points: 40, max: PART_MAX.result, note: 'Says what happened because of the work.' }
    : { points: 0, max: PART_MAX.result, note: 'Does not say what happened because of the work.' };

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
  return { label: 'Needs more', color: 'text-iris' };
}
