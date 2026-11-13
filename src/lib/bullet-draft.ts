/**
 * A first draft of a resume bullet from what the visitor wrote on the
 * Bullets station: the experience and what happened because of it. Only
 * their words are used. The Resume Game's builder joins them (a verb, what
 * was done, what happened) and adds nothing but the joining words.
 */
import { buildBullet, isVerbWord, leadingAction } from './resume-game';

export interface DraftFields {
  verb: string;
  task: string;
  result: string;
}

/** The first sentence, without a closing mark. */
function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](?:\s|$)/);
  return (end === -1 ? flat : flat.slice(0, end)).replace(/\.\.\.$/, '').trim();
}

/** "I ran", "I've run", "I was": the speaker, which a resume bullet leaves out. */
const SPEAKER = /^(?:i|i've|i'd|i have|i had|me and \w+|we)\s+/i;

/**
 * The draft's three fields, seeded from the visitor's two answers. A field
 * stays empty when nothing in what they wrote fits it; nothing is made up.
 */
export function draftFields(experience: string, impact: string): DraftFields {
  const said = firstSentence(experience).replace(SPEAKER, '');
  const opening = leadingAction(said);
  const verb =
    opening && !opening.involvement
      ? opening.text.charAt(0).toUpperCase() + opening.text.slice(1)
      : '';
  const task = (verb ? said.slice(opening?.text.length ?? 0) : said).trim();
  // "Because of the schedule I set up, volunteers stopped missing shifts":
  // the result is what follows the reason.
  const result = firstSentence(impact)
    .replace(/^(?:because(?: of)?|thanks to|after)\b[^,]{0,120},\s*/i, '')
    .trim();
  return { verb, task, result };
}

/** A result that already says how it joins: "so ...", "by ...", "saving ...". */
const JOINED = /^(?:so|which|leading|resulting|to|by|and|because|while|for|with|so that)\b/i;

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
  return buildBullet({ verb: fields.verb, task: fields.task, impact: joined, quantifier: '' });
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
