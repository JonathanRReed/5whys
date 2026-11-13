import * as React from 'react';
import { loadFeature, runFeature } from '../../lib/lazy-feature';
import type { RecordedAudio, SpeechRecorder } from '../../lib/speech';
import SavedRecordings from '../shared/SavedRecordings';
import { Button } from '../ui/button';

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

type Props = {
  /**
   * What is being practised. It is read when recording starts and saved
   * with the take, so editing the draft afterwards cannot relabel it.
   */
  label: string;
  /** Called once recording has started, so the rep clock can run with it. */
  onStart?: () => void;
  /** Called with the length of the take once recording stops. */
  onStop?: (durationMs: number) => void;
};

/**
 * Record a rep and listen back. The microphone is asked for only when the
 * visitor presses record, the take stays in this tab unless they keep it, and
 * nothing is sent anywhere. There is no grade: hearing yourself is the point.
 */
export default function RepRecorder({ label, onStart, onStop }: Props) {
  const [supported, setSupported] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [take, setTake] = React.useState<RecordedAudio | null>(null);
  // The take that was saved, so a save finishing after a new recording cannot mark it kept.
  const [keptTake, setKeptTake] = React.useState<typeof take>(null);
  const kept = Boolean(take && take === keptTake);
  const [notice, setNotice] = React.useState<string | null>(null);
  // A save in flight. A second press while it runs would store the take twice.
  const [keeping, setKeeping] = React.useState(false);
  const keepingRef = React.useRef(false);
  const takeLabel = React.useRef(label);
  const recorder = React.useRef<SpeechRecorder | null>(null);
  const starting = React.useRef(false);
  const startedAt = React.useRef(0);

  React.useEffect(() => {
    setSupported(
      typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
    );
    return () => recorder.current?.cancel();
  }, []);

  React.useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(
      () => setElapsed((performance.now() - startedAt.current) / 1000),
      250
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  const audioUrl = React.useMemo(() => (take ? URL.createObjectURL(take.blob) : null), [take]);
  React.useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  if (!supported) return null;

  const start = async () => {
    // A second press before the microphone is ready would open a second
    // recorder that nothing could stop.
    if (starting.current) return;
    starting.current = true;
    setNotice(null);
    setTake(null);
    setKeptTake(null);
    try {
      const { createRecorder } = await loadFeature(import('../../lib/speech'));
      recorder.current = createRecorder({ onLevel: setLevel });
      await recorder.current.start();
      takeLabel.current = label;
      startedAt.current = performance.now();
      setElapsed(0);
      setRecording(true);
      onStart?.();
    } catch (error) {
      const reason = (error as { reason?: string } | null)?.reason;
      setNotice(
        reason === 'permission-denied'
          ? 'The microphone was not allowed. You can still practise against the timer.'
          : 'Recording could not start. You can still practise against the timer.'
      );
      recorder.current = null;
    } finally {
      starting.current = false;
    }
  };

  const stop = async () => {
    if (!recorder.current) return;
    setRecording(false);
    setLevel(0);
    const stopped = recorder.current;
    recorder.current = null;
    try {
      const recorded = await stopped.stop();
      setTake(recorded);
      onStop?.(recorded.durationMs);
    } catch {
      onStop?.(0);
      setNotice('The recording could not be saved. Try again.');
    }
  };

  const keep = async () => {
    if (!take || kept || keepingRef.current) return;
    keepingRef.current = true;
    setKeeping(true);
    const saving = take;
    try {
      const { saveRecording } = await loadFeature(import('../../lib/local-db'));
      const result = await saveRecording({
        tool: 'networking-practice',
        question: takeLabel.current,
        durationMs: saving.durationMs,
        audio: saving.blob,
        mimeType: saving.mimeType,
      });
      if (result.ok) setKeptTake(saving);
      else setNotice(result.message);
    } finally {
      keepingRef.current = false;
      setKeeping(false);
    }
  };

  return (
    <section
      aria-labelledby="rep-recorder-title"
      className="space-y-3 rounded-2xl border border-border/40 p-5"
      data-guide="rep-recorder"
    >
      <div className="space-y-1">
        <h3 id="rep-recorder-title" className="text-lg font-semibold">
          Hear how it sounds
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Record a rep and listen back. Recording runs the rep timer too. The take stays in this tab
          unless you keep it, and it is never sent anywhere.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button type="button" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={start}>
            {take ? 'Record again' : 'Record this rep'}
          </Button>
        )}
        {recording && (
          <>
            <span className="font-mono text-lg tabular-nums">{clock(elapsed)}</span>
            <span
              className="h-2 w-24 overflow-hidden rounded-full bg-foreground/10"
              role="img"
              aria-label="Microphone level"
            >
              <span
                className="block h-full origin-left rounded-full bg-iris transition-transform duration-100 motion-reduce:transition-none"
                style={{ transform: `scaleX(${Math.min(1, level * 1.4)})` }}
              />
            </span>
          </>
        )}
      </div>
      {audioUrl && take && (
        <div className="space-y-2">
          {/* biome-ignore lint/a11y/useMediaCaption: a visitor's own practice recording has no caption track */}
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {clock(take.durationMs / 1000)} long
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void runFeature(keep)}
              disabled={kept || keeping}
            >
              {kept ? 'Kept on this device' : keeping ? 'Keeping' : 'Keep this recording'}
            </Button>
          </div>
        </div>
      )}
      <p role="status" className="min-h-5 text-sm text-foreground">
        {notice}
      </p>
      <SavedRecordings tool="networking-practice" refresh={keptTake} />
    </section>
  );
}
