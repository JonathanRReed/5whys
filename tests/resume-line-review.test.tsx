import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function scan() {
  fireEvent.change(screen.getByLabelText('Paste resume text'), {
    target: { value: 'Built a reporting tool for a research team.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze resume' }));
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole('button', { name: 'Review detected lines' }));
}

it('lets a person correct the reviewed lines and preserves them across reload', () => {
  const view = render(<ResumeGame />);
  scan();
  const corrected = 'Built a reporting tool that removed duplicate records.';
  fireEvent.change(screen.getByLabelText('Achievement lines to review'), {
    target: { value: corrected },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed lines' }));
  view.unmount();
  render(<ResumeGame />);
  const stored = JSON.parse(localStorage.getItem('resume-game-session-v2') ?? 'null');
  expect(stored.bullets.map((bullet: { original: string }) => bullet.original)).toEqual([
    corrected,
  ]);
  expect(stored.resumeText).toBe('Built a reporting tool for a research team.');
});

it('does not overwrite saved results when the line review is cancelled', () => {
  render(<ResumeGame />);
  scan();
  fireEvent.change(screen.getByLabelText('Achievement lines to review'), {
    target: { value: 'This should not replace saved work.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel line review' }));
  const stored = JSON.parse(localStorage.getItem('resume-game-session-v2') ?? 'null');
  expect(stored.bullets[0].original).toBe('Built a reporting tool for a research team.');
});

it('requires a rescan before applying line corrections to changed source text', () => {
  render(<ResumeGame />);
  scan();
  fireEvent.change(screen.getByLabelText('Paste resume text'), {
    target: { value: 'Led workshops for new volunteers.' },
  });
  expect(screen.queryByRole('button', { name: 'Apply reviewed lines' })).toBeNull();
});
