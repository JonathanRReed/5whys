import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';

const oldText = 'Built 3 tools for a student team.';
const newText = 'Led 5 workshops for new students.';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function beginScan(text = oldText) {
  fireEvent.change(screen.getByLabelText('Paste resume text'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze resume' }));
}

function finishPendingScan() {
  act(() => vi.advanceTimersByTime(1000));
}

it('preserves the rescan warning across reload without discarding saved bullets', () => {
  const view = render(<ResumeGame />);
  beginScan();
  finishPendingScan();
  fireEvent.change(screen.getByLabelText('Paste resume text'), { target: { value: newText } });
  view.unmount();
  render(<ResumeGame />);

  expect(screen.getByLabelText('Paste resume text')).toHaveValue(newText);
  expect(screen.getByText('Resume updated. Rerun the analysis to refresh metrics.')).toBeVisible();
  const stored = JSON.parse(localStorage.getItem('resume-game-session-v2') ?? 'null');
  expect(stored.bullets[0].original).toBe(oldText);
});

it('does not restore old analysis after Clear interrupts a scan', () => {
  render(<ResumeGame />);
  beginScan();
  fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  finishPendingScan();

  expect(screen.getByLabelText('Paste resume text')).toHaveValue('');
  expect(screen.queryByRole('heading', { name: 'Analysis visualization' })).toBeNull();
  expect(JSON.parse(localStorage.getItem('resume-game-session-v2') ?? 'null').bullets).toEqual([]);
});

it('does not label older results current when text changes during a scan', () => {
  render(<ResumeGame />);
  beginScan();
  fireEvent.change(screen.getByLabelText('Paste resume text'), { target: { value: newText } });
  finishPendingScan();

  expect(screen.getByLabelText('Paste resume text')).toHaveValue(newText);
  expect(screen.queryByRole('heading', { name: 'Analysis visualization' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Analyze resume' })).toBeEnabled();
});

it('cancels pending analysis when a sample replaces the input', () => {
  render(<ResumeGame />);
  beginScan();
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  finishPendingScan();

  expect(screen.getByLabelText('Paste resume text')).not.toHaveValue(oldText);
  expect(screen.queryByRole('heading', { name: 'Analysis visualization' })).toBeNull();
});
