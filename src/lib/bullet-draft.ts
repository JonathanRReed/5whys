/**
 * A first draft of a resume bullet from what the visitor wrote on the
 * Bullets station: the experience and what happened because of it. Only
 * their words are used. The Resume Game's builder joins them (a verb, what
 * was done, what happened) and adds nothing but the joining words.
 */
import { buildBullet, hasResult, isVerbWord, leadingAction } from './resume-game';

export interface DraftFields {
  verb: string;
  task: string;
  result: string;
}

/** The sentences of what was written, each without its closing mark. */
function sentences(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  return flat
    .split(/(?<=[.!?])\s+/)
    .map((part) =>
      part
        .replace(/\.\.\.$/, '')
        .replace(/[.!?]+$/, '')
        .trim()
    )
    .filter(Boolean);
}

/** The first sentence, without a closing mark. */
function firstSentence(text: string): string {
  return sentences(text)[0] ?? '';
}

/** "I ran", "I've run", "We kept": the speaker, which a resume bullet leaves out. */
const SPEAKER = /^(?:i|i've|i'd|i'm|i'll|me and \w+|we|we've|we're)\s+/i;

/**
 * Where or when, said before the speaker: "At Brightline I built", "As
 * treasurer, I keep", "Last summer I ran". Only taken off when a speaker
 * follows, so a line that starts "At" for any other reason is left alone.
 */
const LEAD_IN =
  /^(?:at|in|on|during|for|from|as|with|when|while|after|before|since|last|this|every|each|over)\b[^.;:]{0,80}?,?\s+(?=(?:i|i've|i'd|i'm|we|we've)\s)/i;

/**
 * Forms of "be" and "have", and helpers like "can" and "used to". They sit
 * between the speaker and the action and are not the action: "I am the
 * treasurer" says what someone is, not what they did.
 */
const AUXILIARIES = new Set([
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'can',
  'could',
  'will',
  'would',
  'should',
  'may',
  'might',
  'must',
  'used',
  'to',
]);

/** Words that sit before the action without changing it: "I also ran". */
const ADVERBS = new Set([
  'also',
  'usually',
  'always',
  'often',
  'sometimes',
  'still',
  'just',
  'really',
  'mostly',
  'mainly',
  'then',
  'now',
  'already',
  'personally',
]);

/** Words that follow a speaker without being an action: "I not", "I the". */
const NEVER_A_VERB = new Set([
  'a',
  'an',
  'the',
  'not',
  'never',
  'my',
  'our',
  'this',
  'that',
  'there',
  'here',
  'very',
  'so',
  'and',
  'but',
  'or',
  'in',
  'on',
  'at',
  'of',
  'for',
  'with',
  'responsible',
  'part',
  'charge',
]);

type Clause = {
  /** The action word as written, or empty when there is none. */
  verb: string;
  /** What follows the action word. */
  rest: string;
  /** Everything that went before the action: a lead-in, the speaker, "have". */
  before: string;
};

/**
 * The action in a sentence someone wrote about themselves. "At Brightline I
 * built the schedule" has the action "built"; "I am the treasurer" has none;
 * "I keep the club budget" has "keep"; "Built the schedule" has "Built".
 *
 * A word right after the speaker is the action ("I watch my cousin") even
 * when it is not in the verb list, because nothing else can stand there in a
 * sentence about what someone does. After a form of "be" or "have", only a
 * known verb counts: "I have built" is an action, "I am the treasurer" is not.
 */
