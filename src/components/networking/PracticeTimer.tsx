import type * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { TIMER_LENGTHS, type TimerState } from './useTimer';

type Props = {
  timer: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onLengthChange: (seconds: number) => void;
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

export default function PracticeTimer({ timer, onStart, onPause, onReset, onLengthChange }: Props) {
  const progress = timer.total > 0 ? (timer.total - timer.remaining) / timer.total : 0;
  const isComplete = timer.remaining === 0 && !timer.isRunning && timer.startedAt !== null;
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, hsl(var(--border)/0.3) 0deg)`,
  };

  return (
    <Card className="border-primary/60 bg-overlay/30">
      <CardHeader className="text-center">
        <CardTitle className="text-primary">Rep timer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div
          className="relative flex items-center justify-center w-48 h-48 rounded-full border border-border/60"
          role="progressbar"
          aria-label="Practice timer progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${formatTime(timer.remaining)} remaining of ${formatTime(timer.total)}`}
        >
          <div
            className={`absolute inset-1 rounded-full transition-all ${isComplete ? 'animate-pulse' : ''}`}
            style={ringStyle}
            aria-hidden="true"
          />
          <div
            className="relative flex flex-col items-center justify-center w-40 h-40 rounded-full bg-overlay/30 text-3xl font-semibold"
            role="timer"
            aria-live="polite"
            aria-label="Time remaining"
          >
            {formatTime(timer.remaining)}
            <span className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {isComplete ? "Time's up!" : 'seconds left'}
            </span>
          </div>
        </div>
        <ToggleGroup
          type="single"
          value={String(timer.total)}
          onValueChange={(value) => value && onLengthChange(Number(value))}
          disabled={timer.isRunning}
          aria-label="Rep length"
          className="flex-wrap justify-center gap-1.5"
        >
          {TIMER_LENGTHS.map((option) => (
            <Tooltip key={option.seconds}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={String(option.seconds)}
                  aria-label={`${option.label}: ${option.hint}`}
                  className="rounded-full border border-border/50 px-3 text-xs text-muted-foreground data-[state=on]:border-primary/70 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground"
                >
                  {option.label}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{option.hint}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={onStart}
            disabled={timer.isRunning || isComplete}
            aria-pressed={timer.isRunning}
            className="bg-primary hover:bg-primary/80 disabled:bg-primary/40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            {timer.isRunning ? 'Running' : isComplete ? 'Done' : 'Start'}
          </Button>
          <Button
            onClick={onPause}
            disabled={!timer.isRunning}
            variant="outline"
            className="border-border/60 text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Pause
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            className="border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Reset
          </Button>
        </div>
        {timer.elapsed > 0 ? (
          <p className="text-sm font-medium text-foam" aria-live="polite">
            {formatTime(timer.elapsed)} practiced this rep
          </p>
        ) : null}
        <p className="text-sm text-center text-muted-foreground">
          Practice aloud, or time your written message as you read it back. The length follows the
          scenario, and your practice time is saved with the rep.
        </p>
      </CardContent>
    </Card>
  );
}
