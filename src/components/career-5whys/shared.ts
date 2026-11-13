import * as React from 'react';
import {
  answerWordCount,
  isNonAnswer,
  isRealAnswer,
  nonAnswerFollowUp,
} from '../../lib/non-answer';
import { isStudentLike, readProfile } from '../../lib/profile';

export const WHY_COUNT = 5;
export const SESSION_KEY = 'career-why-session-v2';
export const HISTORY_KEY = 'career-why-history';
export const HISTORY_LIMIT_KEY = 'career-why-history-limit';
export const HISTORY_LIMIT_OPTIONS = [6, 12, 24] as const;
export const DEFAULT_HISTORY_LIMIT = 12;

export type Career5WhysProps = {
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
};

export type QuestionContext = {
  topic: string;
  prev: string;
};

export type QuestionBuilder = (ctx: QuestionContext) => string;

export type TrackExample = {
  persona: string;
  topic: string;
  answers: readonly string[];
};

export type TrackConfig = {
  label: string;
  description: string;
  topicLabel: string;
  /** Student register, the default. */
  topicPlaceholder: string;
  questions: readonly QuestionBuilder[];
  /** Student register, the default. */
  example: TrackExample;
  /** Shown instead when a saved profile says the visitor is past school. */
  professional?: { topicPlaceholder: string; example: TrackExample };
};

/** Which voice the samples speak in. Students first, always. */
export type Register = 'student' | 'professional';

export const TRACKS: Record<'career' | 'interest', TrackConfig> = {
  career: {
    label: 'Career Path',
    description: 'You have a target role or industry in mind and want to pressure-test the reason.',
    topicLabel: 'Target role / path',
    topicPlaceholder: 'e.g., Nursing, teaching, software developer',
    questions: [
      ({ topic }) => `What is pulling you toward ${topic} right now? Name the most concrete thing.`,
      ({ prev }) =>
        prev
          ? `Why does "${prev}" matter to you? What does it give you that other work would not?`
          : 'Why does that first reason matter to you? Say what it gives you that other work would not.',
      ({ prev }) =>
        prev
          ? `What sits underneath "${prev}"? Name the moment, the person, or the need it comes from.`
          : 'What sits underneath your last answer? Name the moment, the person, or the need it comes from.',
      ({ prev }) =>
        prev
          ? `Would "${prev}" still hold if the job paid less or had a smaller title? Say why it is strong enough to steer your choice.`
          : 'Would that reason still hold if the job paid less or had a smaller title? Say why it is strong enough to steer your choice.',
      ({ prev }) =>
        prev
          ? `Last layer. If "${prev}" is the real reason, what value or need sits at the root of it, the thing you would check for in any job?`
          : 'Last layer. What value or need sits at the root of all this, the thing you would check for in any job?',
    ],
    example: {
      persona: 'Second-year community college student, set on nursing',
      topic: 'Nursing',
      answers: [
        'I like the clinical rotation shadow days more than anything else in my classes. Being on the floor felt like the first time school was pointed at something real.',
        'On the floor I could see a person get calmer because someone explained what was happening to them. In class nothing changes for anyone when I get an answer right.',
        'When my little brother was in the hospital, the nurse was the only one who told us what the machines meant. I remember how much that helped my mom.',
        'I want to be the person who makes a scary place less confusing for a family. Being useful in a hard moment matters more to me than the title.',
        'I need work where helping someone understand what is happening is part of the job, not extra. That is what I would check for in any path, nursing or not.',
      ],
    },
    professional: {
      topicPlaceholder: 'e.g., Product manager, UX researcher, nurse practitioner',
      example: {
        persona: 'Career changer, six years in customer support, aiming at product management',
        topic: 'Product manager',
        answers: [
          'I keep getting pulled into fixing the product instead of apologizing for it. Twice this year I wrote specs for bugs that support kept eating, and both got shipped.',
          'I am tired of being downstream of decisions I could see coming. In support I catch the cost of a bad call six weeks late, after it has already burned users and my team.',
          'I want to be in the room where the tradeoffs get made. Watching preventable problems repeat makes me feel useless, and I have proof I can spot them early.',
          'If I stay where I am, I get better at absorbing damage instead of preventing it. Ten more years of that is a skill set I do not want.',
          'I need my work to change outcomes, not just soften them. Agency over prevention is what I am actually chasing, more than the title.',
        ],
      },
    },
  },
  interest: {
    label: 'Interest Path',
    description: 'You do not have a target yet. "I like biology" is enough to start.',
    topicLabel: 'Core interest',
    topicPlaceholder: 'e.g., Biology, game design, writing, climate',
    questions: [
      ({ topic }) =>
        `What specifically pulls you in about ${topic}? Not the whole subject, the exact part that holds your attention.`,
      ({ prev }) =>
        prev
          ? `Why "${prev}" and not the things next to it? What makes that part the one that sticks?`
          : 'Why that part and not the things next to it? What makes it the one that sticks?',
      ({ prev }) =>
        prev
          ? `When did "${prev}" start for you? Describe the moment or stretch of time that hooked you.`
          : 'When did this start for you? Describe the moment or stretch of time that hooked you.',
      ({ prev }) =>
        prev
          ? `Read "${prev}" back. What does that story say you value or need from work?`
          : 'Read your last answer back. What does that story say you value or need from work?',
      ({ prev }) =>
        prev
          ? `If "${prev}" is the need, what would a path have to show you before you trusted that it fits?`
          : 'What would a path have to show you before you trusted that it fits?',
    ],
    example: {
      persona: 'College sophomore, undeclared, started from "I like biology"',
      topic: 'Biology',
      answers: [
        'Not the memorization. The part where a tiny mechanism explains a huge visible thing, like one misfolded protein causing a whole disease.',
        'Chemistry has mechanisms too, but I do not care until it connects to a living thing. The explaining-life part is what sticks, not the lab technique.',
        "Tenth grade. My grandmother got a Parkinson's diagnosis and the doctor drew the dopamine pathway on a napkin. It was the first time something scary became something understandable.",
        'I need work that turns confusing, scary things into explanations people can act on. Understanding as a form of help, not just curiosity.',
        "A path fits if I can trace a line from mechanism to a person's outcome. Genetic counseling, medical research, and science writing all qualify. Pure bench work with no human on the other end probably does not.",
      ],
    },
  },
};

