import * as React from 'react';

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

export const TRACKS = {
  career: {
    label: 'Career Path',
    description: 'Use this when you already have a target role or industry in mind.',
    topicLabel: 'Target role / path',
    topicPlaceholder: 'e.g., Senior UX Researcher, Product Ops Lead',
    prompts: [
      'What about this role is currently motivating you?',
      'Why does that motivation matter for the work you want to do?',
      'What changes for other people when you succeed at this role?',
      'Why is that impact personally significant to you?',
      'What is the underlying principle or value you refuse to compromise?',
    ],
    hints: [
      'Anchor on the most tangible pull: problems, responsibilities, or environment.',
      'Tie the previous answer to something you care about mastering or improving.',
      'Think about users, teams, or systems that benefit when you do this well.',
      'Connect the external change to an internal driver (curiosity, autonomy, rigor).',
      'Name the guiding principle that shows up even outside of work.',
    ],
  },
  interest: {
    label: 'Interest Path',
    description: 'Use this route when you are still mapping interests into possible careers.',
    topicLabel: 'Core interest or theme',
    topicPlaceholder: 'e.g., Urban mobility, ethical AI, adaptive learning',
    prompts: [
      'Which pattern or topic keeps surfacing in your work or curiosity?',
      'Why does it hold your attention when many other things do not?',
      'Who benefits if this interest becomes a project or product?',
      'Why do you feel responsible for pushing that benefit forward?',
      'What identity or value are you ultimately protecting or proving?',
    ],
    hints: [
      'Capture the motif, not the job title. Think domains or problems.',
      'Reference formative moments, frustrations, or obsessions.',
      'Consider communities, audiences, or even your future self.',
      'Focus on agency: why do you believe you should move first?',
      'What theme shows up in your decisions regardless of context?',
    ],
  },
} as const;

export type Track = keyof typeof TRACKS;

export type WhySnapshot = {
  id: string;
  timestamp: string;
  whyStatement: string;
  track: Track;
  topic: string;
  responses: string[];
  theme: string;
  alignment: string;
  updatedAt: string;
  version: number;
  userId?: string;
};

export type Session = {
  id: string;
  track: Track;
  topic: string;
  responses: string[];
  theme: string;
  alignment: string;
  updatedAt: string;
};

export function createEmptySession(track: Track = 'career'): Session {
  return {
    id: `whySession_${cryptoRandom()}`,
    track,
    topic: '',
    responses: Array(WHY_COUNT).fill(''),
    theme: '',
    alignment: '',
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
    ? responses.map((response) => (typeof response === 'string' ? response : '')).slice(0, WHY_COUNT)
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
  const track = data.track === 'career' || data.track === 'interest' ? (data.track as Track) : 'career';
  return {
    id: typeof data.id === 'string' ? data.id : `snapshot_${cryptoRandom()}`,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    whyStatement: typeof data.whyStatement === 'string' ? data.whyStatement : '',
    track,
    topic: typeof data.topic === 'string' ? data.topic : '',
    responses: ensureResponsesLength((data.responses as unknown) ?? []),
    theme: typeof data.theme === 'string' ? data.theme : '',
    alignment: typeof data.alignment === 'string' ? data.alignment : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    version: typeof data.version === 'number' ? data.version : 1,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
  } satisfies WhySnapshot;
}

export function useSynthesis(responses: string[], topic: string, track: Track) {
  const STOPWORDS = React.useMemo(
    () =>
      new Set([
        'the','and','for','with','that','this','from','into','your','you','are','our','was','were','will','would','could','should','about','when','what','how','why','who','whom','to','of','in','on','at','by','as','it','its','is','be','an','a','or','but','if','than','then','so','we','i','me','my','mine','their','theirs','them','they','us','we','do','did','done','doing','because'
      ]),
    []
  );

  const extractKeywords = React.useCallback(
    (text: string, max = 5) => {
      const counts = new Map<string, number>();
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
        .forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([w]) => w);
    },
    [STOPWORDS]
  );

  const computeSynthesis = React.useCallback(
    (responses: string[], topic: string, track: Track) => {
      const cleaned = responses.map((r) => r.trim()).filter(Boolean);
      const coverage = Math.min(100, Math.round((cleaned.length / WHY_COUNT) * 100));
      if (cleaned.length === 0) {
        return { theme: '', alignment: '', confidence: coverage } as const;
      }
      const mid = Math.max(1, Math.floor(cleaned.length / 2));
      const early = cleaned.slice(0, mid).join(' ');
      const late = cleaned.slice(mid).join(' ');
      const lateKeys = extractKeywords(late, 3);
      const earlyKeys = extractKeywords(early, 3);
      const title = (arr: string[]) => arr.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
      let theme = title(lateKeys) || cleaned[cleaned.length - 1] || '';
      let alignment = title(earlyKeys) || cleaned[0] || '';
      if (!theme && track === 'interest') theme = topic || theme;
      if (!alignment && track === 'career') alignment = topic || alignment;
      return { theme, alignment, confidence: coverage } as const;
    },
    [extractKeywords]
  );

  const synthesized = computeSynthesis(responses, topic, track);
  const firstEmptyIndex = responses.findIndex((r) => r.trim().length === 0);
  const sequentialCount = firstEmptyIndex === -1 ? WHY_COUNT : firstEmptyIndex;
  const sequentialConfidence = Math.round((sequentialCount / WHY_COUNT) * 100);

  return { ...synthesized, sequentialCount, sequentialConfidence } as const;
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
      if (stored) {
        const fallback = createEmptySession();
        const parsed = JSON.parse(stored) as Session;
        setSession({ ...fallback, ...parsed });
      }
    } catch (err) {
      console.warn('Unable to load saved 5 Whys session', err);
      setStorageNotice('Previous progress could not be restored from storage.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
