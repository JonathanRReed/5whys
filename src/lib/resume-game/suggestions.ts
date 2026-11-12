import { BUZZWORDS, matchesTerm } from './constants';
import { analyzeReadability } from './readability';
import { findNumbers, hasResult, scoreParts } from './scoring';
import { normalizeLine } from './text';
import type { BulletRecord } from './types';
import { honestVerbQuestion, leadingAction } from './verbs';

export type BulletSuggestion = {
  type:
    | 'missing-verb'
    | 'weak-verb'
    | 'thin-task'
    | 'missing-impact'
    | 'missing-number'
    | 'buzzword'
    | 'too-long'
    | 'passive-voice';
  message: string;
  /** A question about the visitor's own work. Never a word to paste in. */
  fix?: string;
  /** Worked example for students, and for anyone who has not said. */
  studentExample?: string;
  /** Worked example from store, shift, warehouse, office, care, or customer work. */
  workExample?: string;
};

/**
 * A question that reads the line and asks for the count most likely to
 * exist for that kind of work. Asking is all it does: a count the visitor
 * does not have stays out.
 */
function metricPromptFor(text: string): string {
  const lower = text.toLowerCase();
  if (/(social|instagram|tiktok|newsletter|post|followers|content)/.test(lower)) {
    return 'Did you count anything: posts a week, followers, or people who saw it?';
  }
  if (/(truck|freight|shipment|order|inventory|stock|pallet|delivery|deliveries)/.test(lower)) {
    return 'Did you count anything: trucks, orders, or items a shift or a week?';
  }
  if (/(customer|caller|call|patient|guest|client|register|cash)/.test(lower)) {
    return 'Did you count anything: customers, calls, or patients a shift or a day?';
  }
  if (/(event|meeting|workshop|session|game|performance)/.test(lower)) {
    return 'Did you count anything: how many events, or how many people came?';
  }
  if (/(student|class|course|tutor)/.test(lower)) {
    return 'Did you count anything: students a week, sessions, or hours?';
  }
  if (/(report|spreadsheet|schedule|process|form|system)/.test(lower)) {
    return 'Did you count anything: hours saved, steps removed, or how often it ran?';
  }
  return 'Did you count anything: people served, items, hours, dollars, or how often? If you did not count it, leave it out.';
}

/** A question about what happened, fitted to the line when it can be. */
function resultQuestionFor(text: string): string {
  const lower = text.toLowerCase();
  if (/(social|instagram|tiktok|post|newsletter|content)/.test(lower)) {
    return 'What happened because you did this? Did more people come, sign up, or follow along?';
  }
  if (/(inventory|stock|freight|truck|shelf|shelves|warehouse|pallet)/.test(lower)) {
    return 'What happened because you did this? Was stock easier to find, were counts right, did trucks get done sooner?';
  }
  if (/(schedule|shift|staff)/.test(lower)) {
    return 'What happened because you did this? Were shifts covered, was overtime lower, did fewer people miss work?';
  }
  if (/(register|cash|customer|counter|guest|caller|patient)/.test(lower)) {
    return 'What happened because you did this? Did lines move faster, did orders go out right, did people come back?';
  }
  return 'What happened because you did this? What got faster, easier, or fixed, and who noticed?';
}

const PASSIVE_FRAGMENT_PATTERN = /\b(was|were|been|being|is|are|be)\s+\w+(?:ed|en)\b/i;

// Example pairs rotate by line so a six-line resume does not show the same
// sentence six times.
const NUMBER_EXAMPLES = {
  student: [
    'Graded weekly problem sets for a 90-student linear algebra course and held 2 office hours per week.',
    'Ran sound for every home basketball game across two seasons, handling setup and teardown solo.',
    'Posted 3 times a week for the campus radio Instagram, growing followers from 240 to 610 in a semester.',
  ],
  work: [
    'Unloaded and stocked 3 trucks a week, with every pallet on the floor by noon.',
    'Answered 60 to 80 customer calls a shift and logged each one before closing it.',
    'Checked in 25 patients each morning at the front desk and confirmed their insurance.',
  ],
};

const IMPACT_EXAMPLES = {
  student: [
    'Rebuilt the club sign-up form, so twice as many people finished signing up at the fall fair.',
    'Reorganized the supply closet so volunteers could set up in 10 minutes instead of 30.',
  ],
  work: [
    'Rebuilt the weekly schedule so every shift was covered without overtime for three months.',
    'Set up a returns shelf by the register, so customers stopped waiting for a manager.',
  ],
};

const pick = <T>(list: T[], seed: string): T => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
};

/**
 * Suggestions for one line, most useful first. Each is a question about
 * what the visitor actually did; none proposes a grander verb or a number.
 *
 * @param seed rotates the worked examples; pass the line's position in the
 * list so neighbours show different sentences. Defaults to the text itself.
 */
