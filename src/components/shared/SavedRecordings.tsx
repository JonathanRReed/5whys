import * as React from 'react';
import { loadFeature, reportFeatureFailure, runFeature } from '../../lib/lazy-feature';
import type { RecordingMeta, RecordingTool } from '../../lib/local-db';
import { Button } from '../ui/button';
import ConfirmButton from './ConfirmButton';

const clock = (ms: number) => {
  const whole = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

type Props = {
  tool: RecordingTool;
  /** Change this to read the list again, after a recording is kept. */
  refresh?: unknown;
};

/**
 * The recordings a visitor chose to keep, so they can be heard again or
 * deleted one at a time. The list holds no audio; a recording is read from
 * the device only when Play is pressed, and only one is loaded at a time.
 */
export default function SavedRecordings({ tool, refresh }: Props) {
  const [items, setItems] = React.useState<RecordingMeta[]>([]);
  const [playing, setPlaying] = React.useState<{ id: string; url: string } | null>(null);
  const [notice, setNotice] = React.useState('');

  const read = React.useCallback(async () => {
    const { listRecordings } = await loadFeature(import('../../lib/local-db'));
    const list = await listRecordings({ tool });
    setItems([...list].sort((a, b) => b.createdAt - a.createdAt));
  }, [tool]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `refresh` is the signal to read again
  React.useEffect(() => {
    read().catch(reportFeatureFailure);
  }, [read, refresh]);

  React.useEffect(
    () => () => {
      if (playing) URL.revokeObjectURL(playing.url);
    },
    [playing]
  );

  const play = async (id: string) => {
    const { getRecording } = await loadFeature(import('../../lib/local-db'));
    const recording = await getRecording(id);
    if (!recording) {
      setNotice('That recording is no longer on this device.');
      await read();
      return;
    }
    setPlaying({ id, url: URL.createObjectURL(recording.audio) });
  };

  const remove = async (id: string) => {
    const { deleteRecording } = await loadFeature(import('../../lib/local-db'));
    const result = await deleteRecording(id);
    if (playing?.id === id) setPlaying(null);
    setNotice(result.ok ? 'Recording deleted.' : result.message);
    await read();
  };

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={`saved-recordings-${tool}`} className="space-y-3">
      <h3 id={`saved-recordings-${tool}`} className="text-lg font-semibold">
        Recordings you kept
      </h3>
      <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
        {items.map((item) => {
          const name = item.question.trim() || 'Practice recording';
          const short = name.length > 60 ? `${name.slice(0, 57).trimEnd()}...` : name;
          return (
            <li key={item.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{name}</p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()} · {clock(item.durationMs)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {playing?.id !== item.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runFeature(() => play(item.id))}
                    >
                      Play<span className="sr-only">: {short}</span>
                    </Button>
                  )}
                  <ConfirmButton
                    confirmLabel="Delete this recording?"
                    onConfirm={() => runFeature(() => remove(item.id))}
                    className="px-3 py-1.5 text-xs"
                  >
                    Delete<span className="sr-only">: {short}</span>
                  </ConfirmButton>
                </div>
              </div>
              {playing?.id === item.id && (
                // biome-ignore lint/a11y/useMediaCaption: a visitor's own practice recording has no caption track
                <audio controls autoPlay src={playing.url} className="w-full" />
              )}
            </li>
          );
        })}
      </ul>
      <p role="status" className="min-h-5 text-sm text-foreground">
        {notice}
      </p>
    </section>
  );
}
