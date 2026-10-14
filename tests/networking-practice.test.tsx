import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NetworkingPractice from '../src/components/NetworkingPractice';
import PracticeTimer from '../src/components/networking/PracticeTimer';
import { useTimer } from '../src/components/networking/useTimer';

function TestTimerWrapper() {
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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('deletes an intro version in-place with ConfirmButton without window.confirm', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  render(<NetworkingPractice />);

  // Open the customize disclosure
  fireEvent.click(screen.getByRole('button', { name: /Customize this scenario/i }));

  const initialIds = new Set(
    JSON.parse(localStorage.getItem('networking-practice-versions') ?? '[]').map(
      (version: { id: string }) => version.id
    )
  );

  // Create another version so "Delete this intro" is rendered
  fireEvent.click(screen.getByRole('button', { name: 'Start another intro' }));

  const deleteButton = screen.getByRole('button', { name: 'Delete this intro' });
  expect(deleteButton).toBeInTheDocument();

  const savedBefore = localStorage.getItem('networking-practice-versions');
  const versionsBefore = JSON.parse(savedBefore ?? '[]');
  expect(versionsBefore.length).toBeGreaterThan(initialIds.size);
  const deletedId = versionsBefore.find(
    (version: { id: string }) => !initialIds.has(version.id)
  )?.id;
  expect(deletedId).toBeDefined();

  // First click arms the button
  fireEvent.click(deleteButton);
  expect(confirmSpy).not.toHaveBeenCalled();

  const armedButton = screen.getByRole('button', { name: 'Delete this intro?' });
  expect(armedButton).toBeInTheDocument();
  expect(localStorage.getItem('networking-practice-versions')).toBe(savedBefore);

  // Second click executes the deletion
  fireEvent.click(armedButton);
  expect(confirmSpy).not.toHaveBeenCalled();

  const versionsAfter = JSON.parse(localStorage.getItem('networking-practice-versions') ?? '[]');
  expect(versionsAfter).toHaveLength(versionsBefore.length - 1);
  expect(versionsAfter.some((version: { id: string }) => version.id === deletedId)).toBe(false);
  expect(screen.queryByRole('button', { name: 'Delete this intro?' })).toBeNull();
});

it('displays Restart button when practice rep completes and allows immediate restart', () => {
  vi.useFakeTimers();
  render(<TestTimerWrapper />);

  const startButton = screen.getByRole('button', { name: 'Start' });
  expect(startButton).not.toBeDisabled();

  fireEvent.click(startButton);

  expect(screen.getByRole('button', { name: 'Running' })).toBeDisabled();

  act(() => {
    vi.advanceTimersByTime(30000);
  });

  const restartButton = screen.getByRole('button', { name: 'Restart' });
  expect(restartButton).not.toBeDisabled();

  fireEvent.click(restartButton);

  expect(screen.getByRole('button', { name: 'Running' })).toBeDisabled();

  vi.useRealTimers();
});
