import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InterviewGlowUpWorkspace from '../src/components/interview-glow-up/InterviewGlowUpWorkspace';

const oldPosting = 'Software engineer\nBuild Python APIs for internal reporting.';
const newPosting = 'Community coordinator\nOrganize events and manage volunteer schedules.';
const warning = /Saved requirements may not match this job posting/;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function parsePosting() {
  fireEvent.change(screen.getByLabelText('Paste the job posting'), {
    target: { value: oldPosting },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Parse the requirements' }));
  act(() => vi.advanceTimersByTime(400));
}

it('warns after posting edits and preserves earlier requirements across reload', () => {
  const view = render(<InterviewGlowUpWorkspace />);
  parsePosting();
  expect(screen.queryByText(warning)).toBeNull();
  fireEvent.change(screen.getByLabelText('Paste the job posting'), {
    target: { value: newPosting },
  });
  expect(screen.getByText(warning)).toBeVisible();
  act(() => vi.advanceTimersByTime(400));
  view.unmount();
  render(<InterviewGlowUpWorkspace />);
  expect(screen.getByText(warning)).toBeVisible();
  const saved = JSON.parse(localStorage.getItem('interview-glow-up-data') ?? 'null');
  expect(saved.roles[0].rawJdText).toBe(newPosting);
  expect(saved.roles[0].bullets[0].text).toContain('Python');
});

it('clears the warning only when the changed posting is parsed', () => {
  render(<InterviewGlowUpWorkspace />);
  parsePosting();
  fireEvent.change(screen.getByLabelText('Paste the job posting'), {
    target: { value: newPosting },
  });
  expect(screen.getByText(warning)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Parse again' }));
  expect(screen.queryByText(warning)).toBeNull();
  act(() => vi.advanceTimersByTime(400));
  const saved = JSON.parse(localStorage.getItem('interview-glow-up-data') ?? 'null');
  expect(saved.roles[0].bullets[0].text).toContain('Organize events');
});

it('asks for a refresh when saved legacy requirements have unknown freshness', () => {
  const view = render(<InterviewGlowUpWorkspace />);
  parsePosting();
  view.unmount();
  const saved = JSON.parse(localStorage.getItem('interview-glow-up-data') ?? 'null');
  delete saved.roles[0].parsedJdText;
  localStorage.setItem('interview-glow-up-data', JSON.stringify(saved));
  render(<InterviewGlowUpWorkspace />);
  expect(screen.getByText(warning)).toBeVisible();
});