export type Track = keyof typeof TRACKS;

/**
 * The optional third start: one concrete experience instead of a role or an
 * interest. It is stored as the Interest Path with `start: 'experience'`, so
 * every reader that knows only the two tracks still reads it.
 */
export const EXPERIENCE: TrackConfig = {
  label: 'Start from an experience',
  description: 'Something you did that stuck with you: a shift, a project, a club, a hard week.',
  topicLabel: 'The experience',
  topicPlaceholder: 'e.g., Running the bake sale table, my first lab report',
  questions: [
    ({ topic }) =>
      topic === 'this experience'
        ? 'Tell the story of this experience. What did you do, in a sentence or two?'
        : `Tell the story of "${topic}". What did you do, in a sentence or two?`,
    ({ prev }) =>
      prev
        ? `Which part of "${prev}" did you like most? Say why that part and not the rest.`
        : 'Which part of it did you like most? Say why that part and not the rest.',
    ({ prev }) =>
      prev
        ? `Why does "${prev}" matter to you? What did it give you that an ordinary day does not?`
        : 'Why does that part matter to you? What did it give you that an ordinary day does not?',
    ({ prev }) =>
      prev
        ? `Where else have you felt "${prev}"? Say what the two moments share.`
        : 'Where else have you felt that? Say what the two moments share.',
    ({ prev }) =>
      prev
        ? `If "${prev}" is the need, what would a job have to let you do every week?`
        : 'If that is the need, what would a job have to let you do every week?',
  ],
  example: {
    persona: 'High school senior, started from a weekend job',
    topic: 'Closing the bakery on Saturdays',
    answers: [
      'On Saturdays I close the bakery alone. I count the drawer, pack the leftovers for the shelter, and write the list for the morning crew.',
      'Writing the list for the morning crew. When they come in, they know exactly what to do, and nobody has to call me.',
      'It means I left things easier for someone else. I like that my work keeps going after I go home.',
      'In group projects I am the one who makes the shared doc and the checklist. Both times I am setting up other people to do well.',
      'A job would have to let me set things up so a team runs smoothly, and let me see that it worked.',
    ],
  },
  professional: {
    topicPlaceholder: 'e.g., The quarter I rebuilt the onboarding process',
    example: {
      persona: 'Career changer, started from one hard quarter at work',
      topic: 'Rebuilding onboarding',
      answers: [
        'New hires kept quitting in their first month, so I rewrote our onboarding checklist and paired each one with a buddy for two weeks.',
        'Sitting with the first new hire who used it and watching her finish week one without asking me for help.',
        'It showed me a problem I could fix by changing how the work is set up, not by working longer hours.',
        'When I reorganized the stockroom years ago, it was the same feeling: the system did the work after I left.',
        'A job would have to let me design how work gets done for other people, and give me a way to see whether it helped.',
      ],
    },
  },
};

