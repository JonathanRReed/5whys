import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GuideCoach from '../src/components/shared/GuideCoach';
import { type GuideTool, loadGuideProgress } from '../src/lib/guide';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  // Unmount first: the coach lives in a portal on <body>.
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  document.body.innerHTML = '';
});

it('offers the guide and stays out of the way until asked', () => {
  render(<GuideCoach tool="resume-game" />);
  expect(screen.getByText(/New to this\?/)).toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: 'Guide' })).toBeNull();
  expect(loadGuideProgress('resume-game')).toBeNull();
});

it('walks forward when the visitor does the step, and marks its place on the page', () => {
  const box = document.createElement('textarea');
  box.setAttribute('aria-label', 'Paste resume text');
  document.body.appendChild(box);
  render(<GuideCoach tool="resume-game" />);

  fireEvent.click(screen.getByRole('radio', { name: /^Guide/ }));
  const coach = screen.getByRole('complementary', { name: 'Guide' });
  expect(coach).toHaveTextContent('Step 1 of 4');
  expect(coach).toHaveTextContent('Put a resume in');
  expect(box).toHaveAttribute('data-guide-active');

  box.value = 'Led a team of four volunteers to run the weekly campus food drive.';
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(coach).toHaveTextContent('Step 2 of 4');
  // The reason is held back until the step is done.
  expect(coach).toHaveTextContent('Done. Everything here works on the lines you gave it');
  expect(box).not.toHaveAttribute('data-guide-active');
  expect(loadGuideProgress('resume-game')?.done).toEqual(['add-resume']);
});

it('can skip a step and be ended, and remembers the choice', () => {
  render(<GuideCoach tool="resume-game" />);
  fireEvent.click(screen.getByRole('radio', { name: /^Guide/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }));
  expect(screen.getByRole('complementary', { name: 'Guide' })).toHaveTextContent('Step 2 of 4');
  fireEvent.click(screen.getByRole('button', { name: 'End guide' }));
  expect(screen.queryByRole('complementary', { name: 'Guide' })).toBeNull();
  expect(loadGuideProgress('resume-game')?.mode).toBe('free');
  expect(screen.getByText(/working on your own/)).toBeInTheDocument();
});

it('shows nothing for a tool that has no guide', () => {
  // Every listed tool has a guide now, so stand in a name the registry lacks.
  const { container } = render(<GuideCoach tool={'unlisted' as GuideTool} />);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole('complementary', { name: 'Guide' })).toBeNull();
});
