import { ACTION_VERBS } from './constants';

/**
 * Is the first word of a line a verb? Resume lines open with a past-tense
 * verb ("Stocked"), a base form ("Stock shelves"), or a third-person form
 * ("Stocks shelves"). A fixed list of "power verbs" rejected ordinary verbs
 * like "Posted", "Owned", or "Ran", so this check is general: a list of
 * common irregular and short verbs, plus a morphological rule for regular
 * past tense, plus base forms derived from both.
 */

// Irregular past tenses, and short regular ones the -ed rule would skip.
const IRREGULAR_PAST: Record<string, string> = {
  ran: 'run',
  kept: 'keep',
  cut: 'cut',
  set: 'set',
  put: 'put',
  led: 'lead',
  made: 'make',
  built: 'build',
  wrote: 'write',
  drove: 'drive',
  sold: 'sell',
  taught: 'teach',
  met: 'meet',
  found: 'find',
  held: 'hold',
  bought: 'buy',
  brought: 'bring',
  caught: 'catch',
  fed: 'feed',
  paid: 'pay',
  read: 'read',
  spoke: 'speak',
  told: 'tell',
  won: 'win',
  got: 'get',
  did: 'do',
  began: 'begin',
  chose: 'choose',
  drew: 'draw',
  grew: 'grow',
  saw: 'see',
  sent: 'send',
  spent: 'spend',
  stood: 'stand',
  swept: 'sweep',
  oversaw: 'oversee',
  rebuilt: 'rebuild',
  rewrote: 'rewrite',
  took: 'take',
  gave: 'give',
  shot: 'shoot',
  dealt: 'deal',
  lent: 'lend',
  thought: 'think',
  sought: 'seek',
  fought: 'fight',
  wound: 'wind',
  understood: 'understand',
  undertook: 'undertake',
  overcame: 'overcome',
  upheld: 'uphold',
  withdrew: 'withdraw',
  hung: 'hang',
  spun: 'spin',
  split: 'split',
  shut: 'shut',
  let: 'let',
  hit: 'hit',
  beat: 'beat',
  quit: 'quit',
  rode: 'ride',
  flew: 'fly',
  froze: 'freeze',
  broke: 'break',
  woke: 'wake',
  wore: 'wear',
  bore: 'bear',
  tore: 'tear',
  became: 'become',
  came: 'come',
  went: 'go',
  knew: 'know',
  threw: 'throw',
  blew: 'blow',
  showed: 'show',
  babysat: 'babysit',
  sat: 'sit',
  swam: 'swim',
  sang: 'sing',
  dug: 'dig',
  hid: 'hide',
  lit: 'light',
  sped: 'speed',
  sewed: 'sew',
  sewn: 'sew',
  mowed: 'mow',
};

// Regular past tenses that look like adjectives or names at the start of a
// line ("Experienced cashier", "United Way volunteer") are not actions here.
const NOT_VERBS = new Set([
  'experienced',
  'dedicated',
  'skilled',
  'motivated',
  'self-motivated',
  'talented',
  'detailed',
  'detail-oriented',
  'results-oriented',
  'advanced',
  'certified',
  'licensed',
  'qualified',
  'seasoned',
  'accomplished',
  'varied',
  'limited',
  'related',
  'interested',
  'hundred',
  'united',
  'based',
  'red',
  'bed',
  'shed',
  'wed',
  'sacred',
  'naked',
  'wicked',
  'beloved',
  'rugged',
  'kindred',
  'expected',
]);

// Words that open a line but name a role or a thing, never an action.
const NOT_BASE_VERBS = new Set([
  'member',
  'point',
  'person',
  'team',
  'student',
  'president',
  'treasurer',
  'secretary',
  'volunteer',
  'intern',
  'assistant',
  'associate',
  'manager',
  'lead',
  'head',
  'staff',
  'summary',
  'objective',
  'skills',
  'education',
  'experience',
  'projects',
  'awards',
  'references',
  'store',
  'shift',
  'retail',
  'cashier',
  'server',
  'host',
  'operations',
  'variance',
  'and',
  'the',
  'a',
  'an',
  'my',
  'our',
  'with',
  'for',
  'in',
  'on',
  'at',
  'of',
  'to',
  'from',
  'by',
]);