/** How a session starts: one of the two tracks, or from an experience. */
export type Lens = Track | 'experience';

export const LENSES: readonly Lens[] = ['career', 'interest', 'experience'];

export function lensConfig(lens: Lens): TrackConfig {
  return lens === 'experience' ? EXPERIENCE : TRACKS[lens];
}

/** The lens a stored session or snapshot was written in. */
export function lensOf(entry: { track: Track; start?: unknown }): Lens {
  return entry.start === 'experience' ? 'experience' : entry.track;
}

/** The placeholder and worked example for a track in the visitor's register. */
export function trackSamples(
  track: Lens,
  register: Register
): { topicPlaceholder: string; example: TrackExample } {
  const config = lensConfig(track);
  if (register === 'professional' && config.professional) return config.professional;
  return { topicPlaceholder: config.topicPlaceholder, example: config.example };
}

export type WhySnapshot = {
  id: string;
  timestamp: string;
  whyStatement: string;
  /** Full first sentence of the fifth answer: the root reason in the user's words. */
  rootReason: string;
  /** The "test this by" step derived from the answers. */
  nextStep: string;
  track: Track;
  topic: string;
  responses: string[];
  /** The answer the visitor chose as the real reason, when they chose one. */
  rootIndex?: number;
  /** Set when the chain started from an experience rather than a role or interest. */
  start?: 'experience';
  /** The statement the visitor assembled from their own phrases and edited. */
  statement?: string;
  /** What a role must offer, and what the visitor can give up, in their words. */
  mustOffer?: string;
  canGiveUp?: string;
  updatedAt: string;
  version: number;
};

export type Session = {
  id: string;
  track: Track;
  topic: string;
  responses: string[];
  /**
   * Which answer the visitor chose as the real reason (0 to 4). Absent means
   * the last one, which is where the chain ends but not always where the
   * insight is.
   */
  rootIndex?: number;
  start?: 'experience';
  statement?: string;
  mustOffer?: string;
  canGiveUp?: string;
  updatedAt: string;
};

/** The visitor's own closing words: statement and criteria. */
export type WhyOutcome = Pick<Session, 'statement' | 'mustOffer' | 'canGiveUp'>;

export const OUTCOME_FIELDS = ['statement', 'mustOffer', 'canGiveUp'] as const;

/** Copies only the outcome fields that hold text. */
export function readOutcome(data: Record<string, unknown>): WhyOutcome {
  const outcome: WhyOutcome = {};
  for (const field of OUTCOME_FIELDS) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) outcome[field] = value;
  }
  return outcome;
}

/** A saved root choice that points at one of the five answers, or undefined. */
export function validRootIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < WHY_COUNT
    ? value
    : undefined;
}

export function createEmptySession(track: Track = 'career'): Session {
  return {
    id: `whySession_${cryptoRandom()}`,
    track,
    topic: '',
    responses: Array(WHY_COUNT).fill(''),
    updatedAt: new Date().toISOString(),
  };
}

export function cryptoRandom() {
  if (typeof window === 'undefined' || !window.crypto?.randomUUID) {
    return Date.now().toString(36);
  }
  return window.crypto.randomUUID().split('-')[0];
}

export function isBrowser() {
  return typeof window !== 'undefined';
}

