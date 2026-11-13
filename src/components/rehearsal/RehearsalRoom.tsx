import * as React from 'react';
import { loadApplications } from '../../lib/applications';
import {
  type Audience,
  audienceFor,
  detectSkillsFromText,
  getQuestionById,
  optionalQuestionIds,
  packetQuestionLines,
  planRehearsal,
  type RehearsalPlanInput,
  type RehearsalQuestion,
  resolveQuestionText,
  selfCheckFor,
  storiesForQuestion,
  tidyQuestionText,
} from '../../lib/glowup-banks';
import { chosenQuestion } from '../../lib/glowup-banks/rehearsal';
import type { DecodedRole, GlowUpData, KeptAnswer, Story } from '../../lib/glowup-store';
import {
  loadData,
  openRole,
  removeStoredAnswer,
  requirementBullets,
  storeKeptAnswer,
  updateStoredAnswer,
} from '../../lib/glowup-store';
import { loadFeature, reportFeatureFailure, runFeature } from '../../lib/lazy-feature';
import type { HostedModel, ModelState } from '../../lib/models';
import { hiringCondition } from '../../lib/posting/conditions';
import type { RecordedAudio, SpeechRecorder } from '../../lib/speech';
import { cn, focusWhenReady } from '../../lib/utils';
import { formatBytes } from '../StoragePanel';
import Announcer, { useAnnouncer } from '../shared/Announcer';
import ConfirmButton from '../shared/ConfirmButton';
import SavedRecordings from '../shared/SavedRecordings';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import TakeReview, { type Take } from './TakeReview';

type Phase = 'setup' | 'asking' | 'review' | 'done';

/** The posting's line about work authorization or sponsorship, verbatim, if it has one. */
export function workAuthorizationLine(role: DecodedRole | null): string | null {
  if (!role) return null;
  const lines = [...role.bullets.map((b) => b.text), ...role.rawJdText.split('\n')];
  return (
    lines
      .map((line) => line.trim())
      .find((line) => line && hiringCondition(line)?.kind === 'work-authorization') ?? null
  );
}
type AnswerMode = 'speak' | 'type';

/** Where "Use as a story draft" opens the workspace's story editor on a kept answer. */
export const storyDraftHref = (answerId: string) =>
  `/interview-glow-up/workspace/?draft=${encodeURIComponent(answerId)}`;

/**
 * The questions in a role's packet the visitor can choose to rehearse: the
 * likely-questions list, then the questions attached to packed stories.
 */
