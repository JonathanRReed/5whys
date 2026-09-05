import * as React from 'react';
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
  topicPlaceholder: string;
  questions: readonly QuestionBuilder[];
  example: TrackExample;
};

export const TRACKS: Record<'career' | 'interest', TrackConfig> = {
  career: {
    label: 'Career Path',
    description: 'You have a target role or industry in mind and want to pressure-test the reason.',
    topicLabel: 'Target role / path',
    topicPlaceholder: 'e.g., Product manager, UX researcher, nurse practitioner',
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
  interest: {
    label: 'Interest Path',
    description: 'You do not have a target yet. "I like biology" is enough to start.',
    topicLabel: 'Core interest',
    topicPlaceholder: 'e.g., Biology, game design, writing, climate',
    questions: [
      ({ topic }) =>
        `What specifically pulls you in about ${topic}? Not the whole subject, the exact part you would do for free.`,
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
  updatedAt: string;
  version: number;
};

export type Session = {
  id: string;
  track: Track;
  topic: string;
  responses: string[];
  updatedAt: string;
};

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

export function formatSnapshotTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
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
  return {
    id: typeof data.id === 'string' ? data.id : `snapshot_${cryptoRandom()}`,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    whyStatement:
      typeof data.whyStatement === 'string' && data.whyStatement
        ? data.whyStatement
        : derived.whyStatement,
    rootReason: typeof data.rootReason === 'string' ? data.rootReason : derived.root,
    nextStep: typeof data.nextStep === 'string' ? data.nextStep : derived.nextStep,
    track,
    topic,
    responses,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    version: typeof data.version === 'number' ? data.version : 1,
  } satisfies WhySnapshot;
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

/**
 * Condense a free-text answer into a short quotable fragment:
 * first sentence, capped at a word limit, trailing punctuation stripped.
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
  return truncated ? `${clipped}...` : clipped;
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
      prev: index === 0 ? '' : condenseAnswer(safe[index - 1]),
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
export function computeSynthesis(responses: unknown, topic: unknown, track: Track): Synthesis {
  const safe = ensureResponsesLength(responses);
  const topicText = typeof topic === 'string' ? topic.trim() : '';
  const firstEmpty = safe.findIndex((response) => response.trim().length === 0);
  const sequentialCount = firstEmpty === -1 ? WHY_COUNT : firstEmpty;
  const progressPercent = Math.round((sequentialCount / WHY_COUNT) * 100);
  const isComplete = sequentialCount === WHY_COUNT;

  const chain = safe.slice(0, sequentialCount).map((response) => condenseAnswer(response, 10));
  const surface = chain[0] ?? '';
  // The root is the user's full first sentence, never clipped mid-thought.
  const root = isComplete ? firstSentence(safe[WHY_COUNT - 1]) : '';
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
    whyStatement = `You started with ${quoted}. On the surface it was about "${surface}". Five layers down, the real reason: ${root} Act on that, not the surface.`;
  } else {
    whyStatement = `You started with ${quoted}. What pulls you in: "${surface}". What it is really about: ${root} A path fits when it feeds that, not just the surface.`;
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

export function useSynthesis(responses: string[], topic: string, track: Track): Synthesis {
  return React.useMemo(() => computeSynthesis(responses, topic, track), [responses, topic, track]);
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
