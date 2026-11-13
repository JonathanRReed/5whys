import * as React from 'react';

const MAX_ELAPSED_SECONDS = 600;

/**
 * How long a rep runs. A career fair with a line behind you is thirty
 * seconds; a coffee chat opener is two minutes; reading a cold email aloud
 * sits in between. One fixed length made most of the twelve scenarios
 * rehearse against the wrong clock.
 */
export const TIMER_LENGTHS = [
  { seconds: 30, label: '30s', hint: 'Career fair, a line behind you' },
  { seconds: 60, label: '1 min', hint: 'A written message, read aloud' },
  { seconds: 120, label: '2 min', hint: 'Coffee chat or alumni intro' },
  { seconds: 300, label: '5 min', hint: 'A full conversation' },
] as const;

export const DEFAULT_TIMER_SECONDS = 120;

/** The length each scenario is usually rehearsed at. */
export const SCENARIO_TIMER_SECONDS: Record<string, number> = {
  'career-fair': 30,
  'freshman-fair': 30,
  'info-session': 30,
  linkedin: 60,
  'professor-email': 60,
  'followup-silence': 60,
  conference: 120,
  'alumni-coffee': 120,
  'family-friend': 120,
  'career-changer': 120,
  'virtual-breakout': 120,
  'first-week': 300,
};

export type TimerState = {
  remaining: number;
  elapsed: number;
  isRunning: boolean;
  startedAt: number | null;
  /** Seconds already counted when the clock last started. */
  elapsedAtStart: number;
  /** The length this rep is counting down from. */
  total: number;
};

/**
 * Where the clock is now, from the wall clock rather than from how many
 * ticks arrived. A tab that stalls or sleeps catches up instead of
 * stretching the rep.
 */
export function timerAt(prev: TimerState, now: number): TimerState {
  if (!prev.isRunning || prev.startedAt === null) return prev;
  const counted = prev.elapsedAtStart + Math.floor(Math.max(0, now - prev.startedAt) / 1000);
  const elapsed = Math.min(counted, MAX_ELAPSED_SECONDS);
  const remaining = Math.max(prev.total - counted, 0);
  if (remaining === 0) return { ...prev, remaining: 0, elapsed, isRunning: false };
  if (elapsed === prev.elapsed && remaining === prev.remaining) return prev;
  return { ...prev, remaining, elapsed };
}

export function useTimer(initialSeconds: number = DEFAULT_TIMER_SECONDS) {
  const [timer, setTimer] = React.useState<TimerState>({
    remaining: initialSeconds,
    elapsed: 0,
    isRunning: false,
    startedAt: null,
    elapsedAtStart: 0,
    total: initialSeconds,
  });

  React.useEffect(() => {
    if (!timer.isRunning) return;
    const tick = () => setTimer((prev) => timerAt(prev, Date.now()));
    // Ticks only redraw; the time itself comes from the clock.
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  const resetTimer = React.useCallback(() => {
    setTimer((prev) => ({
      remaining: prev.total,
      elapsed: 0,
      isRunning: false,
      startedAt: null,
      elapsedAtStart: 0,
      total: prev.total,
    }));
  }, []);

  const startTimer = React.useCallback(() => {
    setTimer((prev) => {
      if (prev.isRunning) return prev;
      const elapsed = prev.remaining === 0 ? 0 : prev.elapsed;
      return {
        ...prev,
        remaining: prev.remaining === 0 ? prev.total : prev.remaining,
        elapsed,
        elapsedAtStart: elapsed,
        isRunning: true,
        startedAt: Date.now(),
      };
    });
  }, []);

  const pauseTimer = React.useCallback(() => {
    // Count up to this moment first, so a stalled tick is not lost.
    setTimer((prev) => ({ ...timerAt(prev, Date.now()), isRunning: false }));
  }, []);

  /** Change the rep length. Only allowed while the clock is not running. */
  const setTimerLength = React.useCallback((seconds: number) => {
    setTimer((prev) => {
      if (prev.isRunning) return prev;
      return {
        ...prev,
        total: seconds,
        remaining: seconds,
        elapsed: 0,
        elapsedAtStart: 0,
        startedAt: null,
      };
    });
  }, []);

  return { timer, resetTimer, startTimer, pauseTimer, setTimerLength };
}
