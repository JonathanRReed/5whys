import * as React from 'react';
import { answerNotes, type SelfCheckItem } from '../../lib/glowup-banks';
import { loadFeature, reportFeatureFailure, runFeature } from '../../lib/lazy-feature';
import type { AiResult, InterviewFollowUpOutput } from '../../lib/local-ai';
import type { DeliveryFacts, RecordedAudio, Transcript } from '../../lib/speech';
import { sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

export type Take = {
  question: string;
  /** Present when the answer was spoken. */
  audio: RecordedAudio | null;
  /** What was said or typed. Editable, because transcripts make mistakes. */
  text: string;
  segments: Transcript['segments'];
  durationSeconds: number;
};

const SELF_CHECK: SelfCheckItem[] = [
  { id: 'answered', label: 'I answered the question that was asked' },
  { id: 'my-part', label: 'I said what I did, not only what the team did' },
  { id: 'result', label: 'I said what happened because of it' },
  { id: 'ending', label: 'I stopped when I was done' },
];

/**
 * Times a count can be replayed from. Only from a transcript's own segments
 * and only while the words still line up with them: once the visitor edits
 * the transcript, the times would point at the wrong place, so none are given.
 */
export function replayTimes(facts: DeliveryFacts | null): {
  fillers: Record<string, number[]>;
  pauses: number[];
} {
  const fillers: Record<string, number[]> = {};
  for (const filler of facts?.fillers ?? []) {
    const starts = filler.occurrences
      .map((o) => o.timestamp?.start)
      .filter((t): t is number => typeof t === 'number');
    // All or nothing: a partial list would read as the full count.
    if (starts.length > 0 && starts.length === filler.count) {
      fillers[filler.phrase] = [...new Set(starts)];
    }
  }
  return { fillers, pauses: (facts?.pauses ?? []).map((p) => p.start) };
}

/** Whole seconds, counted down like the audio player's own clock, so the two agree. */
const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

type Props = {
  take: Take;
  /** A transcript is being written on this device. */
  transcribing: boolean;
  canTranscribe: boolean;
  onTextChange: (text: string) => void;
  onKeep: (() => void) | null;
  kept: boolean;
  onRetry: () => void;
  onNext: () => void;
  isLast: boolean;
  /**
   * Whether pace, pauses and repeated words are counted. Some people do not
   * want them: a stutter, a second language, or a speech device makes those
   * counts say nothing useful.
   */
  countDelivery: boolean;
  onCountDeliveryChange: (on: boolean) => void;
  /** What a strong answer to this question shows, and one common mistake. */
  notes?: { strongAnswer?: string; commonMistake?: string };
  /** The "check it yourself" list for this question. */
  checklist?: SelfCheckItem[];
  /** Keep the answer's words on this device. */
  onKeepText?: () => void;
  textKept?: boolean;
  /** Keep the answer and open it as a story draft. */
  onUseAsStory?: () => void;
  /** What the answer is read against for its two notes. */
  noteContext?: { company?: string; jobTitle?: string; askAboutJob: boolean; terms?: boolean };
};

/**
 * One answer, played back and described. Everything shown is a count or a
 * duration the visitor can check against the recording. Nothing here rates
 * the answer, and nothing infers confidence or personality from a voice.
 */
export default function TakeReview({
  take,
  transcribing,
  canTranscribe,
  onTextChange,
  onKeep,
  kept,
  onRetry,
  onNext,
  isLast,
  countDelivery,
  onCountDeliveryChange,
  notes,
  checklist = SELF_CHECK,
  onKeepText,
  textKept = false,
  onUseAsStory,
  noteContext,
}: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [facts, setFacts] = React.useState<DeliveryFacts | null>(null);
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({});
  const [followUp, setFollowUp] = React.useState<AiResult<InterviewFollowUpOutput> | null>(null);
  const audioUrl = React.useMemo(
    () => (take.audio ? URL.createObjectURL(take.audio.blob) : null),
    [take.audio]
  );
  React.useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  React.useEffect(() => {
    let cancelled = false;
    void loadFeature(import('../../lib/speech'))
      .then(({ deliveryFacts }) => {
        if (cancelled) return;
        setFacts(
          deliveryFacts({
            text: take.text,
            segments: take.segments,
            durationSeconds: take.durationSeconds,
          })
        );
      })
      .catch(reportFeatureFailure);
    return () => {
      cancelled = true;
    };
  }, [take.text, take.segments, take.durationSeconds]);

  const askFollowUp = async () => {
    const { interviewFollowUp, grounded } = await loadFeature(import('../../lib/local-ai'));
    setFollowUp(await grounded(interviewFollowUp, { question: take.question, answer: take.text }));
  };

  const spoken = Boolean(take.audio);
  // A typed answer has no pace or pauses, and words like "so" in writing are not fillers.
  const delivery = spoken && countDelivery;
  const fillers = delivery ? (facts?.fillers.filter((filler) => filler.count > 0) ?? []) : [];
  const hasWords = Boolean(take.text.trim());
  // Words typed for a recording (no transcript segments) still give a pace
  // the visitor can check: their own words over the recording's length.
  const typedForRecording = spoken && take.segments.length === 0;
  const replay = spoken && audioUrl ? replayTimes(facts) : { fillers: {}, pauses: [] };
  const playFrom = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    // A second early, so the moment is heard in its sentence.
    audio.currentTime = Math.max(0, seconds - 1);
    void audio.play().catch(() => undefined);
  };
  const notesForAnswer = React.useMemo(
    () =>
      noteContext && !noteContext.terms
        ? answerNotes(take.text, {
            company: noteContext.company,
            jobTitle: noteContext.jobTitle,
            askAboutJob: noteContext.askAboutJob,
          })
        : [],
    [take.text, noteContext]
  );
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(take.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const paceText = !hasWords
    ? 'Needs a transcript'
    : facts?.wordsPerMinute
      ? `${Math.round(facts.wordsPerMinute)} words a minute`
      : 'Too short to count';

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">You were asked</p>
        <h2
          id="rehearsal-review-heading"
          tabIndex={-1}
          className="text-2xl font-semibold leading-snug focus-visible:outline-hidden"
        >
          {take.question}
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-4">
          {audioUrl && (
            // biome-ignore lint/a11y/useMediaCaption: the editable transcript below is the text alternative
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
              data-guide="take-audio"
            />
          )}
          <label className="block space-y-1">
            <span className="block text-sm text-muted-foreground">
              {spoken ? 'What you said' : 'Your answer'}
            </span>
            <Textarea
              rows={8}
              value={take.text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder={
                transcribing
                  ? 'Writing the transcript on this device.'
                  : spoken
                    ? canTranscribe
                      ? ''
                      : 'No transcript on this device. Listen back, or type what you said to count words and pace.'
                    : ''
              }
              className="text-base"
            />
          </label>
          {spoken && take.text.trim() && (
            <p className="text-xs text-muted-foreground">
              Transcripts make mistakes. Fix anything that is wrong; the counts follow your edits.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="facts-title" className="space-y-2">
            <h3 id="facts-title" className="text-lg font-semibold">
              What can be counted
            </h3>
            <dl className="divide-y divide-border/30 rounded-xl border border-border/40 text-sm">
              {spoken && (
                <div className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">Length</dt>
                  <dd className="font-mono tabular-nums" data-testid="take-length">
                    {clock(take.durationSeconds)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">Words</dt>
                <dd className="font-mono tabular-nums" data-testid="take-words">
                  {/* A recording with nothing written yet has not been counted, not silent. */}
                  {spoken && !hasWords ? 'Needs a transcript' : (facts?.wordCount ?? 0)}
                </dd>
              </div>
              {delivery && (
                <div className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">Pace</dt>
                  <dd className="text-right font-mono tabular-nums" data-testid="take-pace">
                    {paceText}
                    {hasWords && facts?.wordsPerMinute && typedForRecording ? (
                      <span className="block font-sans text-xs text-muted-foreground">
                        From what you typed, over the recording's length
                      </span>
                    ) : null}
                  </dd>
                </div>
              )}
              {delivery && facts && facts.pauses.length > 0 && (
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                  <dt className="text-muted-foreground">Pauses over two seconds</dt>
                  <dd className="font-mono tabular-nums">
                    {facts.pauses.length}
                    {replay.pauses.length > 0 ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        {replay.pauses.map((start) => (
                          <ReplayButton
                            key={start}
                            seconds={start}
                            what="the pause"
                            onPlay={playFrom}
                          />
                        ))}
                      </span>
                    ) : (
                      ` (at ${facts.pauses.map((p) => clock(p.start)).join(', ')})`
                    )}
                  </dd>
                </div>
              )}
              {fillers.map((filler) => (
                <div key={filler.phrase} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">
                    Said "{filler.phrase}"
                    {filler.contextDependent && (
                      <span className="block text-xs">Not always a filler. Listen for it.</span>
                    )}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    {filler.count}
                    {replay.fillers[filler.phrase] && (
                      <span className="flex flex-wrap justify-end gap-1">
                        {replay.fillers[filler.phrase].map((start) => (
                          <ReplayButton
                            key={start}
                            seconds={start}
                            what={`"${filler.phrase}"`}
                            onPlay={playFrom}
                          />
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {(replay.pauses.length > 0 || Object.keys(replay.fillers).length > 0) && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each time plays the recording from a second before that part of the transcript. The
                transcript is timed in phrases, not single words, so it starts near the word.
              </p>
            )}
            {!spoken && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Filler words, pace and pauses are counted only when you answer out loud.
              </p>
            )}
            {spoken && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={countDelivery}
                  onChange={(event) => onCountDeliveryChange(event.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--love))]"
                />
                Count pace, pauses and repeated words
              </label>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              These are counts, not grades. There is no proven right pace or number of pauses. One
              common guide is that a structured answer runs one to two minutes.
            </p>
          </section>

          {notes && (
            <section aria-labelledby="notes-title" className="space-y-2" data-testid="take-notes">
              <h3 id="notes-title" className="text-lg font-semibold">
                What interviewers listen for
              </h3>
              <dl className="space-y-2 text-sm leading-relaxed">
                {notes.strongAnswer && (
                  <div>
                    <dt className="text-muted-foreground">A strong answer shows</dt>
                    <dd className="text-foreground">{notes.strongAnswer}</dd>
                  </div>
                )}
                {notes.commonMistake && (
                  <div>
                    <dt className="text-muted-foreground">A common mistake</dt>
                    <dd className="text-foreground">{notes.commonMistake}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {notesForAnswer.length > 0 && (
            <section
              aria-labelledby="answer-notes-title"
              className="space-y-2"
              data-testid="answer-notes"
            >
              <h3 id="answer-notes-title" className="text-lg font-semibold">
                What your answer has
              </h3>
              <ul className="space-y-2 text-sm leading-relaxed">
                {notesForAnswer.map((note) => (
                  <li
                    key={note.id}
                    className={note.found ? 'text-foreground' : 'text-muted-foreground'}
                  >
                    {note.text}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Read from your words, not graded. They follow your edits.
              </p>
            </section>
          )}

          <fieldset className="mx-0 min-w-0 space-y-2 border-0 p-0" data-guide="self-check">
            <legend className="font-display text-lg font-semibold">Check it yourself</legend>
            {checklist.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(ticks[item.id])}
                  onChange={(event) =>
                    setTicks((current) => ({ ...current, [item.id]: event.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--love))]"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>

          {take.text.trim() && (
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runFeature(askFollowUp)}
              >
                {followUp ? 'Another follow-up' : 'What might they ask next?'}
              </Button>
              <div aria-live="polite">
                {followUp && (
                  <p className="text-sm leading-relaxed" data-guide="follow-up">
                    {followUp.value.followUp}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {sourceLabel(followUp.source)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-5">
        <Button type="button" onClick={onNext}>
          {isLast ? 'Finish' : 'Next question'}
        </Button>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try this one again
        </Button>
        {onKeep && (
          <Button type="button" variant="outline" onClick={onKeep} disabled={kept}>
            {kept ? 'Recording kept on this device' : 'Keep this recording'}
          </Button>
        )}
        {hasWords && onKeepText && (
          <Button type="button" variant="outline" onClick={onKeepText} disabled={textKept}>
            {textKept
              ? 'Answer kept on this device'
              : spoken
                ? 'Keep the words'
                : 'Keep this answer'}
          </Button>
        )}
        {hasWords && onUseAsStory && (
          <Button type="button" variant="outline" onClick={onUseAsStory}>
            Use as a story draft
          </Button>
        )}
        {hasWords && (
          <Button type="button" variant="ghost" onClick={() => void copyText()}>
            {copied ? 'Copied' : 'Copy the answer'}
          </Button>
        )}
      </div>
      {hasWords && onKeepText && !textKept && (
        <p className="text-xs text-muted-foreground">
          Not kept yet. It is gone when you leave this page unless you keep it.
        </p>
      )}
    </div>
  );
}

/** Plays the recording from one counted moment. */
function ReplayButton({
  seconds,
  what,
  onPlay,
}: {
  seconds: number;
  what: string;
  onPlay: (seconds: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(seconds)}
      aria-label={`Play ${what} at ${clock(seconds)}`}
      className="inline-flex min-h-6 items-center rounded border border-border/50 px-1.5 font-mono text-xs tabular-nums text-foreground hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {clock(seconds)}
    </button>
  );
}
