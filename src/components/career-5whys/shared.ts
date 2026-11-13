import * as React from 'react';
import { isNonAnswer, isRealAnswer, NON_ANSWER_FOLLOW_UP } from '../../lib/non-answer';
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
        prev ? `Why does "${prev}" matter to you?` : 'Why does your first answer matter to you?',
      ({ prev }) =>
        prev
          ? `And why does that matter? What sits underneath "${prev}"?`
          : 'And why does that matter? What sits underneath it?',
      ({ prev }) =>
        prev
          ? `Keep going. Why is "${prev}" strong enough to steer your career?`
          : 'Keep going. Why is that strong enough to steer your career?',
      ({ prev }) =>
        prev
          ? `Last layer. If "${prev}" is the real reason, what value or need sits at the root of it?`
          : 'Last layer. What value or need sits at the root of all this?',
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

/** The placeholder and worked example for a track in the visitor's register. */
export function trackSamples(
  track: Track,
  register: Register
): { topicPlaceholder: string; example: TrackExample } {
  const config = TRACKS[track];
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
  updatedAt: string;
};

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

/**
 * The full first sentence of an answer, with a period at the end. Used where
 * the user's own words should not be clipped mid-thought.
 */
export function firstSentence(raw: unknown): string {
  const text = (typeof raw === 'string' ? raw : '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/^[^.!?]+[.!?]?/);
  const sentence = (match ? match[0] : text).trim();
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
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
export function topicLabel(raw: string, track: Track): string {
  const fallback = track === 'career' ? 'this path' : 'this interest';
  const normalized = normalizeTopic(raw);
  if (!normalized) return fallback;
  const words = normalized.split(' ');
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
  const sentenceMatch = text.match(/^[^.!?]+/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).trim();
  const words = sentence.split(' ');
  const truncated = words.length > maxWords;
  const clipped = words
    .slice(0, maxWords)
    .join(' ')
    .replace(/[.,;:!?]+$/, '')
    .trim();
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
  const sentenceMatch = text.match(/^[^.!?]+/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).replace(/[.,;:!?]+$/, '').trim();
  return sentence.split(' ').length <= QUOTE_MAX_WORDS ? sentence : '';
}

/**
 * Build the five on-screen questions for a track. Depth 1 uses the topic;
 * every later depth interpolates a condensed version of the previous answer,
 * so the chain is built from the user's own words.
 */
export function buildPrompts(track: Track, topic: string, responses: string[]): string[] {
  const config = TRACKS[track];
  const safe = ensureResponsesLength(responses);
  // A sentence-shaped topic is reduced to a label the question can name.
  const label = topicLabel(topic, track);
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
  if (isNonAnswer(trimmed)) return NON_ANSWER_FOLLOW_UP;
  if (previous.trim() && isNearRepeat(trimmed, previous.trim())) {
    return 'This mostly restates your last answer. Go one level down: what does it protect, cost, or prove?';
  }
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 8) {
    return 'Short answer. Push one level deeper: name a value, a constraint, a moment, a person, or a fear.';
  }
  return null;
}

/**
 * One concrete "test this by" step, derived from track, topic, and the
 * language of the user's own answers. Never generic filler.
 */
export function suggestNextStep(track: Track, topic: string, answerText: string): string {
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
  const target = topicLabel(topic, track);
  if (track === 'career') {
    if (mentionsPeople) {
      return `Book 30 minutes with one person doing ${target} today. Ask what their week actually looks like, then check whether your root reason survives the answer.`;
    }
    if (mentionsBuilding) {
      return `Ship one small piece of the actual work of ${target} this month, no title required. If doing it feeds your root reason, the path holds.`;
    }
    if (mentionsLearning) {
      return `Take one short course or read one practitioner's honest writeup of ${target}. Compare the day-to-day against your root reason, not the job posting.`;
    }
    return `Talk to one person two years into ${target}. Trade your five whys for theirs and see if the roots match.`;
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
  track: Track,
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
  const quoted = topicText ? `"${topicText}"` : track === 'career' ? 'this path' : 'this interest';

  let whyStatement: string;
  if (sequentialCount === 0) {
    whyStatement =
      'Answer the first question and the chain starts building here, from your own words.';
  } else if (!isComplete) {
    const latest = chain[chain.length - 1];
    whyStatement = `Layer ${sequentialCount} of 5 answered. Latest reason: "${latest}". Keep asking why until the answer names a value or need.`;
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
  track: Track,
  rootIndex?: number
): Synthesis {
  return React.useMemo(
    () => computeSynthesis(responses, topic, track, rootIndex),
    [responses, topic, track, rootIndex]
  );
}

export function useStoredSession() {
  const [session, setSession] = React.useState<Session>(() => createEmptySession());
  const [mounted, setMounted] = React.useState(false);
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!isBrowser()) return;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) {
        // First visit: students and early-career people usually have an
        // interest before they have a target role, so start them there.
        if (isStudentLike(readProfile())) setSession(createEmptySession('interest'));
        return;
      }
      if (stored) {
        const fallback = createEmptySession();
        const parsed = JSON.parse(stored) as Partial<Session> | null;
        const data = parsed && typeof parsed === 'object' ? parsed : {};
        setSession({
          ...fallback,
          id: typeof data.id === 'string' ? data.id : fallback.id,
          track: data.track === 'interest' ? 'interest' : 'career',
          topic: typeof data.topic === 'string' ? data.topic : '',
          responses: ensureResponsesLength(data.responses),
          rootIndex: validRootIndex(data.rootIndex),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : fallback.updatedAt,
        });
      }
    } catch (err) {
      console.warn('Unable to load saved 5 Whys session', err);
      setStorageNotice('Previous progress could not be restored from storage.');
    }
  }, []);

  React.useEffect(() => {
    if (!mounted || !isBrowser()) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Unable to persist 5 Whys session', err);
      setStorageNotice('Auto-save is paused because browser storage is unavailable.');
    }
  }, [session, mounted]);

  return { session, setSession, storageNotice } as const;
}
