import * as React from 'react';
import type { DecodedRole } from '../../lib/glowup-store';
import { loadData } from '../../lib/glowup-store';
import { loadFeature, reportFeatureFailure, runFeature } from '../../lib/lazy-feature';
import type { HostedModel, ModelState } from '../../lib/models';
import type { RecordedAudio, SpeechRecorder } from '../../lib/speech';
import { cn } from '../../lib/utils';
import { formatBytes } from '../StoragePanel';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import TakeReview, { type Take } from './TakeReview';

type Question = { question: string; requirement: string | null };
type Phase = 'setup' | 'asking' | 'review' | 'done';
type AnswerMode = 'speak' | 'type';

const MIN_QUESTIONS = 5;

const FALLBACK_QUESTIONS: Question[] = [
  { question: 'Tell me about yourself.', requirement: null },
  { question: 'Why are you interested in this role?', requirement: null },
  { question: 'Tell me about a time you worked on a team.', requirement: null },
  { question: 'Tell me about a time something went wrong and what you did.', requirement: null },
  { question: 'Tell me about something you taught yourself.', requirement: null },
  { question: 'What questions do you have for us?', requirement: null },
];

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * The rehearsal room: one interview question at a time, answered out loud or
 * in writing, then played back and described. The microphone is only asked
 * for when the visitor presses record, recordings stay in memory unless they
 * choose to keep one, and nothing is sent anywhere.
 */
