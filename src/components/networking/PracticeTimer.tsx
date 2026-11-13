import type * as React from 'react';
import { cn } from '../../lib/utils';
import WordHelp from '../shared/WordHelp';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
  const statusAnnouncement = isComplete
    ? 'Time is up. Rep finished.'
    : timer.isRunning
      ? 'Timer started'
      : timer.startedAt !== null
        ? 'Timer paused'
        : '';
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, hsl(var(--border)/0.3) 0deg)`,
  };

  return (
    <Card className="border-primary/60 bg-overlay/30" data-guide="rep-timer">
      <CardHeader className="text-center">
        <CardTitle className="text-primary">Rep timer</CardTitle>
        <WordHelp words={['rep']} className="flex flex-col items-center" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div role="status" aria-live="polite" className="sr-only">
          {statusAnnouncement}
        </div>
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
            aria-live="off"
            aria-label="Time remaining"
          >
            {formatTime(timer.remaining)}
            <span className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {isComplete ? 'Time is up' : 'seconds left'}
            </span>
          </div>
        </div>
        {/* Native radios: the arrow keys move the choice as well as the focus. */}
        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={timer.isRunning}>
          <legend className="sr-only">Rep length</legend>
          <div className="flex flex-wrap justify-center gap-1.5">
            {TIMER_LENGTHS.map((option) => (
              <Tooltip key={option.seconds}>
                <TooltipTrigger asChild>
                  <label className="relative">
                    <input
                      type="radio"
                      name="rep-length"
                      value={option.seconds}
                      checked={timer.total === option.seconds}
                      onChange={() => onLengthChange(option.seconds)}
                      className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <span
                      className={cn(
                        'inline-flex min-h-9 items-center rounded-full border border-border/50 px-3 text-xs text-muted-foreground transition-colors',
                        'peer-hover:border-border peer-hover:text-foreground',
                        'peer-checked:border-primary/70 peer-checked:bg-primary/15 peer-checked:text-foreground',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-70'
                      )}
                    >
                      {option.label}
                      <span className="sr-only">: {option.hint}</span>
                    </span>
                  </label>
                </TooltipTrigger>
                <TooltipContent>{option.hint}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-center gap-2">
          {/* aria-disabled, not disabled: a disabled button drops the keyboard focus. */}
          <Button
            onClick={() => {
              if (!timer.isRunning) onStart();
            }}
            aria-disabled={timer.isRunning || undefined}
            aria-pressed={timer.isRunning}
            className="bg-primary hover:bg-primary/90 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-primary focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            {timer.isRunning ? 'Running' : isComplete ? 'Restart' : 'Start'}
          </Button>
          <Button
            onClick={() => {
              if (timer.isRunning) onPause();
            }}
            aria-disabled={!timer.isRunning || undefined}
            variant="outline"
            className="border-border/60 text-foreground aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Pause
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            className="border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Reset <span className="sr-only">timer</span>
          </Button>
        </div>
        {timer.elapsed > 0 ? (
          <p className="text-sm font-medium text-foam" data-guide="timer-elapsed">
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
