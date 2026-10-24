import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PracticeTimer from '../src/components/networking/PracticeTimer';
import { useTimer } from '../src/components/networking/useTimer';

function TimerHarness() {
  const { timer, startTimer, pauseTimer, resetTimer, setTimerLength } = useTimer(30);
  return (
    <PracticeTimer
      timer={timer}
      onStart={startTimer}
      onPause={pauseTimer}
      onReset={resetTimer}
      onLengthChange={setTimerLength}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('announces start, immediate pause and resume without waiting for an elapsed tick', () => {
  render(<TimerHarness />);
  const status = screen.getByRole('status');
  const countdown = screen.getByRole('timer');
  expect(status).toBeEmptyDOMElement();
  expect(status).toHaveAttribute('aria-live', 'polite');
  expect(countdown).toHaveAttribute('aria-live', 'off');
  expect(countdown).toHaveTextContent('00:30');

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(status).toHaveTextContent('Timer started');
  expect(screen.getByRole('button', { name: 'Running' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(status).toHaveTextContent('Timer paused');
  expect(countdown).toHaveTextContent('00:30');
  act(() => vi.advanceTimersByTime(2000));
  expect(countdown).toHaveTextContent('00:30');
  expect(status).toHaveTextContent('Timer paused');

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(status).toHaveTextContent('Timer started');
  act(() => vi.advanceTimersByTime(1000));
  expect(countdown).toHaveTextContent('00:29');
  expect(status).toHaveTextContent('Timer started');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(status).toHaveTextContent('Timer paused');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(status).toHaveTextContent('Timer started');
});

it('keeps per-second updates outside the live region and announces completion once', async () => {
  const { container } = render(<TimerHarness />);
  const status = screen.getByRole('status');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  const mutations: MutationRecord[] = [];
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(status, { childList: true, characterData: true, subtree: true });

  await act(async () => vi.advanceTimersByTime(29000));
  expect(screen.getByRole('timer')).toHaveTextContent('00:01');
  expect(screen.getByText('00:29 practiced this rep')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '97');
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '00:01 remaining of 00:30'
  );
  expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  expect(mutations).toHaveLength(0);

  await act(async () => vi.advanceTimersByTime(1000));
  expect(status).toHaveTextContent("Time's up! Rep finished.");
  expect(screen.getByRole('timer')).toHaveTextContent('00:00');
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
  expect(mutations).toHaveLength(1);
  await act(async () => vi.advanceTimersByTime(5000));
  expect(mutations).toHaveLength(1);
  expect(screen.getByText('00:30 practiced this rep')).toBeInTheDocument();
  observer.disconnect();
});

it('clears the announcement on reset or length change and can announce a fresh rep', () => {
  render(<TimerHarness />);
  const status = screen.getByRole('status');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(status).toBeEmptyDOMElement();
  expect(screen.getByRole('timer')).toHaveTextContent('00:30');
  expect(screen.queryByText(/practiced this rep/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(status).toHaveTextContent('Timer started');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('radio', { name: '1 min: A written message, read aloud' }));
  expect(status).toBeEmptyDOMElement();
  expect(screen.getByRole('timer')).toHaveTextContent('01:00');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => vi.advanceTimersByTime(60000));
  expect(status).toHaveTextContent("Time's up! Rep finished.");
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(status).toBeEmptyDOMElement();
  expect(screen.getByRole('timer')).toHaveTextContent('01:00');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(status).toHaveTextContent('Timer started');
});