export function ensureResponsesLength(responses: unknown): string[] {
  const sanitized = Array.isArray(responses)
    ? responses
        .map((response) => (typeof response === 'string' ? response : ''))
        .slice(0, WHY_COUNT)
    : [];
  while (sanitized.length < WHY_COUNT) {
    sanitized.push('');
  }
  return sanitized;
}

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function normalizeSnapshot(entry: unknown): WhySnapshot | null {
  if (!entry || typeof entry !== 'object') return null;
  const data = entry as Record<string, unknown>;
  const track =
    data.track === 'career' || data.track === 'interest' ? (data.track as Track) : 'career';
  const topic = typeof data.topic === 'string' ? data.topic : '';
  const responses = ensureResponsesLength((data.responses as unknown) ?? []);
  // Snapshots saved before version 3 carry no root reason or next step;
  // derive both from the answers so old history still feeds the dashboard.
  const derived = computeSynthesis(responses, topic, track);
  const rootReason = typeof data.rootReason === 'string' ? data.rootReason : derived.root;
  // Snapshots saved before the choice was stored still name the root in
  // words; find the answer it came from so loading keeps that choice.
  const rootIndex =
    validRootIndex(data.rootIndex) ??
    (rootReason
      ? (() => {
          const found = responses.findIndex(
            (response) => response.trim() && firstSentence(response) === rootReason
          );
          return found === -1 || found === WHY_COUNT - 1 ? undefined : found;
        })()
      : undefined);
  return {
    id: typeof data.id === 'string' ? data.id : `snapshot_${cryptoRandom()}`,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    whyStatement:
      typeof data.whyStatement === 'string' && data.whyStatement
        ? data.whyStatement
        : derived.whyStatement,
    rootReason,
    nextStep: typeof data.nextStep === 'string' ? data.nextStep : derived.nextStep,
    track,
    topic,
    responses,
    ...(rootIndex !== undefined ? { rootIndex } : {}),
    ...(data.start === 'experience' && track === 'interest'
      ? { start: 'experience' as const }
      : {}),
    ...readOutcome(data),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    version: typeof data.version === 'number' ? data.version : 1,
  } satisfies WhySnapshot;
}

/**
 * The snapshot history as stored right now, or null when it cannot be read.
 * Read again before every change, so a save in one tab never drops what
 * another tab saved.
 */
export function readStoredHistory(): WhySnapshot[] | null {
  if (!isBrowser()) return [];
  try {
    const stored = window.localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizeSnapshot(entry)).filter(Boolean) as WhySnapshot[];
  } catch (err) {
    console.warn('Unable to load why snapshot history', err);
    return null;
  }
}

/** The same saved snapshot: same id and same save time. */
export function sameSnapshot(a: WhySnapshot, b: WhySnapshot): boolean {
  return a.id === b.id && a.timestamp === b.timestamp;
}

/** A first sentence, in writing that ends sentences with . ! ? or 。！？ */
const SENTENCE = /^[^.!?。！？]+[.!?。！？]?/;
const SENTENCE_END = /[.!?。！？]$/;
const SENTENCE_BODY = /^[^.!?。！？]+/;
const TRAILING_PUNCTUATION = /[.,;:!?。，、；：！？]+$/;

/**
 * The full first sentence of an answer, with a period at the end. Used where
 * the user's own words should not be clipped mid-thought.
 */