function findAction(sentence: string): Clause | null {
  const leadIn = sentence.match(LEAD_IN)?.[0] ?? '';
  const afterLead = sentence.slice(leadIn.length);
  const speaker = afterLead.match(SPEAKER)?.[0] ?? '';
  if (!speaker) {
    if (leadIn) return null;
    const opening = leadingAction(sentence);
    if (!opening || opening.involvement) return null;
    return { verb: opening.text, rest: sentence.slice(opening.text.length).trim(), before: '' };
  }
  let before = leadIn + speaker;
  let rest = afterLead.slice(speaker.length);
  // "I'm" carries its "am": only a known verb may follow it.
  let auxiliary = /'m\s*$/i.test(speaker) || /^we're/i.test(speaker);
  for (let step = 0; step < 4; step += 1) {
    const word = rest.match(/^[A-Za-z][A-Za-z'-]*/)?.[0] ?? '';
    if (!word) return null;
    const lower = word.toLowerCase();
    if (AUXILIARIES.has(lower) || ADVERBS.has(lower)) {
      if (AUXILIARIES.has(lower)) auxiliary = true;
      const skipped = rest.match(/^[A-Za-z][A-Za-z'-]*\s*/)?.[0] ?? word;
      before += skipped;
      rest = rest.slice(skipped.length);
      continue;
    }
    // "I helped with", "I was responsible for": near the work, not the work.
    const involvement = leadingAction(rest);
    if (involvement?.involvement) return null;
    if (isVerbWord(word) || (!auxiliary && !NEVER_A_VERB.has(lower) && /^[a-z]/.test(word))) {
      return { verb: word, rest: rest.slice(word.length).trim(), before };
    }
    return null;
  }
  return null;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The draft's three fields, seeded from the visitor's two answers. A field
 * stays empty when nothing in what they wrote fits it; nothing is made up.
 * The action is looked for in every sentence, so "I am the treasurer of the
 * club. I keep the budget." drafts from "keep", not from "am".
 */
export function draftFields(experience: string, impact: string): DraftFields {
  const said = sentences(experience);
  let verb = '';
  let task = '';
  for (const sentence of said) {
    const found = findAction(sentence);
    if (found) {
      verb = capitalize(found.verb);
      task = found.rest;
      break;
    }
  }
  if (!verb) {
    // No action anywhere: the first sentence, without the speaker and a
    // form of "be", is what they did, and the visitor is asked for the one
    // word. "I am the treasurer of the club" leaves "the treasurer of the
    // club", which reads right after "Served as".
    task = (said[0] ?? '')
      .replace(LEAD_IN, '')
      .replace(SPEAKER, '')
      .replace(/^(?:(?:am|is|are|was|were|have been|has been|had been)\s+)/i, '')
      .trim();
  }
  // "Because of the schedule I set up, volunteers stopped missing shifts":
  // the result is what follows the reason.
  const result = firstSentence(impact)
    .replace(/^(?:because(?: of)?|thanks to|after)\b[^,]{0,120},\s*/i, '')
    .trim();
  return { verb, task, result };
}

/** A result that already says how it joins: "so ...", "by ...", "saving ...". */
const JOINED = /^(?:so|which|leading|resulting|to|by|and|because|while|for|with|so that)\b/i;

/**
 * The task with the visitor's own "I built" taken off when the Verb field
 * already says what they did: "Built" and "at Brightline I built the
 * schedule" make "Built the schedule", never "Built at Brightline I built".
 */
function withoutOwnAction(verb: string, task: string): string {
  if (!verb.trim()) return task;
  const found = findAction(task);
  if (!found?.before) return task;
  return found.rest;
}

/** The draft as one bullet, or an empty string when there is nothing to join. */
export function draftBullet(fields: DraftFields): string {
  const typed = fields.result.trim();
  // The result follows "so", in the middle of a sentence: its first word
  // loses a sentence capital ("My drawer" becomes "my drawer"). "I", an
  // acronym, and a word capitalised inside ("iPhone", "McKay") are left.
  const opening = typed.match(/^[A-Za-z'-]+/)?.[0] ?? '';
  const sentenceCapital = /^[A-Z][a-z'-]*$/.test(opening) && opening !== 'I';
  const result = sentenceCapital ? typed[0].toLowerCase() + typed.slice(1) : typed;
  const first = result.match(/^[A-Za-z'-]+/)?.[0] ?? '';
  // "they ran their own registers" is a clause: it joins with "so", never
  // with "leading to".
  const joined =
    !result || JOINED.test(result) || /ing$/i.test(first) || isVerbWord(first)
      ? result
      : `so ${result}`;
  return buildBullet({
    verb: fields.verb,
    task: withoutOwnAction(fields.verb, fields.task.trim()),
    impact: joined,
    quantifier: '',
  });
}

/**
 * Every word of the draft that is not in the visitor's own text or one of the
 * joining words the builder uses. Empty when nothing was added.
 */
export function addedWords(draft: string, ...sources: string[]): string[] {
  const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const own = new Set(sources.flatMap(words));
  const JOINING = new Set(['so', 'and', 'leading', 'to', 'which', 'resulting', 'in']);
  return words(draft).filter((word) => !own.has(word) && !JOINING.has(word));
}

/**
 * True when a bullet opens with an action (not "Responsible for") and says
 * what happened because of it. Help that asks for those parts is then
 * beside the point.
 */
export function hasEveryPart(line: string): boolean {
  const opening = leadingAction(line);
  return Boolean(opening && !opening.involvement && hasResult(line));
}
