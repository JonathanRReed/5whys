import * as React from 'react';

const TOTAL_SECONDS = 120;

export type TimerState = {
  remaining: number;
  isRunning: boolean;
  startedAt: number | null;
};

export function useTimer() {
  const [timer, setTimer] = React.useState<TimerState>({
    remaining: TOTAL_SECONDS,
    isRunning: false,
    startedAt: null,
  });

  React.useEffect(() => {
    if (!timer.isRunning) return;
    const tick = () => {
      setTimer((prev) => {
        if (!prev.isRunning) return prev;
        const nextRemaining = Math.max(prev.remaining - 1, 0);
        if (nextRemaining === 0) {
          return { remaining: 0, isRunning: false, startedAt: prev.startedAt };
        }
        return { ...prev, remaining: nextRemaining };
      });
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timer.isRunning]);

  const resetTimer = React.useCallback(() => {
    setTimer({ remaining: TOTAL_SECONDS, isRunning: false, startedAt: null });
  }, []);

  const startTimer = React.useCallback(() => {
    setTimer((prev) => ({
      remaining: prev.remaining === 0 ? TOTAL_SECONDS : prev.remaining,
      isRunning: true,
      startedAt: Date.now(),
    }));
  }, []);

  const pauseTimer = React.useCallback(() => {
    setTimer((prev) => ({ ...prev, isRunning: false }));
  }, []);

  return { timer, resetTimer, startTimer, pauseTimer };
}
