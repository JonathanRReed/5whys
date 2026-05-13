import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

const TOTAL_SECONDS = 120;

type TimerState = {
  remaining: number;
  isRunning: boolean;
  startedAt: number | null;
};

type Props = {
  timer: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function PracticeTimer({ timer, onStart, onPause, onReset }: Props) {
  const progress = (TOTAL_SECONDS - timer.remaining) / TOTAL_SECONDS;
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, hsl(var(--border)/0.3) 0deg)`,
  };

  return (
    <Card className="border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
      <CardHeader className="text-center">
        <CardTitle className="text-[hsl(var(--primary))]">Two-Minute Timer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center w-48 h-48 rounded-full border border-[hsl(var(--border)/0.6)]">
          <div className="absolute inset-1 rounded-full" style={ringStyle} />
          <div className="relative flex flex-col items-center justify-center w-40 h-40 rounded-full bg-[hsl(var(--overlay)/0.3)] text-3xl font-semibold">
            {formatTime(timer.remaining)}
            <span className="mt-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">remaining</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={onStart}
            disabled={timer.isRunning}
            aria-pressed={timer.isRunning}
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.8)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {timer.isRunning ? 'Running' : 'Start'}
          </Button>
          <Button
            onClick={onPause}
            disabled={!timer.isRunning}
            variant="outline"
            className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pause
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]"
          >
            Reset
          </Button>
        </div>
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))]">
          Practice aloud or time your typed intro. Aim for a confident 90–120 second pitch.
        </p>
      </CardContent>
    </Card>
  );
}
