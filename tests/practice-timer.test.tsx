import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PracticeTimer from '../src/components/networking/PracticeTimer';

afterEach(() => {
  cleanup();
});

const defaultTimer = {
  total: 30,
  remaining: 30,
  elapsed: 0,
  isRunning: false,
  startedAt: null,
};

it('sets aria-live="off" on role="timer" to prevent per-second chatter', () => {
  render(
    <PracticeTimer
      timer={defaultTimer}
      onStart={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onLengthChange={vi.fn()}
    />
  );

  const timerElement = screen.getByRole('timer');
  expect(timerElement).toHaveAttribute('aria-live', 'off');
});

it('announces discrete timer status transitions via polite status region', () => {
  const { rerender } = render(
    <PracticeTimer
      timer={defaultTimer}
      onStart={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onLengthChange={vi.fn()}
    />
  );

  const statusRegion = screen.getByRole('status');
  expect(statusRegion).toHaveTextContent('');

  // Start timer
  rerender(
    <PracticeTimer
      timer={{
        ...defaultTimer,
        isRunning: true,
        remaining: 29,
        elapsed: 1,
        startedAt: Date.now(),
      }}
      onStart={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onLengthChange={vi.fn()}
    />
  );
  expect(statusRegion).toHaveTextContent('Timer started');

  // Pause timer
  rerender(
    <PracticeTimer
      timer={{
        ...defaultTimer,
        isRunning: false,
        remaining: 20,
        elapsed: 10,
        startedAt: Date.now(),
      }}
      onStart={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onLengthChange={vi.fn()}
    />
  );
  expect(statusRegion).toHaveTextContent('Timer paused');

  // Timer complete
  rerender(
    <PracticeTimer
      timer={{
        ...defaultTimer,
        isRunning: false,
        remaining: 0,
        elapsed: 30,
        startedAt: Date.now(),
      }}
      onStart={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onLengthChange={vi.fn()}
    />
  );
  expect(statusRegion).toHaveTextContent("Time's up! Rep finished.");
});
