import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PracticeTimer from '../src/components/networking/PracticeTimer';
import { useNetworkingPractice } from '../src/components/networking/useNetworkingPractice';
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
  localStorage.clear();
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
  expect(screen.getByRole('button', { name: 'Restart' })).toBeEnabled();
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

it('restarts completed reps from zero without accumulating displayed practice time', () => {
  render(<TimerHarness />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => vi.advanceTimersByTime(30000));

  for (let rep = 0; rep < 2; rep += 1) {
    expect(screen.getByText('00:30 practiced this rep')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.getByRole('timer')).toHaveTextContent('00:30');
    expect(screen.queryByText(/practiced this rep/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Timer started');
    expect(screen.getByRole('button', { name: 'Running' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('00:29');
    expect(screen.getByText('00:01 practiced this rep')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(29000));
    expect(screen.getByRole('status')).toHaveTextContent("Time's up! Rep finished.");
  }
  expect(screen.getByText('00:30 practiced this rep')).toBeInTheDocument();
});

it('resumes a paused rep without resetting its elapsed practice time', () => {
  render(<TimerHarness />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => vi.advanceTimersByTime(7000));
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  act(() => vi.advanceTimersByTime(20000));
  expect(screen.getByText('00:07 practiced this rep')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('timer')).toHaveTextContent('00:23');
  expect(screen.getByText('00:07 practiced this rep')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('timer')).toHaveTextContent('00:18');
  expect(screen.getByText('00:12 practiced this rep')).toBeInTheDocument();
});

it.each([30, 60, 120, 300])(
  'saves only the restarted rep duration for a %i-second practice',
  (seconds) => {
    const { result } = renderHook(() => useNetworkingPractice());
    act(() => {
      result.current.setTimerLength(seconds);
      result.current.setDraft('I built a synthetic test project for a student team.');
      result.current.handleRatingChange('clarity', 4);
    });
    act(() => result.current.startTimer());
    act(() => vi.advanceTimersByTime(seconds * 1000));
    expect(result.current.timer.elapsed).toBe(seconds);
    act(() => result.current.startTimer());
    act(() => vi.advanceTimersByTime(seconds * 1000));
    act(() => result.current.saveCurrentSession());

    const stored = JSON.parse(localStorage.getItem('networking-practice-sessions') ?? 'null');
    expect(stored).toHaveLength(1);
    expect(stored[0].attempts[0].durationSeconds).toBe(seconds);
    expect(result.current.sessions[0].attempts[0].durationSeconds).toBe(seconds);
  }
);

it('saves actual partial practice after restarting and pausing rather than the selected length', () => {
  const { result } = renderHook(() => useNetworkingPractice());
  act(() => {
    result.current.setTimerLength(30);
    result.current.setDraft('A synthetic intro for practice.');
    result.current.handleRatingChange('clarity', 4);
  });
  act(() => result.current.startTimer());
  act(() => vi.advanceTimersByTime(30000));
  act(() => result.current.startTimer());
  act(() => vi.advanceTimersByTime(5000));
  act(() => result.current.pauseTimer());
  act(() => vi.advanceTimersByTime(20000));
  act(() => result.current.startTimer());
  act(() => vi.advanceTimersByTime(7000));
  act(() => result.current.pauseTimer());
  expect(result.current.timer.elapsed).toBe(12);
  act(() => result.current.saveCurrentSession());

  const stored = JSON.parse(localStorage.getItem('networking-practice-sessions') ?? 'null');
  expect(stored[0].attempts[0].durationSeconds).toBe(12);
});