// Base forms of ordinary work verbs that have no past-tense entry above and
// would not be derived from ACTION_VERBS (they are recognized as written).
const EXTRA_BASE = [
  // First jobs: babysitting, yard work, stores, games, and care.
  'babysit',
  'mow',
  'shelve',
  'bag',
  'stack',
  'rake',
  'shovel',
  'wash',
  'mop',
  'sweep',
  'walk',
  'play',
  'answer',
  'clean',
  'close',
  'count',
  'cover',
  'greet',
  'hire',
  'help',
  'open',
  'own',
  'pack',
  'post',
  'serve',
  'sort',
  'stock',
  'track',
  'unload',
  'load',
  'work',
  'file',
  'fix',
  'check',
  'process',
  'prepare',
  'cook',
  'assist',
  'support',
  'handle',
  'staff',
  'schedule',
  'order',
  'restock',
  'deliver',
  'book',
  'log',
  'enter',
  'update',
  'maintain',
  'run',
  'keep',
  'cut',
  'set',
  'write',
  'build',
  'make',
  'sell',
  'teach',
  'lead',
];

/** Turn a regular past tense into its base form: "stocked" -> "stock". */
function baseOfRegularPast(word: string): string[] {
  if (!word.endsWith('ed')) return [];
  const stem = word.slice(0, -2);
  const forms = [stem, `${stem}e`];
  if (word.endsWith('ied')) forms.push(`${word.slice(0, -3)}y`);
  // "planned" -> "plan", "stopped" -> "stop"
  if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
    forms.push(stem.slice(0, -1));
  }
  return forms;
}

// What people did at a first job, named outright so none of them depends on
// the -ed rule below: "Babysat for neighbors on weekends" opens with an action.
export const FIRST_JOB_VERBS = [
  'babysat',
  'played',
  'coached',
  'stocked',
  'served',
  'tutored',
  'cashiered',
  'cleaned',
  'delivered',
  'mowed',
  'walked',
  'cared',
  'watched',
  'bagged',
  'shelved',
  'greeted',
  'raked',
  'shoveled',
  'washed',
  'mopped',
  'swept',
  'fed',
  'drove',
  'sold',
  'taught',
  'folded',
  'packed',
  'sorted',
  'lifeguarded',
  'refereed',
  'umpired',
  'volunteered',
  'helped',
  'cooked',
  'baked',
  'prepped',
  'hosted',
  'bused',
  'bussed',
  'loaded',
  'unloaded',
  'counted',
  'opened',
  'closed',
  'answered',
  'translated',
  'interpreted',
] as const;

const PAST_FORMS = new Set<string>([
  ...ACTION_VERBS,
  ...Object.keys(IRREGULAR_PAST),
  ...FIRST_JOB_VERBS.filter((verb) => verb !== 'helped'),
]);
const BASE_FORMS = new Set<string>(EXTRA_BASE);
for (const past of ACTION_VERBS) {
  // Only the stem the list itself implies; ambiguous forms are skipped.
  const base = IRREGULAR_PAST[past];
  if (base) BASE_FORMS.add(base);
  else for (const form of baseOfRegularPast(past)) BASE_FORMS.add(form);
}
for (const base of Object.values(IRREGULAR_PAST)) BASE_FORMS.add(base);
for (const word of NOT_BASE_VERBS) BASE_FORMS.delete(word);

/** True when a single lowercase word reads as a verb at the start of a line. */
export function isVerbWord(raw: string): boolean {
  const word = raw.toLowerCase().replace(/[^a-z-]/g, '');
  if (word.length < 2 || NOT_VERBS.has(word) || NOT_BASE_VERBS.has(word)) return false;
  if (PAST_FORMS.has(word) || BASE_FORMS.has(word)) return true;
  // Regular past tense: "stocked", "counted", "posted", "covered".
  if (word.length >= 5 && word.endsWith('ed') && !word.endsWith('eed') && !word.includes('-')) {
    return true;
  }
  // Third-person present: "stocks", "manages", "coordinates".
  if (word.length >= 4 && word.endsWith('s') && !word.endsWith('ss')) {
    const stem = word.endsWith('es') ? [word.slice(0, -1), word.slice(0, -2)] : [word.slice(0, -1)];
    if (stem.some((form) => BASE_FORMS.has(form))) return true;
  }
  return false;
}

/**
 * Phrases that say the visitor was near the work without saying what they
 * did. A line that opens with one has an action, but a weak one.
 */
export const INVOLVEMENT_PHRASES = [
  'responsible for',
  'tasked with',
  'duties included',
  'helped with',
  'helped out with',
  'helped out',
  'assisted with',
  'worked on',
  'participated in',
  'involved in',
  'was involved in',
  'contributed to',
  'member of',
  'helped',
  'assisted',
  'supported',
  'participated',
  'contributed',
  'member',
] as const;