export function packetQuestions(roleId: string | null): string[] {
  if (!roleId) return [];
  const data = loadData();
  const packet = data.packets.find((p) => p.roleId === roleId);
  if (!packet) return [];
  const packed = new Set(packet.topStoryIds);
  const attached = data.stories
    .filter((story) => packed.has(story.id))
    .flatMap((story) => story.questionPrompts.map(resolveQuestionText));
  const seen = new Set<string>();
  return [...packetQuestionLines(packet.aiQuestions ?? ''), ...attached].filter((line) => {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The role and application a link asked for: "?role=r1" names a saved role,
 * "?application=a1" a tracked application (and, through it, its role). An id
 * that matches nothing is ignored. Without either, the current role and the
 * application tracking it.
 */
export function roomTarget(
  data: GlowUpData,
  applications: readonly { id: string; roleId: string | null }[],
  search: string
): { role: DecodedRole | null; applicationId: string | null; asked: boolean } {
  const params = new URLSearchParams(search);
  const app = applications.find((a) => a.id === params.get('application'));
  const named =
    data.roles.find((r) => r.id === params.get('role')) ??
    (app?.roleId ? data.roles.find((r) => r.id === app.roleId) : undefined);
  const role =
    named ?? data.roles.find((r) => r.id === data.currentRoleId) ?? data.roles[0] ?? null;
  const applicationId =
    (app && (!app.roleId || app.roleId === role?.id) ? app.id : null) ??
    (role ? (applications.find((a) => a.roleId === role.id)?.id ?? null) : null);
  return { role, applicationId, asked: Boolean(named) };
}

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
  // What the session is built from, read once; the questions follow it and
  // the extra questions the visitor adds for this visit.
  const [planBase, setPlanBase] = React.useState<RehearsalPlanInput | null>(null);
  const [extras, setExtras] = React.useState<string[]>([]);
  // Questions from the packet: listed, never asked until the visitor ticks one.
  const [packetLines, setPacketLines] = React.useState<string[]>([]);
  const [picked, setPicked] = React.useState<string[]>([]);
  const questions = React.useMemo<RehearsalQuestion[]>(
    () =>
      planBase
        ? planRehearsal({ ...planBase, extras, chosen: picked.map((q) => chosenQuestion(q)) })
        : [],
    [planBase, extras, picked]
  );
  // Answers kept on this device for this role, and which of this visit's
  // answers were kept, by question number.
  const [keptAnswers, setKeptAnswers] = React.useState<KeptAnswer[]>([]);
  const [keptByIndex, setKeptByIndex] = React.useState<
    Record<number, { id: string; text: string }>
  >({});
  // Every answer given this visit, by question number, so the end of the
  // session can list them and offer to keep them.
  const [sessionTakes, setSessionTakes] = React.useState<Record<number, Take>>({});
  // The tracked application for this role, so a kept recording belongs to it.
  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [audience, setAudience] = React.useState<Audience>('student');
  const [requirementCount, setRequirementCount] = React.useState(0);
  // The visitor's saved stories, read once. The room never writes them.
  const [stories, setStories] = React.useState<Story[]>([]);
  const [showStory, setShowStory] = React.useState(false);
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
  // The audio that was saved. Tied to one take, so a save that finishes after
  // the visitor has moved on cannot mark the next answer as kept.
  const [keptAudio, setKeptAudio] = React.useState<RecordedAudio | null>(null);
  const kept = Boolean(take?.audio && take.audio === keptAudio);
  // Kept for the visit, not saved: the choice applies to every answer until the page closes.
  const [countDelivery, setCountDelivery] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [announcement, announce] = useAnnouncer();
  const recorder = React.useRef<SpeechRecorder | null>(null);
  const startingRecorder = React.useRef(false);
  /** Counts recording attempts, so a start that was called off can tell. */
  const startRun = React.useRef(0);
  const startedAt = React.useRef(0);
  const speech = React.useRef<AbortController | null>(null);

  const whisperReady = models.some((m) => m.id === 'whisper-tiny-en' && m.state === 'ready');
  const kokoroReady = models.some((m) => m.id === 'kokoro' && m.state === 'ready');

  // Read the role being prepared for and build its questions. Reading only,
  // except that a role named in the address becomes the current one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  React.useEffect(() => {
    let cancelled = false;
    const data = loadData();
    const target = roomTarget(data, loadApplications().applications, window.location.search);
    const current = target.role;
    // A link that names a role (from the dashboard, opened in a new tab, say)
    // makes it current, as choosing it would; the workspace then opens on the
    // same job. With no role named, nothing is written.
    if (target.asked && current) openRole(current.id);
    setRole(current);
    setStories(data.stories);
    setPacketLines(packetQuestions(current?.id ?? null));
    setKeptAnswers((data.answers ?? []).filter((a) => a.roleId === (current?.id ?? null)));
    setApplicationId(target.applicationId);
    void (async () => {
      const [{ likelyQuestions }, { readProfile }, { readResumeText }] = await Promise.all([
        loadFeature(import('../../lib/local-ai')),
        loadFeature(import('../../lib/profile')),
        loadFeature(import('../../lib/career-bridge')),
      ]);
      // The career review decides; without one, years of dated work on the
      // resume keep a long-time worker from being asked about coursework.
      const who = audienceFor(readProfile(), readResumeText());
      // Only real requirements: confirmed lines, or lines sorted as required,
      // preferred, or a duty. Never the header, the address, or the pitch.
      const requirementLines = requirementBullets(current?.bullets ?? []);
      const requirements = requirementLines.map((b) => b.text);
      const result = await likelyQuestions(
        {
          jobTitle: current?.jobTitle || undefined,
          company: current?.company || undefined,
          requirements,
          audience: who,
        },
        { rulesOnly: true }
      );
      if (cancelled) return;
      const fromPosting: RehearsalQuestion[] = result.value.questions
        .filter((q) => q.requirement)
        .map((q) => ({
          question: tidyQuestionText(q.question),
          requirement: q.requirement,
          skillIds: q.skillIds ?? [],
          questionId: q.questionId,
          strongAnswer: q.strongAnswer,
          commonMistake: q.commonMistake,
        }));
      const postingSkillIds = new Set(
        requirements.flatMap((line) => detectSkillsFromText(line).map((s) => s.skillId))
      );
      setAudience(who);
      setRequirementCount(requirements.length);
      setPlanBase({
        audience: who,
        fromPosting,
        postingSkillIds,
        requirements: requirementLines.map((b) => ({
          text: b.text,
          skillIds: [
            ...[b.primarySkillId, ...(b.secondarySkillIds ?? [])].filter((id): id is string =>
              Boolean(id)
            ),
            ...detectSkillsFromText(b.text).map((s) => s.skillId),
          ],
        })),
        workAuthorizationLine: workAuthorizationLine(current),
      });
    })().catch((error) => {
      // The question bank could not load (offline, first visit): say so, and
      // still give the room its standing questions.
      reportFeatureFailure(error);
      if (!cancelled) {
        setPlanBase({
          audience: 'student',
          fromPosting: [],
          postingSkillIds: new Set(),
          workAuthorizationLine: workAuthorizationLine(current),
        });
      }
    });
    void (async () => {
      const { speechCapabilities, rankVoices, loadVoiceChoice } = await loadFeature(
        import('../../lib/speech')
      );
      const capabilities = await speechCapabilities();
      if (cancelled) return;
      setCanRecord(capabilities.mediaRecorder.supported);
      // Best voices first, joke voices left out. The visitor's saved choice wins.
      // The questions are in English, so the voice must be. The browser's
      // language only picks the accent, and only when it is English too.
      const accent = /^en\b/i.test(navigator.language) ? navigator.language : 'en-US';
      const ranked = rankVoices(capabilities.localVoices, accent).slice(0, 8);
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
      startRun.current += 1;
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

  // Every answer this visit, as the visitor last left it (corrections included).
  React.useEffect(() => {
    if (take) setSessionTakes((all) => (all[index] === take ? all : { ...all, [index]: take }));
  }, [take, index]);

  /**
   * Keep an answer's words on this device, tied to the role and question.
   * Only on the visitor's press. Returns the kept answer's id, or null.
   */
  const keepText = (at: number): string | null => {
    const answer = at === index && take ? take : sessionTakes[at];
    const question = questions[at];
    const text = answer?.text.trim() ?? '';
    if (!answer || !question || !text) return null;
    const already = keptByIndex[at];
    if (already) {
      if (already.text === text) return already.id;
      // Corrected since it was kept: the kept copy follows the correction.
      if (!updateStoredAnswer(already.id, text)) {
        setNotice('This browser would not keep the change. Copy it somewhere before you leave.');
        return null;
      }
      setKeptByIndex((all) => ({ ...all, [at]: { id: already.id, text } }));
      setKeptAnswers((all) => all.map((a) => (a.id === already.id ? { ...a, text } : a)));
      return already.id;
    }
    const kept = storeKeptAnswer({
      roleId: role?.id ?? null,
      question: question.question,
      ...(question.questionId ? { questionId: question.questionId } : {}),
      requirement: question.requirement,
      skillIds: question.skillIds,
      text,
      mode: answer.audio ? 'spoken' : 'typed',
    });
    if (!kept) {
      setNotice('This browser would not keep the answer. Copy it somewhere before you leave.');
      return null;
    }
    setKeptByIndex((all) => ({ ...all, [at]: { id: kept.id, text } }));
    setKeptAnswers((all) => [...all, kept]);
    announce('Answer kept on this device.');
    return kept.id;
  };

  const draftStoryFrom = (at: number) => {
    const id = keepText(at);
    if (id) window.location.assign(storyDraftHref(id));
  };

  const forget = (answerId: string) => {
    if (!removeStoredAnswer(answerId)) {
      setNotice('This browser would not delete the answer. Try again.');
      return;
    }
    setKeptAnswers((all) => all.filter((a) => a.id !== answerId));
    setKeptByIndex((all) =>
      Object.fromEntries(Object.entries(all).filter(([, kept]) => kept.id !== answerId))
    );
  };
  const storyMatch = React.useMemo(
    () => (current ? (storiesForQuestion(current, stories, 1)[0] ?? null) : null),
    [current, stories]
  );

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
      setKeptAudio(null);
      setElapsed(0);
      setNotice(null);
      setShowStory(false);
      setPhase('asking');
      // The button pressed is gone; the question that replaced it takes focus.
      focusWhenReady('rehearsal-question');
      announce(`Question ${next + 1} of ${questions.length}.`);
      const text = questions[next]?.question;
      if (text && readAloud && (hasVoice || prepared?.has(text))) void speak(text);
    },
    [questions, readAloud, hasVoice, prepared, speak, announce]
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
    // A second press before the microphone is ready would open a second
    // recorder that nothing could stop.
    if (startingRecorder.current) return;
    startingRecorder.current = true;
    speech.current?.abort();
    setNotice(null);
    const run = ++startRun.current;
    try {
      const { createRecorder } = await loadFeature(import('../../lib/speech'));
      // The visitor chose to type while this was loading: open no microphone.
      if (run !== startRun.current) return;
      const created = createRecorder({ onLevel: setLevel });
      recorder.current = created;
      await created.start();
      if (run !== startRun.current) {
        created.cancel();
        if (recorder.current === created) recorder.current = null;
        return;
      }
      startedAt.current = performance.now();
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      // Cancelled on purpose by switching to typing: nothing went wrong.
      if (run !== startRun.current) return;
      const reason = (error as { reason?: string } | null)?.reason;
      setNotice(
        reason === 'permission-denied'
          ? 'The microphone was not allowed. You can allow it in the browser, or type your answer.'
          : reason === 'no-device'
            ? 'No microphone was found. You can type your answer instead.'
            : 'Recording could not start. You can type your answer instead.'
      );
      recorder.current = null;
      setMode('type');
    } finally {
      startingRecorder.current = false;
    }
  };

  /** Switch to typing, and call off a microphone that is still being opened. */
  const typeInstead = () => {
    startRun.current += 1;
    recorder.current?.cancel();
    recorder.current = null;
    setMode('type');
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
    // A new answer to the same question is not the one that was kept.
    setKeptByIndex((all) => {
      if (!(index in all)) return all;
      const { [index]: _dropped, ...rest } = all;
      return rest;
    });
    setPhase('review');
    focusWhenReady('rehearsal-review-heading');
    announce(`Review. Question ${index + 1} of ${questions.length}.`);
    if (!audio || !whisperReady) return;
    setTranscribing(true);
    try {
      const { transcribe } = await loadFeature(import('../../lib/speech'));
      const transcript = await transcribe(audio.blob);
      // Only an untouched answer is filled in. If the visitor has started
      // writing or correcting it while this ran, their words stay.
      setTake((existing) =>
        existing && existing.audio === audio && !existing.text.trim()
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
    // Let go of this recorder before anything slow. A new recording can start
    // while a transcript is still being written, and must not be dropped by it.
    const stopped = recorder.current;
    recorder.current = null;
    try {
      const audio = await stopped.stop();
      await finishWith(audio, '', audio.durationMs / 1000);
    } catch {
      setNotice('The recording could not be saved. Try again.');
    }
  };

  const startTyping = () => {
    startedAt.current = performance.now();
  };

  const keep = async () => {
    if (!take?.audio) return;
    const saving = take.audio;
    const { saveRecording } = await loadFeature(import('../../lib/local-db'));
    const result = await saveRecording({
      tool: 'interview-glow-up',
      question: take.question,
      durationMs: Math.round(take.durationSeconds * 1000),
      audio: take.audio.blob,
      mimeType: take.audio.mimeType,
      transcript: take.text,
      // The tracked application for this role, so its recordings can be told apart.
      applicationId,
    });
    if (result.ok) setKeptAudio(saving);
    else setNotice(result.message);
  };

  /** Move on without answering. Nothing is counted for a skipped question. */
  const skip = () => {
    // Call off a microphone that is still being opened, keeping the answer mode.
    startRun.current += 1;
    recorder.current?.cancel();
    recorder.current = null;
    if (index + 1 < questions.length) {
      ask(index + 1);
      return;
    }
    setPhase('done');
    focusWhenReady('rehearsal-done-heading');
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
            {!role
              ? 'These are common first-interview questions. Decode a posting on the Application Desk and the room will ask about that job instead.'
              : requirementCount > 0
                ? 'Most of these come from what the posting asks for, and each of those shows the requirement it is testing.'
                : 'None of the lines in this posting is sorted as a requirement yet, so these are common questions. Parse the posting again in the workspace and the room will ask about its requirements.'}
          </p>
          {audience === 'career-changer' && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              You said you are changing careers, so the room also asks why you are changing fields,
              about leaving your last job, and about the time since.
            </p>
          )}
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

        <fieldset className="mx-0 min-w-0 space-y-2 border-0 p-0" data-guide="rehearsal-extras">
          <legend className="font-display text-lg font-semibold">
            Other questions that often come up
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add any that could be asked of you: a change of field, a gap, the terms of the job.
          </p>
          {optionalQuestionIds(audience).map((id) => {
            const question = getQuestionById(id);
            if (!question) return null;
            const fromPosting = id === 'q-work-authorization' && planBase?.workAuthorizationLine;
            return (
              <label key={id} className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(fromPosting) || extras.includes(id)}
                  disabled={Boolean(fromPosting)}
                  onChange={(event) =>
                    setExtras((current) =>
                      event.target.checked
                        ? [...current, id]
                        : current.filter((value) => value !== id)
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--love))]"
                />
                <span>
                  {question.text}
                  {fromPosting && (
                    <span className="block text-xs text-muted-foreground">
                      Included, because the posting mentions work authorization.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        {packetLines.length > 0 && (
          <fieldset
            className="mx-0 min-w-0 space-y-2 border-0 p-0"
            data-testid="rehearsal-packet-questions"
          >
            <legend className="font-display text-lg font-semibold">From your packet</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The likely questions you saved in Pack the proof, and the questions attached to your
              packed stories. Tick the ones to ask first.
            </p>
            {packetLines.map((line) => (
              <label key={line} className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(line)}
                  onChange={(event) =>
                    setPicked((current) =>
                      event.target.checked
                        ? [...current, line]
                        : current.filter((value) => value !== line)
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--love))]"
                />
                <span className="min-w-0 wrap-anywhere">{line}</span>
              </label>
            ))}
          </fieldset>
        )}

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
        <Button
          type="button"
          size="lg"
          onClick={() => ask(0)}
          className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left"
        >
          Start with the first question
        </Button>
        {keptAnswers.length > 0 && (
          <section
            aria-labelledby="kept-answers-title"
            className="space-y-3"
            data-testid="kept-answers"
          >
            <h3 id="kept-answers-title" className="text-lg font-semibold">
              Answers you kept
            </h3>
            <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
              {keptAnswers.map((answer) => {
                const short =
                  answer.question.length > 60
                    ? `${answer.question.slice(0, 57).trimEnd()}...`
                    : answer.question;
                return (
                  <li key={answer.id} className="space-y-2 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{answer.question}</p>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{answer.text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={storyDraftHref(answer.id)}>
                          Use as a story draft<span className="sr-only">: {short}</span>
                        </a>
                      </Button>
                      <ConfirmButton
                        confirmLabel="Delete this answer?"
                        onConfirm={() => forget(answer.id)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Delete<span className="sr-only">: {short}</span>
                      </ConfirmButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {/* With a tracked application in view, only its own recordings. */}
        <SavedRecordings tool="interview-glow-up" applicationId={applicationId ?? undefined} />
        <Announcer message={announcement} />
      </div>
    );
  }

  if (phase === 'done') {
    const answeredAt = Object.keys(sessionTakes)
      .map(Number)
      .filter((at) => at < questions.length)
      .sort((a, b) => a - b);
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <h2
            id="rehearsal-done-heading"
            tabIndex={-1}
            className="text-2xl font-semibold focus-visible:outline-hidden"
          >
            That was the last question
          </h2>
          <p
            className="text-sm leading-relaxed text-muted-foreground"
            data-testid="rehearsal-summary"
          >
            {answeredAt.length === 0
              ? `You skipped all ${questions.length} questions this time.`
              : `You answered ${answeredAt.length} of ${questions.length} questions.`}
          </p>
        </div>
        {answeredAt.length > 0 && (
          <section aria-labelledby="session-answers-title" className="space-y-3">
            <h3 id="session-answers-title" className="text-lg font-semibold">
              Your answers from this session
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              They are gone when you leave this page, unless you keep them. A kept answer stays on
              this device, and you can turn it into a story.
            </p>
            <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
              {answeredAt.map((at) => {
                const answer = sessionTakes[at];
                const question = questions[at];
                const hasText = Boolean(answer.text.trim());
                const keptEntry = keptByIndex[at];
                const keptId = keptEntry && keptEntry.text === answer.text.trim();
                return (
                  <li key={at} className="space-y-2 px-4 py-3" data-testid="session-answer">
                    <p className="text-sm font-medium text-foreground">{question.question}</p>
                    {hasText ? (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{answer.text}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        A recording with no words written down.
                      </p>
                    )}
                    {hasText && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(keptId)}
                          onClick={() => keepText(at)}
                        >
                          {keptId ? 'Kept on this device' : 'Keep this answer'}
                          <span className="sr-only">: {question.question}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => draftStoryFrom(at)}
                        >
                          Use as a story draft<span className="sr-only">: {question.question}</span>
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setSessionTakes({});
              setKeptByIndex({});
              ask(0);
            }}
          >
            Go again
          </Button>
          <Button asChild variant="outline">
            <a href="/interview-glow-up/workspace/?tab=stories">Work on your stories</a>
          </Button>
        </div>
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
        <Announcer message={announcement} />
      </div>
    );
  }

  if (phase === 'review' && take) {
    return (
      <div className="space-y-4" data-guide-review={index}>
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
          onKeepText={() => keepText(index)}
          textKept={keptByIndex[index]?.text === take.text.trim()}
          onUseAsStory={() => draftStoryFrom(index)}
          checklist={selfCheckFor(current)}
          noteContext={{
            company: role?.company,
            jobTitle: role?.jobTitle,
            askAboutJob: Boolean(
              current?.questionId && getQuestionById(current.questionId)?.category === 'general'
            ),
            terms:
              current?.questionId === 'q-work-authorization' ||
              current?.questionId === 'q-salary-expectations' ||
              current?.questionId === 'q-availability',
          }}
          countDelivery={countDelivery}
          onCountDeliveryChange={setCountDelivery}
          notes={
            current?.strongAnswer || current?.commonMistake
              ? { strongAnswer: current.strongAnswer, commonMistake: current.commonMistake }
              : undefined
          }
          onRetry={() => ask(index)}
          onNext={() => {
            if (index + 1 < questions.length) {
              ask(index + 1);
              return;
            }
            setPhase('done');
            focusWhenReady('rehearsal-done-heading');
          }}
          isLast={index + 1 >= questions.length}
        />
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
        <Announcer message={announcement} />
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
          id="rehearsal-question"
          tabIndex={-1}
          className="text-balance text-3xl font-semibold leading-tight focus-visible:outline-hidden sm:text-4xl"
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
        {storyMatch && (
          <div className="space-y-1 text-sm" data-testid="rehearsal-story">
            <p className="text-muted-foreground">
              You have a story that fits:{' '}
              <span className="font-medium text-foreground">
                {storyMatch.story.trigger || 'Untitled story'}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-expanded={showStory}
              onClick={() => setShowStory((open) => !open)}
            >
              {showStory ? 'Hide my story' : 'Show my story'}
            </Button>
            {showStory && (
              <p className="leading-relaxed text-foreground">
                {storyMatch.story.hook || storyMatch.story.play}
              </p>
            )}
          </div>
        )}
        {/* Only offered when the question was read aloud in the first place. */}
        {readAloud && current && (hasVoice || prepared?.has(current.question)) && (
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
            <Button type="button" size="sm" variant="ghost" onClick={typeInstead}>
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
            disabled={!/[\p{L}\p{N}]/u.test(typed)}
            aria-describedby="typed-answer-needs"
            onClick={() =>
              finishWith(null, typed, Math.max(0, (performance.now() - startedAt.current) / 1000))
            }
          >
            Review my answer
          </Button>
          {!/[\p{L}\p{N}]/u.test(typed) && (
            <p id="typed-answer-needs" className="text-sm text-muted-foreground">
              {typed.trim()
                ? 'Write your answer in words to review it.'
                : 'Write an answer to review it. One sentence is enough to start.'}
            </p>
          )}
        </div>
      )}

      {!recording && (
        <div className="border-t border-border/40 pt-4">
          <Button type="button" size="sm" variant="ghost" onClick={skip}>
            {index + 1 < questions.length ? 'Skip to the next question' : 'Skip and finish'}
          </Button>
        </div>
      )}

      <p role="status" className="min-h-5 text-sm text-foreground">
        {notice}
      </p>
      <Announcer message={announcement} />
    </div>
  );
}