export function generateBulletSuggestions(
  bullet: BulletRecord,
  seed: string | number = bullet.original
): BulletSuggestion[] {
  const exampleSeed = String(seed);
  const suggestions: BulletSuggestion[] = [];
  // Read the line as it reads now, so suggestions clear as fields fill in.
  const current = normalizeLine(bullet.improved) || normalizeLine(bullet.original);
  if (!current) return suggestions;
  const parts = scoreParts(current);
  const opening = leadingAction(current);
  const readability = analyzeReadability(current);

  if (!opening) {
    suggestions.push({
      type: 'missing-verb',
      message: 'This line does not start with what you did.',
      fix: 'What did you do here? Start the line with that word, the one you would use telling a friend.',
      studentExample:
        '"Social media for the radio station" becomes "Wrote and scheduled posts for the campus radio Instagram."',
      workExample:
        '"Opening and closing duties" becomes "Opened and closed the store four days a week, counting both registers."',
    });
  } else if (opening.involvement) {
    suggestions.push({
      type: 'weak-verb',
      message: `"${opening.text}" says you were there, not what you did.`,
      fix: honestVerbQuestion(current) ?? 'What did you do yourself? Start the line with that.',
      studentExample:
        '"Helped with events" becomes "Set up chairs and ran the sign-in table at three welcome week events."',
      workExample:
        '"Helped with inventory" becomes "Counted and logged the back room every Sunday for the monthly inventory."',
    });
  }

  if (parts.work.points < parts.work.max) {
    suggestions.push({
      type: 'thin-task',
      message: 'Say a little more about the work.',
      fix: 'What was it, where, for whom, or how often?',
      studentExample:
        '"Worked the register" becomes "Worked the register at the campus cafe during the lunch rush."',
      workExample:
        '"Stocked shelves" becomes "Stocked the dairy and frozen aisles on the overnight shift."',
    });
  }

  const numbers = findNumbers(current);
  const measure = numbers.find((item) => item.kind === 'measure');
  const resulted = hasResult(current);
  if (!resulted) {
    suggestions.push({
      type: 'missing-impact',
      message: 'Nothing here says what happened because of the work.',
      fix: resultQuestionFor(current),
      studentExample: pick(IMPACT_EXAMPLES.student, exampleSeed),
      workExample: pick(IMPACT_EXAMPLES.work, exampleSeed),
    });
  }

  // A line that already says what happened is not asked for a number; it
  // only hears about a number that is there but says nothing.
  const scope = numbers.find((item) => item.kind === 'scope');
  const bare = numbers.find((item) => item.kind === 'bare');
  if (!measure && (!resulted || bare || scope)) {
    suggestions.push({
      type: 'missing-number',
      message: bare
        ? `"${bare.text}" is here, but nothing says what it counts.`
        : scope
          ? `"${scope.text}" is the size of the group. It shows scale, but it is not a result.`
          : 'No number here. That is fine if you do not have a true one.',
      fix: bare
        ? `Add the word for what ${bare.text} counts, for example "${bare.text} orders a shift", or leave it out.`
        : metricPromptFor(current),
      studentExample: pick(NUMBER_EXAMPLES.student, exampleSeed),
      workExample: pick(NUMBER_EXAMPLES.work, exampleSeed),
    });
  }

  const buzzword = BUZZWORDS.find((b) => matchesTerm(current, b));
  if (buzzword) {
    suggestions.push({
      type: 'buzzword',
      message: `"${buzzword}" is a claim anyone can make. Cut it and show the work that proves it.`,
      studentExample:
        '"Detail-oriented team player" becomes "Caught and fixed 3 gradebook errors before final grades posted."',
      workExample:
        '"Hard-working team player" becomes "Covered 14 open shifts in one month after two coworkers left."',
    });
  }

  if (readability.wordCount > 32) {
    suggestions.push({
      type: 'too-long',
      message: `At ${readability.wordCount} words this reads as a paragraph. Keep one action and one result; move the rest to a second line.`,
      studentExample:
        'Analyzed housing survey data in R for a sociology capstone and presented 3 findings to the department.',
      workExample: 'Ran the weekly vendor returns and cut the backlog from 12 boxes to 2.',
    });
  }

  if (readability.passiveVoiceCount > 0) {
    const passiveFragment = current.match(PASSIVE_FRAGMENT_PATTERN)?.[0];
    suggestions.push({
      type: 'passive-voice',
      message: passiveFragment
        ? `"${passiveFragment}" hides who did it. Lead with what you did.`
        : 'This hides who did it. Lead with what you did.',
      fix: 'Who did it? If it was you, start with what you did.',
      studentExample:
        '"Was given responsibility for the club budget" becomes "Managed the club budget of $2,000 across two semesters."',
      workExample:
        '"Shipments were checked by me" becomes "Checked every inbound shipment against the packing list."',
    });
  }

  return suggestions;
}