export function firstSentence(raw: unknown): string {
  const text = (typeof raw === 'string' ? raw : '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(SENTENCE);
  const sentence = (match ? match[0] : text).trim();
  return SENTENCE_END.test(sentence) ? sentence : `${sentence}.`;
}

const TOPIC_LEAD_INS = [
  /^i(?:'d|\s+would|\s+really|\s+think\s+i(?:'d)?)?\s+(?:want|wanted|would like|like|hope|plan|am planning|'m planning|am trying|'m trying|am hoping|'m hoping)\s+to\s+/i,
  /^i\s+(?:think\s+)?(?:want|wanted)\s+(?:a\s+)?(?:career|job|future)\s+(?:in|as)\s+/i,
  /^i\s+(?:am|'m)\s+(?:interested|curious)\s+in\s+/i,
  /^i\s+(?:am|'m)\s+(?:thinking|considering|looking)\s+(?:about|into|at)\s+/i,
  /^i\s+(?:like|love|enjoy)\s+/i,
  /^(?:become|becoming|be|being)\s+(?:a|an)\s+/i,
  /^(?:work|working|get|getting|go|going|move|moving|break|breaking)\s+(?:in|into|as|on|toward|towards)\s+(?:a\s+|an\s+|the\s+)?/i,
  /^(?:a|an)\s+(?:career|job|future|role)\s+(?:in|as)\s+(?:a\s+|an\s+)?/i,
  /^(?:the\s+)?field\s+of\s+/i,
];

/**
 * Turn "I want to work in product management" into "product management" so
 * the prompts and the next step can name the topic without splicing a whole
 * sentence into another sentence. Returns the trimmed topic when nothing
 * matches, so short noun phrases pass through unchanged.
 */
export function normalizeTopic(raw: string): string {
  let topic = raw.replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of TOPIC_LEAD_INS) {
      const next = topic.replace(pattern, '');
      if (next !== topic) {
        topic = next.trim();
        changed = true;
      }
    }
  }
  return topic.replace(/[.,;:!?]+$/, '').trim();
}

/**
 * A short label the templates can splice into a sentence. Long or sentence-
 * shaped topics fall back to the neutral label so the copy never reads
 * "one person doing I want to work in product management".
 */
export function topicLabel(raw: string, track: Lens): string {
  const fallback =
    track === 'career' ? 'this path' : track === 'experience' ? 'this experience' : 'this interest';
  const normalized = normalizeTopic(raw);
  if (!normalized) return fallback;
  const words = normalized.split(' ');
  if (track === 'experience') return words.length > 8 ? fallback : normalized;
  const readsLikeSentence =
    words.length > 6 ||
    /^(i|we|you|it|my|our|they|to|that|there)\b/i.test(normalized) ||
    /\b(want|wanted|need|think|feel|should|would|could|am|is|are)\b/i.test(normalized);
  return readsLikeSentence ? fallback : normalized;
}

/** Answers up to this many words are quoted whole in the next question. */
export const QUOTE_MAX_WORDS = 14;

/**
 * Condense a free-text answer into a short quotable fragment: the first
 * sentence, cut at a word boundary when it runs past the limit. A cut is
 * marked with an ellipsis so it never reads as the whole answer.
 */
export function condenseAnswer(raw: unknown, maxWords = 10): string {
  const text = (typeof raw === 'string' ? raw : '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentenceMatch = text.match(SENTENCE_BODY);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).trim();
  const words = sentence.split(' ');
  // Writing without spaces is one long "word" to split(' '); clip it by
  // characters instead, about four per word.
  const letters = Array.from(sentence);
  if (words.length === 1 && letters.length > maxWords * 4) {
    return `${letters
      .slice(0, maxWords * 3)
      .join('')
      .replace(TRAILING_PUNCTUATION, '')}\u2026`;
  }
  const truncated = words.length > maxWords;
  const clipped = words.slice(0, maxWords).join(' ').replace(TRAILING_PUNCTUATION, '').trim();
  return truncated ? `${clipped}\u2026` : clipped;
}

/**
 * The previous answer as the next question may quote it: the whole first
 * sentence when it is short, or nothing when it is long. A question never
 * quotes a clipped answer, because "Why does "I just need a..." matter" reads
 * as if the cut were what the visitor said. Placeholders such as "idk" are
 * not quoted either.
 */
export function quotableAnswer(raw: unknown): string {
  if (!isRealAnswer(raw)) return '';
  const text = (raw as string).replace(/\s+/g, ' ').trim();
  const sentenceMatch = text.match(SENTENCE_BODY);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text)
    .replace(TRAILING_PUNCTUATION, '')
    .trim();
  return answerWordCount(sentence) <= QUOTE_MAX_WORDS ? sentence : '';
}

/**
 * Build the five on-screen questions for a track. Depth 1 uses the topic;
 * every later depth interpolates a condensed version of the previous answer,
 * so the chain is built from the user's own words.
 */
export function buildPrompts(track: Lens, topic: string, responses: string[]): string[] {
  const config = lensConfig(track);
  const safe = ensureResponsesLength(responses);
  // A sentence-shaped topic is reduced to a label the question can name.
  const named = topicLabel(topic, track);
  // A role or an interest reads lowercase mid-sentence; an experience is
  // quoted as the visitor wrote it.
  const label = track === 'experience' ? named : midSentence(named);
  return config.questions.map((build, index) =>
    build({
      topic: label,
      prev: index === 0 ? '' : quotableAnswer(safe[index - 1]),
    })
  );
}

const NUDGE_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'you',
  'are',
  'was',
  'were',
  'will',
  'would',
  'could',
  'should',
  'about',
  'when',
  'what',
  'how',
  'why',
  'who',
  'its',
  'not',
  'but',
  'than',
  'then',
  'they',
  'them',
  'have',
  'has',
  'had',
  'been',
  'being',
  'because',
  'really',
  'just',
  'want',
]);

function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !NUDGE_STOPWORDS.has(word))
  );
}

/** True when the current answer mostly restates the previous one. */
export function isNearRepeat(current: string, previous: string): boolean {
  const a = significantTokens(current);
  const b = significantTokens(previous);
  if (a.size < 3 || b.size < 3) return false;
  let overlap = 0;
  a.forEach((word) => {
    if (b.has(word)) overlap += 1;
  });
  const union = a.size + b.size - overlap;
  return union > 0 && overlap / union >= 0.6;
}

/**
 * Gentle inline prompt for shallow answers. Never blocks progression.
 * Returns null when the answer is empty or deep enough.
 */