export default function RehearsalRoom() {
  const [role, setRole] = React.useState<DecodedRole | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [phase, setPhase] = React.useState<Phase>('setup');
  const [index, setIndex] = React.useState(0);
  const [mode, setMode] = React.useState<AnswerMode>('speak');
  const [canRecord, setCanRecord] = React.useState(false);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = React.useState<string | null>(null);
  // Off until the visitor asks: built-in voices vary a lot from device to device.
  const [readAloud, setReadAloud] = React.useState(false);
  const hasVoice = voices.length > 0;
  const [models, setModels] = React.useState<(HostedModel & { state: ModelState })[]>([]);
  const [downloading, setDownloading] = React.useState<{ id: string; fraction: number } | null>(
    null
  );
  const [prepared, setPrepared] = React.useState<Map<string, Blob> | null>(null);
  const [preparing, setPreparing] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const [take, setTake] = React.useState<Take | null>(null);
  const [transcribing, setTranscribing] = React.useState(false);
  const [kept, setKept] = React.useState(false);
  const [answered, setAnswered] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const recorder = React.useRef<SpeechRecorder | null>(null);
  const startedAt = React.useRef(0);
  const speech = React.useRef<AbortController | null>(null);

  const whisperReady = models.some((m) => m.id === 'whisper-tiny-en' && m.state === 'ready');
  const kokoroReady = models.some((m) => m.id === 'kokoro' && m.state === 'ready');

  // Read the role being prepared for and build its questions. Reading only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  React.useEffect(() => {
    let cancelled = false;
    const data = loadData();
    const current = data.roles.find((r) => r.id === data.currentRoleId) ?? data.roles[0] ?? null;
    setRole(current);
    void (async () => {
      const { likelyQuestions } = await loadFeature(import('../../lib/local-ai'));
      const result = await likelyQuestions(
        {
          jobTitle: current?.jobTitle || undefined,
          company: current?.company || undefined,
          requirements: (current?.bullets ?? [])
            .filter((b) => b.status === 'active')
            .map((b) => b.text),
        },
        { rulesOnly: true }
      );
      if (cancelled) return;
      // A posting with few requirements, or none, still gets a full session.
      const fromPosting = result.value.questions;
      const asked = new Set(fromPosting.map((q) => q.question.toLowerCase()));
      const extra = FALLBACK_QUESTIONS.filter((q) => !asked.has(q.question.toLowerCase()));
      setQuestions(
        fromPosting.length >= MIN_QUESTIONS
          ? fromPosting
          : [...fromPosting, ...extra].slice(0, Math.max(MIN_QUESTIONS, fromPosting.length))
      );
    })().catch((error) => {
      reportFeatureFailure(error);
      if (!cancelled) setQuestions(FALLBACK_QUESTIONS);
    });
    void (async () => {
      const { speechCapabilities, rankVoices, loadVoiceChoice } = await loadFeature(
        import('../../lib/speech')
      );
      const capabilities = await speechCapabilities();
      if (cancelled) return;
      setCanRecord(capabilities.mediaRecorder.supported);
      // Best voices first, joke voices left out. The visitor's saved choice wins.
      const ranked = rankVoices(capabilities.localVoices, navigator.language).slice(0, 8);
      setVoices(ranked);
      const savedVoice = loadVoiceChoice();
      setVoiceURI(
        ranked.find((v) => v.voiceURI === savedVoice)?.voiceURI ?? ranked[0]?.voiceURI ?? null
      );
      if (!capabilities.mediaRecorder.supported) setMode('type');
    })().catch((error) => {
      reportFeatureFailure(error);
      if (!cancelled) setMode('type');
    });
    void refreshModels(() => cancelled).catch(reportFeatureFailure);
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshModels(isCancelled: () => boolean = () => false) {
    const lib = await loadFeature(import('../../lib/models'));
    if (!(await lib.hostedModelsAvailable()) || !lib.hostedModelsSupported().supported) return;
    const catalogue = await lib.hostedModelCatalogue();
    const withState = await Promise.all(
      catalogue.map(async (model) => ({ ...model, state: await lib.getModelState(model.id) }))
    );
    if (!isCancelled()) setModels(withState);
  }

  // Leaving the page must never leave a microphone open or a voice talking.
  React.useEffect(
    () => () => {
      recorder.current?.cancel();
      speech.current?.abort();
    },
    []
  );

  React.useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(
      () => setElapsed((performance.now() - startedAt.current) / 1000),
      250
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  const current = questions[index] ?? null;

  const speak = React.useCallback(
    async (text: string) => {
      speech.current?.abort();
      const controller = new AbortController();
      speech.current = controller;
      try {
        const lib = await loadFeature(import('../../lib/speech'));
        const clip = prepared?.get(text);
        if (clip) await lib.playAudio(clip, { signal: controller.signal });
        else
          await lib.speakBuiltIn(text, {
            signal: controller.signal,
            voiceURI: voiceURI ?? undefined,
          });
      } catch {
        /* no local voice, or stopped: the question is on screen either way */
      }
    },
    [prepared, voiceURI]
  );

  const ask = React.useCallback(
    (next: number) => {
      setIndex(next);
      setTake(null);
      setTyped('');
      setKept(false);
      setElapsed(0);
      setNotice(null);
      setPhase('asking');
      const text = questions[next]?.question;
      if (text && readAloud && (hasVoice || prepared?.has(text))) void speak(text);
    },
    [questions, readAloud, hasVoice, prepared, speak]
  );

  const download = async (id: HostedModel['id']) => {
    setDownloading({ id, fraction: 0 });
    try {
      const { downloadModel } = await loadFeature(import('../../lib/models'));
      await downloadModel(id, {
        onProgress: (progress) =>
          setDownloading({
            id,
            fraction: progress.total ? progress.loaded / progress.total : 0,
          }),
      });
    } catch {
      setNotice('The download did not finish. Nothing was changed; you can try again.');
    }
    setDownloading(null);
    await refreshModels().catch(reportFeatureFailure);
  };

  const prepareVoice = async () => {
    setPreparing('Preparing the spoken questions.');
    try {
      const { prepareSpokenQuestions } = await loadFeature(import('../../lib/speech'));
      const clips = await prepareSpokenQuestions(
        questions.map((q) => q.question),
        {
          onProgress: (progress) =>
            setPreparing(`Preparing question ${progress.completed + 1} of ${progress.total}.`),
        }
      );
      setPrepared(clips);
      setPreparing(null);
    } catch {
      setPreparing(null);
      setNotice('The voice could not be prepared on this device. The built-in voice still works.');
    }
  };

  const startRecording = async () => {
    speech.current?.abort();
    setNotice(null);
    try {
      const { createRecorder } = await loadFeature(import('../../lib/speech'));
      recorder.current = createRecorder({ onLevel: setLevel });
      await recorder.current.start();
      startedAt.current = performance.now();
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      const reason = (error as { reason?: string } | null)?.reason;
      setNotice(
        reason === 'permission-denied'
          ? 'The microphone was not allowed. You can allow it in the browser, or type your answer.'
          : reason === 'no-device'
            ? 'No microphone was found. You can type your answer instead.'
            : 'Recording could not start. You can type your answer instead.'
      );
      setMode('type');
    }
  };

  const finishWith = async (audio: RecordedAudio | null, text: string, seconds: number) => {
    if (!current) return;
    const next: Take = {
      question: current.question,
      audio,
      text,
      segments: [],
      durationSeconds: seconds,
    };
    setTake(next);
    setAnswered((count) => count + 1);
    setPhase('review');
    if (!audio || !whisperReady) return;
    setTranscribing(true);
    try {
      const { transcribe } = await loadFeature(import('../../lib/speech'));
      const transcript = await transcribe(audio.blob);
      setTake((existing) =>
        existing && existing.audio === audio
          ? { ...existing, text: transcript.text, segments: transcript.segments }
          : existing
      );
    } catch {
      setNotice('The transcript could not be written. The recording is still here to play back.');
    }
    setTranscribing(false);
  };

  const stopRecording = async () => {
    if (!recorder.current) return;
    setRecording(false);
    setLevel(0);
    try {
      const audio = await recorder.current.stop();
      await finishWith(audio, '', audio.durationMs / 1000);
    } catch {
      setNotice('The recording could not be saved. Try again.');
    }
    recorder.current = null;
  };

  const startTyping = () => {
    startedAt.current = performance.now();
  };

  const keep = async () => {
    if (!take?.audio) return;
    const { saveRecording } = await loadFeature(import('../../lib/local-db'));
    const result = await saveRecording({
      tool: 'interview-glow-up',
      question: take.question,
      durationMs: Math.round(take.durationSeconds * 1000),
      audio: take.audio.blob,
      mimeType: take.audio.mimeType,
      transcript: take.text,
    });
    if (result.ok) setKept(true);
    else setNotice(result.message);
  };

  if (!questions.length) {
    return <p className="text-sm text-muted-foreground">Setting up the room.</p>;
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-3xl space-y-8" data-guide="rehearsal-setup">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            {questions.length} questions
            {role
              ? ` for ${role.jobTitle || 'your role'}${role.company ? ` at ${role.company}` : ''}`
              : ''}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {role
              ? 'These come from what the posting asks for. Each one shows which requirement it is testing.'
              : 'These are common first-interview questions. Decode a posting on the Application Desk and the room will ask about that job instead.'}
          </p>
        </div>

        <fieldset className="mx-0 min-w-0 space-y-2 border-0 p-0">
          <legend className="font-display text-lg font-semibold">How will you answer?</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['speak', 'Out loud', 'Records on this device so you can listen back.'],
                ['type', 'In writing', 'No microphone needed.'],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="relative">
                <input
                  type="radio"
                  name="answer-mode"
                  checked={mode === value}
                  disabled={value === 'speak' && !canRecord}
                  onChange={() => setMode(value)}
                  className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span
                  className={cn(
                    'flex min-h-14 flex-col justify-center rounded-xl border border-border/50 px-4 py-2 text-left transition-colors',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50',
                    'peer-checked:border-love peer-checked:bg-love/10'
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {!canRecord && (
            <p className="text-xs text-muted-foreground">
              This browser cannot record audio, so answers are written here.
            </p>
          )}
          {mode === 'speak' && canRecord && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              The browser asks for the microphone when you press record. Recordings stay in this tab
              unless you choose to keep one, and none is ever sent anywhere.
            </p>
          )}
        </fieldset>

        {hasVoice && (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={readAloud}
                onChange={(event) => setReadAloud(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--love))]"
              />
              <span>
                Read each question aloud
                <span className="block text-xs text-muted-foreground">
                  Uses a voice already on this device. Some sound better than others, so try it
                  first.
                </span>
              </span>
            </label>
            {readAloud && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 space-y-1">
                  <span className="block text-sm text-muted-foreground">Voice</span>
                  <select
                    value={voiceURI ?? ''}
                    onChange={(event) => {
                      setVoiceURI(event.target.value);
                      void loadFeature(import('../../lib/speech'))
                        .then(({ saveVoiceChoice }) => saveVoiceChoice(event.target.value))
                        .catch(reportFeatureFailure);
                    }}
                    className="h-9 max-w-full rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => speak('Tell me about a time you solved a problem.')}
                >
                  Hear a sample
                </Button>
              </div>
            )}
          </div>
        )}

        {models.length > 0 && (
          <section
            aria-labelledby="extras-title"
            className="space-y-3 border-t border-border/40 pt-6"
          >
            <h3 id="extras-title" className="text-lg font-semibold">
              Optional downloads
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These run entirely on this device and are downloaded from this site only when you ask.
              You can delete them from the dashboard.
            </p>
            <ul className="space-y-2">
              {models.map((model) => (
                <li
                  key={model.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {model.purpose === 'transcription'
                        ? 'A written transcript of what you say'
                        : 'A more natural interviewer voice'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {model.displayName}, {formatBytes(model.downloadBytes)}
                    </p>
                  </div>
                  {model.state === 'ready' ? (
                    model.id === 'kokoro' && !prepared ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={prepareVoice}
                        disabled={Boolean(preparing)}
                      >
                        {preparing ? 'Preparing' : 'Prepare the questions'}
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-foam">Ready</span>
                    )
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(downloading)}
                      onClick={() => download(model.id)}
                    >
                      {downloading?.id === model.id
                        ? `Downloading ${Math.round(downloading.fraction * 100)} percent`
                        : `Download ${formatBytes(model.downloadBytes)}`}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {kokoroReady && !prepared && !preparing && (
              <p className="text-xs text-muted-foreground">
                The natural voice takes a while to speak, so the questions are prepared before you
                start.
              </p>
            )}
            <p role="status" className="min-h-4 text-xs text-muted-foreground">
              {preparing}
            </p>
          </section>
        )}

        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
        <Button type="button" size="lg" onClick={() => ask(0)}>
          Start with the first question
        </Button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-2xl font-semibold">That was the last question</h2>
        <p
          className="text-sm leading-relaxed text-muted-foreground"
          data-testid="rehearsal-summary"
        >
          You answered {answered} {answered === 1 ? 'time' : 'times'} across {questions.length}{' '}
          questions.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setAnswered(0);
              ask(0);
            }}
          >
            Go again
          </Button>
          <Button asChild variant="outline">
            <a href="/interview-glow-up/workspace/?tab=stories">Work on your stories</a>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'review' && take) {
    return (
      <div className="space-y-4">
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          Question {index + 1} of {questions.length}
        </p>
        <TakeReview
          take={take}
          transcribing={transcribing}
          canTranscribe={whisperReady}
          onTextChange={(text) => setTake({ ...take, text })}
          onKeep={take.audio ? () => runFeature(keep) : null}
          kept={kept}
          onRetry={() => ask(index)}
          onNext={() => (index + 1 < questions.length ? ask(index + 1) : setPhase('done'))}
          isLast={index + 1 >= questions.length}
        />
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          Question {index + 1} of {questions.length}
        </p>
        <h2
          className="text-balance text-3xl font-semibold leading-tight sm:text-4xl"
          data-testid="rehearsal-question"
        >
          {current?.question}
        </h2>
        {current?.requirement && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="text-love">From the posting: </span>
            <mark className="rounded-[3px] bg-love/15 px-0.5 text-foreground">
              {current.requirement}
            </mark>
          </p>
        )}
        {(hasVoice || prepared) && current && (
          <Button type="button" size="sm" variant="ghost" onClick={() => speak(current.question)}>
            Hear it again
          </Button>
        )}
      </div>

      {mode === 'speak' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {recording ? (
              <Button type="button" size="lg" onClick={stopRecording}>
                Stop and review
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={startRecording}>
                Record my answer
              </Button>
            )}
            <span className="font-mono text-2xl tabular-nums text-foreground" aria-live="off">
              {clock(elapsed)}
            </span>
            {recording && (
              <span
                className="h-2 w-28 overflow-hidden rounded-full bg-foreground/10"
                role="img"
                aria-label="Microphone level"
              >
                <span
                  className="block h-full origin-left rounded-full bg-love transition-transform duration-100 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${Math.min(1, level * 1.4)})` }}
                />
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {recording
              ? 'Recording. Take a breath, then answer as you would in the room.'
              : 'Press record when you are ready. A structured answer commonly runs one to two minutes.'}
          </p>
          {!recording && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode('type')}>
              Type this answer instead
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="block text-sm text-muted-foreground">Your answer</span>
            <Textarea
              rows={8}
              value={typed}
              onFocus={() => {
                if (!typed) startTyping();
              }}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Write it the way you would say it."
              className="text-base"
            />
          </label>
          <Button
            type="button"
            size="lg"
            disabled={!typed.trim()}
            onClick={() =>
              finishWith(null, typed, Math.max(0, (performance.now() - startedAt.current) / 1000))
            }
          >
            Review my answer
          </Button>
        </div>
      )}

      <p role="status" className="min-h-5 text-sm text-foreground">
        {notice}
      </p>
    </div>
  );
}
