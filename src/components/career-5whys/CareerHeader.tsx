import * as React from 'react';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import QuickStartTiles from '../QuickStartTiles';
import { cn } from '../../lib/utils';
import { TRACKS, WHY_COUNT, type Track } from './shared';

type CareerHeaderProps = {
  showHeader: boolean;
  track: Track;
  topic: string;
  sequentialCount: number;
  progressPercent: number;
  onTrackChange: (track: Track) => void;
  onTopicChange: (topic: string) => void;
};

export default function CareerHeader({
  showHeader,
  track,
  topic,
  sequentialCount,
  progressPercent,
  onTrackChange,
  onTopicChange,
}: CareerHeaderProps) {
  const activeTrack = TRACKS[track];

  return (
    <>
      {showHeader && (
        <header className="space-y-4 text-center">
          <p className="eyebrow eyebrow-accent justify-self-center">Career 5 Whys</p>
          <h1 className="text-4xl font-semibold tracking-tight">Discover your why</h1>
          <p className="mx-auto max-w-2xl text-[hsl(var(--muted-foreground))]">
            Guided reasoning for uncovering the motivation behind your next career move. Choose a
            track, document five layers of reasoning, and leave with a statement you can reuse
            across resume, interview, and networking prep.
          </p>
          <QuickStartTiles
            className="max-w-4xl"
            items={[
              {
                title: 'Pick your lens',
                body: 'Select "Career" when you\u2019re validating a defined role, or "Interest" when you\u2019re still exploring themes.',
              },
              {
                title: 'Answer sequentially',
                body: 'Move down the prompts in order. The sidebar tracks depth so you can spot gaps quickly.',
              },
              {
                title: 'Save or export',
                body: 'Capture snapshots as you go, then export a JSON bundle once you land on language that resonates.',
              },
            ]}
          />
        </header>
      )}

      <Card className="bg-[hsl(var(--card)/0.98)] border-[hsl(var(--border)/0.55)] text-[hsl(var(--foreground))] shadow-[0_20px_80px_hsl(var(--background)/0.28)]">
        <CardHeader className="space-y-6">
          <div>
            <CardTitle className="text-2xl font-semibold">Select your track</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              The prompts adapt to how defined your path currently is.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            {Object.entries(TRACKS).map(([key, config]) => {
              const isActive = track === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTrackChange(key as Track)}
                  className={cn(
                    'flex-1 rounded-2xl border px-4 py-5 text-left transition-all',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--primary))]',
                    isActive
                      ? 'border-[hsl(var(--primary)/0.8)] bg-[hsl(var(--primary)/0.1)] shadow-inner text-[hsl(var(--foreground))]'
                      : 'border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--border)/0.7)]'
                  )}
                >
                  <p className="text-sm font-semibold">{config.label}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                    {config.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label
                htmlFor="career-topic"
                className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
              >
                {activeTrack.topicLabel}
              </Label>
              <Input
                id="career-topic"
                value={topic}
                onChange={(event) => onTopicChange(event.target.value)}
                placeholder={activeTrack.topicPlaceholder}
                className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                Progress
              </Label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.1)] text-lg font-semibold text-[hsl(var(--foreground))]">
                  {sequentialCount}
                </div>
                <div>
                  <p className="text-sm text-[hsl(var(--foreground))]">
                    {sequentialCount === WHY_COUNT ? 'Depth unlocked' : 'Reasoning depth'}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {progressPercent}% complete
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}
