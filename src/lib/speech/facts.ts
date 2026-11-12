export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}
export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
}
export interface FillerDefinition {
  phrase: string;
  contextDependent: boolean;
}
export const DEFAULT_FILLERS: readonly FillerDefinition[] = [
  ...['um', 'uh', 'er', 'ah', 'hmm'].map((phrase) => ({ phrase, contextDependent: false })),
  ...['you know', 'sort of', 'kind of', 'I mean'].map((phrase) => ({
    phrase,
    contextDependent: true,
  })),
];
export interface FillerOccurrence {
  wordIndex: number;
  timestamp: { start: number; end: number } | null;
}
export interface FillerCount extends FillerDefinition {
  count: number;
  occurrences: FillerOccurrence[];
}
export interface DeliveryFacts {
  wordCount: number;
  durationSeconds: number;
  wordsPerMinute: number | null;
  fillers: FillerCount[];
  pauses: { start: number; end: number; durationSeconds: number }[];
}
export interface DeliveryFactsInput {
  text: string;
  segments?: readonly TranscriptSegment[];
  durationSeconds: number;
  pauseThresholdSeconds?: number;
  fillers?: readonly (string | FillerDefinition)[];
}
const words = (text: string) =>
  text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
/** Counts only. Segment timestamps locate fillers to a segment, never an invented word boundary. */
export function deliveryFacts({
  text,
  segments = [],
  durationSeconds,
  pauseThresholdSeconds = 2,
  fillers = DEFAULT_FILLERS,
}: DeliveryFactsInput): DeliveryFacts {
  const tokens = words(text);
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  const threshold = Number.isFinite(pauseThresholdSeconds) ? Math.max(0, pauseThresholdSeconds) : 2;
  const timed = segments
    .filter(
      (s) =>
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.start >= 0 &&
        s.end >= s.start &&
        s.end <= duration
    )
    .toSorted((a, b) => a.start - b.start);
  const timedWords = timed.flatMap((s) =>
    words(s.text).map((token) => ({ token, start: s.start, end: s.end }))
  );
  const aligned =
    timedWords.length === tokens.length && timedWords.every((w, i) => w.token === tokens[i]);
  const seen = new Set<string>();
  const counts: FillerCount[] = [];
  for (const filler of fillers) {
    const definition =
      typeof filler === 'string'
        ? { phrase: filler, contextDependent: words(filler).length > 1 }
        : filler;
    const phrase = words(definition.phrase);
    const key = phrase.join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const occurrences: FillerOccurrence[] = [];
    for (let i = 0; i <= tokens.length - phrase.length; i++) {
      if (phrase.every((token, j) => tokens[i + j] === token)) {
        occurrences.push({
          wordIndex: i,
          timestamp: aligned
            ? { start: timedWords[i].start, end: timedWords[i + phrase.length - 1].end }
            : null,
        });
        i += phrase.length - 1;
      }
    }
    counts.push({ ...definition, count: occurrences.length, occurrences });
  }
  const pauses: DeliveryFacts['pauses'] = [];
  let previousEnd: number | undefined;
  for (const segment of timed.filter((s) => words(s.text).length)) {
    if (previousEnd !== undefined && segment.start - previousEnd > threshold)
      pauses.push({
        start: previousEnd,
        end: segment.start,
        durationSeconds: segment.start - previousEnd,
      });
    previousEnd = Math.max(previousEnd ?? 0, segment.end);
  }
  return {
    wordCount: tokens.length,
    durationSeconds: duration,
    wordsPerMinute: duration >= 5 && tokens.length ? (tokens.length / duration) * 60 : null,
    fillers: counts,
    pauses,
  };
}