export function getAnswerNudge(current: string, previous: string): string | null {
  const trimmed = current.trim();
  if (!trimmed) return null;
  if (isNonAnswer(trimmed)) return nonAnswerFollowUp(trimmed);
  if (previous.trim() && isNearRepeat(trimmed, previous.trim())) {
    return 'This mostly restates your last answer. Go one level down: what does it protect, cost, or prove?';
  }
  if (answerWordCount(trimmed) < 8) {
    return 'This counts. To make it stronger, name a value, a constraint, a moment, a person, or a fear.';
  }
  return null;
}

/**
 * The topic as it reads inside a sentence: "Operations analyst" becomes
 * "operations analyst". A word with capitals inside it ("UX", "iOS") is a
 * name or an acronym and keeps its case.
 */
export function midSentence(label: string): string {
  return label.replace(/^(\p{Lu})(\p{Ll}*)(?=[\s,]|$)/u, (_, first: string, rest: string) =>
    rest ? `${first.toLowerCase()}${rest}` : `${first}${rest}`
  );
}

/**
 * "Research technician or pharmacy" is two options, not one. Splits a topic
 * on "or", "vs" and "versus" (and the commas of a list that uses them) into
 * two or three options. Anything else is one option.
 */
export function topicOptions(label: string): string[] {
  if (!/\s(?:or|vs\.?|versus)\s/i.test(label)) return [label];
  const parts = label
    .split(/\s*,\s*(?:or\s+)?|\s+(?:or|vs\.?|versus)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 && parts.length <= 3 ? parts : [label];
}

/** Words that end like a job title but name a field or a thing. */
const NOT_ROLES = new Set([
  'career',
  'computer',
  'content',
  'water',
  'paper',
  'power',
  'theater',
  'theatre',
  'sector',
  'student',
  'nonprofit',
  'art',
  'tech',
]);
const ROLE_ENDING =
  /(?:er|or|ist|ian|ant|ent|eer|nurse|chef|lead|analyst|assistant|associate|clerk|aide|specialist|scientist|therapist|physician|coach|pilot|medic|tutor|vet|tech)$/i;

/** True when the option names a person's job ("research technician") rather than a field ("pharmacy"). */
export function isRoleTitle(option: string): boolean {
  const words = option.trim().split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase() ?? '';
  if (!last || /ment$/.test(last)) return false;
  // "Tech" alone is a field; "pharmacy tech" is a job.
  if (words.length === 1 && NOT_ROLES.has(last)) return false;
  return ROLE_ENDING.test(last);
}

/** "a research technician", "an operations analyst", "an MBA student", "a UX designer". */
function withArticle(noun: string): string {
  const first = noun.trim().split(/\s+/)[0] ?? '';
  const acronym = first.length > 1 && first === first.toUpperCase() && /\p{Lu}/u.test(first);
  const vowelSound = acronym
    ? /^[AEFHILMNORSX]/.test(first)
    : /^[aeiou]/i.test(first) && !/^(?:uni|use|usu|eu|one)/i.test(first);
  return `${vowelSound ? 'an' : 'a'} ${noun}`;
}

/** "as a research technician" or "in pharmacy". */
function worksPhrase(option: string, fallback: boolean): string {
  if (fallback) return 'on this path';
  return isRoleTitle(option) ? `as ${withArticle(option)}` : `in ${option}`;
}

/** "a research technician" or "pharmacy". */
function workOf(option: string): string {
  return isRoleTitle(option) ? withArticle(option) : option;
}

/** "A", "A and B", "A, B, and C". */
function list(items: string[]): string {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * One concrete "test this by" step, derived from track, topic, and the
 * language of the user's own answers. Never generic filler. A topic that
 * names two or three options gets the test for each of them.
 */
export function suggestNextStep(track: Lens, topic: string, answerText: string): string {
  const text = answerText.toLowerCase();
  const mentionsPeople =
    /\b(people|person|help|helping|teach|teaching|mentor|patient|patients|student|students|user|users|team|community|communities|family|kids|children)\b/.test(
      text
    );
  const mentionsBuilding =
    /\b(build|building|built|make|making|create|creating|design|designing|ship|shipping|project|prototype|write|writing|craft)\b/.test(
      text
    );
  const mentionsLearning =
    /\b(learn|learning|understand|understanding|research|curious|curiosity|explain|explaining|knowledge|mechanism|study|studying)\b/.test(
      text
    );
  const label = topicLabel(topic, track);
  const fallback = label !== normalizeTopic(topic) || !normalizeTopic(topic);
  const options = fallback ? [label] : topicOptions(midSentence(label));
  const target = options[0] ?? label;

  if (track === 'experience') {
    if (mentionsPeople) {
      return 'Ask one person whose job includes the part you liked most what their week looks like. Listen for whether that part is a small piece of the job or most of it.';
    }
    return 'Find one job posting that names the part you liked most as a duty, not a perk. Then turn this experience into a story you can tell in an interview or an intro.';
  }

  if (track === 'career') {
    if (options.length > 1) {
      const works = options.map((option) => `who works ${worksPhrase(option, false)}`);
      const people = works.map(
        (phrase, index) => `${index === 0 ? 'one person' : 'one'} ${phrase}`
      );
      if (mentionsPeople) {
        return `Book 30 minutes with ${list(people)} this week. Ask each what their week actually looks like, then check which answer your root reason survives.`;
      }
      if (mentionsBuilding) {
        return `Try one small piece of the actual work of each, ${list(options.map(workOf))}, this month. The one that feeds your root reason is the one to look at harder.`;
      }
      if (mentionsLearning) {
        return `Read one honest account from ${list(works.map((phrase) => `someone ${phrase}`))}. Compare each day-to-day against your root reason, not the job posting.`;
      }
      return `Talk to ${list(people)}. Trade your five whys for theirs and see whose roots match yours.`;
    }
    const works = worksPhrase(target, fallback);
    if (mentionsPeople) {
      return `Book 30 minutes with one person who works ${works} today. Ask what their week actually looks like, then check whether your root reason survives the answer.`;
    }
    if (mentionsBuilding) {
      return `Ship one small piece of the actual work of ${fallback ? target : workOf(target)} this month, no title required. If doing it feeds your root reason, the path holds.`;
    }
    if (mentionsLearning) {
      return `Take one short course, or read one honest account from someone who works ${works}. Compare the day-to-day against your root reason, not the job posting.`;
    }
    return `Talk to one person who has worked ${works} for about two years. Trade your five whys for theirs and see if the roots match.`;
  }

  if (options.length > 1) {
    if (mentionsPeople) {
      const people = options.map((option, index) =>
        index === 0
          ? `one person who turned ${option} into work`
          : `one who turned ${option} into work`
      );
      return `Find ${list(people)}. Ask each one question: which part survived becoming a job?`;
    }
    if (mentionsBuilding) {
      return `Make one small thing from each, ${list(options)}, this week. Two hours each, zero stakes. Notice which one you want a second session of.`;
    }
    if (mentionsLearning) {
      return `Go one level deeper than class goes on each of ${list(options)}: one lecture, paper, or video apiece. Notice which one pulls you back.`;
    }
    return `Give ${list(options)} two focused hours each this week. Wanting a third hour of one of them is the signal you are looking for.`;
  }
  if (mentionsPeople) {
    return `Find one person who turned ${target} into work and ask one question: which part survived becoming a job?`;
  }
  if (mentionsBuilding) {
    return `Make one small thing from ${target} this week. Two hours, zero stakes. Notice whether you want a second session.`;
  }
  if (mentionsLearning) {
    return `Go one level deeper than class goes: one lecture, paper, or video on the exact part of ${target} you named. Boredom or pull, either result is data.`;
  }
  return `Give ${target} two focused hours this week in any form. Wanting a third hour is the signal you are looking for.`;
}

export type Synthesis = {
  /** Condensed depth 1 answer: the stated reason. */
  surface: string;
  /** Condensed depth 5 answer: the root reason. Empty until the chain is complete. */
  root: string;
  /** Condensed answers in order, the evidence trail. */
  chain: string[];
  sequentialCount: number;
  progressPercent: number;
  isComplete: boolean;
  whyStatement: string;
  nextStep: string;
};

/**
 * Honest synthesis built from the user's actual answers. No keyword
 * frequency, no invented confidence. Handles malformed input defensively
 * so old localStorage data can never crash the summary.
 */
export function computeSynthesis(
  responses: unknown,
  topic: unknown,
  track: Lens,
  rootIndex?: number
): Synthesis {
  const safe = ensureResponsesLength(responses);
  const topicText = typeof topic === 'string' ? topic.trim() : '';
  // A placeholder such as "idk" holds the chain where it is, the same as an
  // empty box: it is not captured, quoted, or counted toward completion.
  const firstEmpty = safe.findIndex((response) => !isRealAnswer(response));
  const sequentialCount = firstEmpty === -1 ? WHY_COUNT : firstEmpty;
  const progressPercent = Math.round((sequentialCount / WHY_COUNT) * 100);
  const isComplete = sequentialCount === WHY_COUNT;

  const chain = safe.slice(0, sequentialCount).map((response) => condenseAnswer(response, 10));
  const surface = chain[0] ?? '';
  // The root is the user's full first sentence, never clipped mid-thought.
  const chosen = validRootIndex(rootIndex);
  const picked = chosen !== undefined && chosen !== WHY_COUNT - 1 && safe[chosen].trim().length > 0;
  const root = isComplete ? firstSentence(safe[picked ? (chosen as number) : WHY_COUNT - 1]) : '';
  const rootSource = picked
    ? 'The reason you picked as the real one'
    : 'Working hypothesis from your final answer';
  // Quote the topic exactly as typed instead of splicing it into a sentence.
  const quoted = topicText ? `"${topicText}"` : topicLabel('', track);

  let whyStatement: string;
  if (sequentialCount === 0) {
    whyStatement =
      'Answer the first question and the chain starts building here, from your own words.';
  } else if (!isComplete) {
    const latest = chain[chain.length - 1];
    whyStatement = `Layer ${sequentialCount} of 5 answered. Latest reason: "${latest}". Keep asking why until the answer names a value or need.`;
  } else if (track === 'experience') {
    whyStatement = `You started from ${quoted}. What happened: "${surface}". ${rootSource}: ${root} An experience like this is a story you can tell in an interview or an intro.`;
  } else if (track === 'career') {
    whyStatement = `You started with ${quoted}. On the surface it was about "${surface}". ${rootSource}: ${root} Use the next step to test it against a real experience. Earlier answers may matter too.`;
  } else {
    whyStatement = `You started with ${quoted}. What pulls you in: "${surface}". ${rootSource}: ${root} Try a small activity to test whether that motivation holds up. You can revise it as you learn.`;
  }

  const nextStep = isComplete ? suggestNextStep(track, topicText, safe.join(' ')) : '';

  return {
    surface,
    root,
    chain,
    sequentialCount,
    progressPercent,
    isComplete,
    whyStatement,
    nextStep,
  };
}

export function useSynthesis(
  responses: string[],
  topic: string,
  track: Lens,
  rootIndex?: number
): Synthesis {
  return React.useMemo(
    () => computeSynthesis(responses, topic, track, rootIndex),
    [responses, topic, track, rootIndex]
  );
}

export function useStoredSession() {
  const [session, setLoaded] = React.useState<Session>(() => createEmptySession());
  const [mounted, setMounted] = React.useState(false);
  // True once the visitor has changed something. Opening the page only reads:
  // another tab, or an import on the dashboard, may have saved newer work, and
  // writing back the snapshot this tab loaded would destroy it.
  const changed = React.useRef(false);
  const setSession = React.useCallback<React.Dispatch<React.SetStateAction<Session>>>((next) => {
    changed.current = true;
    setLoaded(next);
  }, []);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!isBrowser()) return;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) {
        // First visit: students and early-career people usually have an
        // interest before they have a target role, so start them there.
        if (isStudentLike(readProfile())) setLoaded(createEmptySession('interest'));
        return;
      }
      if (stored) {
        const fallback = createEmptySession();
        const parsed = JSON.parse(stored) as Partial<Session> | null;
        const data = parsed && typeof parsed === 'object' ? parsed : {};
        setLoaded({
          ...fallback,
          id: typeof data.id === 'string' ? data.id : fallback.id,
          track: data.track === 'interest' ? 'interest' : 'career',
          topic: typeof data.topic === 'string' ? data.topic : '',
          responses: ensureResponsesLength(data.responses),
          rootIndex: validRootIndex(data.rootIndex),
          ...(data.start === 'experience' && data.track === 'interest'
            ? { start: 'experience' as const }
            : {}),
          ...readOutcome(data as Record<string, unknown>),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : fallback.updatedAt,
        });
      }
    } catch (err) {
      console.warn('Unable to load saved 5 Whys session', err);
      setStorageNotice('Previous progress could not be restored from storage.');
    }
  }, []);

  React.useEffect(() => {
    if (!mounted || !changed.current || !isBrowser()) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Unable to persist 5 Whys session', err);
      setStorageNotice('Auto-save is paused because browser storage is unavailable.');
    }
  }, [session, mounted]);

  return { session, setSession, storageNotice } as const;
}