const INVOLVEMENT_PATTERN = new RegExp(
  `^(${INVOLVEMENT_PHRASES.map((p) => p.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i'
);

export type LeadingAction = {
  /** The words that open the line as written, for example "Stocked" or "Helped with". */
  text: string;
  /** True when the opening is a phrase of involvement rather than an action. */
  involvement: boolean;
};

function stripGlyph(line: string): string {
  return line.replace(/^\s*[-•*◦○●▪–—]\s*/, '').trim();
}

/** The verb or involvement phrase a line opens with, or null. */
export function leadingAction(line: string): LeadingAction | null {
  const text = stripGlyph(line);
  const involvement = text.match(INVOLVEMENT_PATTERN);
  if (involvement) return { text: involvement[1], involvement: true };
  const first = text.match(/^([A-Za-z][A-Za-z-]*)/)?.[1];
  if (first && isVerbWord(first)) return { text: first, involvement: false };
  return null;
}

/** True when the line opens with a verb or an involvement phrase. */
export function startsWithVerb(line: string): boolean {
  return leadingAction(line) !== null;
}

const BURIED_VERB_PATTERN = new RegExp(`\\b(${ACTION_VERBS.join('|')})\\b`, 'i');

/** True when a known action verb appears later in the line. */
export function hasBuriedVerb(line: string): boolean {
  return BURIED_VERB_PATTERN.test(stripGlyph(line));
}

const IRREGULAR_GERUND: Record<string, string> = {
  running: 'Ran',
  making: 'Made',
  writing: 'Wrote',
  leading: 'Led',
  building: 'Built',
  teaching: 'Taught',
  selling: 'Sold',
  buying: 'Bought',
  keeping: 'Kept',
  setting: 'Set',
  taking: 'Took',
  cutting: 'Cut',
  bringing: 'Brought',
  holding: 'Held',
  paying: 'Paid',
  finding: 'Found',
  meeting: 'Met',
  overseeing: 'Oversaw',
  getting: 'Got',
  giving: 'Gave',
  sending: 'Sent',
  spending: 'Spent',
  feeding: 'Fed',
  reading: 'Read',
  telling: 'Told',
  babysitting: 'Babysat',
  driving: 'Drove',
};

const NOT_GERUNDS =
  /(?:thing|^morning|^evening|^during|^ceiling|^string|^spring|^offspring|^wedding|^pudding|^sibling)$/;

/** "scheduling" -> "Scheduled", "running" -> "Ran". Null when unsure. */
export function gerundToPast(gerund: string): string | null {
  const word = gerund.toLowerCase();
  if (IRREGULAR_GERUND[word]) return IRREGULAR_GERUND[word];
  if (!word.endsWith('ing') || word.length < 6 || NOT_GERUNDS.test(word)) return null;
  const stem = word.slice(0, -3);
  const past = stem.endsWith('e') ? `${stem}d` : `${stem}ed`;
  if (!isVerbWord(past)) return null;
  return past.slice(0, 1).toUpperCase() + past.slice(1);
}

/**
 * The only verb help this tool offers: a question about what the visitor
 * actually did. It never proposes a grander verb ("Built" for working a
 * register, "Enabled" for helping), because that would change the facts.
 * Returns null when the opening verb is already an action.
 */
export function honestVerbQuestion(line: string): string | null {
  const opening = leadingAction(line);
  if (!opening?.involvement) return null;
  const phrase = opening.text.toLowerCase().replace(/\s+/g, ' ');
  const rest = stripGlyph(line).slice(opening.text.length).trim();
  const next = rest.match(/^([A-Za-z]+ing)\b\s*(.*)$/);

  if (phrase === 'responsible for' || phrase === 'tasked with' || phrase === 'duties included') {
    const past = next ? gerundToPast(next[1]) : null;
    if (past && next) {
      return `Who did the ${next[1].toLowerCase()}? If it was you, start the line with "${past}".`;
    }
    return 'What did you do as the person responsible? Start the line with that.';
  }
  if (phrase.startsWith('helped') || phrase.startsWith('assisted') || phrase === 'supported') {
    return 'What was your part? Start the line with the thing you did yourself.';
  }
  if (phrase === 'worked on') return 'What did you do on it? Start the line with that.';
  return 'What did you do there? Start the line with that.';
}
