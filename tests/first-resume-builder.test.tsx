import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';

const KEY = 'resume-game-session-v2';
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/resume-game/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const stepHeading = () => screen.getByTestId('first-resume-step');

function openForm() {
  fireEvent.click(screen.getByRole('button', { name: 'I do not have a resume yet' }));
}

it('opens from the third way in, without saving anything until the visitor types', () => {
  render(<ResumeGame />);
  openForm();
  expect(screen.getByRole('heading', { name: 'Build a first resume' })).toHaveFocus();
  expect(screen.getByLabelText('Paste resume text')).not.toBeVisible();
  expect(localStorage.getItem(KEY)).toBeNull();

  type('Your name', 'Maya Torres');
  expect(stored().draft).toMatchObject({ name: 'Maya Torres', open: true });
});

it('walks a student from nothing to a scored resume', () => {
  render(<ResumeGame />);
  openForm();

  // Errors are text next to the field, and focus goes to the first one.
  fireEvent.click(screen.getByRole('button', { name: 'Next: School or training' }));
  expect(screen.getByText('Add your name.')).toBeVisible();
  expect(screen.getByLabelText('Your name')).toHaveFocus();
  expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Add your name.');

  type('Your name', 'Maya Torres');
  type('Email', 'maya@example.com');
  expect(screen.queryByText('Add your name.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next: School or training' }));
  expect(stepHeading()).toHaveTextContent('School or training');
  expect(stepHeading()).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Skip: I am not in school' }));
  expect(stepHeading()).toHaveTextContent('Experience');
  expect(stepHeading()).toHaveFocus();

  type('Your role', 'Cashier');
  type('Where (optional)', 'FreshWay Market');
  type('Started (optional)', 'June 2024');
  fireEvent.click(screen.getByLabelText('I still do this'));
  const first = screen.getByRole('group', { name: 'Line 1' });
  fireEvent.change(within(first).getByLabelText('Action word'), { target: { value: 'Counted' } });
  fireEvent.change(within(first).getByLabelText('What you did'), {
    target: { value: 'my cash drawer at close' },
  });
  fireEvent.change(within(first).getByLabelText(/What happened because of it/), {
    target: { value: 'my drawer balanced every shift' },
  });

  // The preview shows the resume taking shape.
  const preview = screen.getByTestId('first-resume-preview');
  expect(preview).toHaveTextContent('Maya Torres');
  expect(preview).toHaveTextContent('Cashier, FreshWay Market | Jun 2024 - Present');
  expect(preview).toHaveTextContent(
    'Counted my cash drawer at close, so my drawer balanced every shift.'
  );
  expect(preview).not.toHaveTextContent('Education');

  fireEvent.click(screen.getByRole('button', { name: 'Next: Skills' }));
  type('Skills (optional)', 'Spanish, Google Sheets');
  fireEvent.click(screen.getByRole('button', { name: 'Use this as my resume' }));

  // In the box, exactly as if pasted, and already scored.
  const text = (screen.getByLabelText('Paste resume text') as HTMLTextAreaElement).value;
  expect(text).toBe(`Maya Torres
maya@example.com

EXPERIENCE
Cashier, FreshWay Market | Jun 2024 - Present
- Counted my cash drawer at close, so my drawer balanced every shift.

SKILLS
Spanish, Google Sheets`);
  const session = stored();
  expect(session.resumeText).toBe(text);
  expect(session.bullets.map((b: { original: string }) => b.original)).toEqual([
    'Counted my cash drawer at close, so my drawer balanced every shift.',
  ]);
  expect(session.needsRescan).toBe(false);
  expect(session.draft.open).toBe(false);
  expect(screen.getByRole('button', { name: 'Download .docx' })).toBeEnabled();
});

it('keeps the form across a reload, on the same step', () => {
  const view = render(<ResumeGame />);
  openForm();
  type('Your name', 'Maya Torres');
  type('Phone', '(559) 555-0142');
  fireEvent.click(screen.getByRole('button', { name: 'Next: School or training' }));
  type('School or program', 'Fresno City College');
  view.unmount();

  render(<ResumeGame />);
  expect(stepHeading()).toHaveTextContent('School or training');
  expect(screen.getByLabelText('School or program')).toHaveValue('Fresno City College');
  expect(screen.getByTestId('first-resume-preview')).toHaveTextContent('(559) 555-0142');
});

it('opens straight from ?start=blank, which the Application Desk links to', () => {
  window.history.replaceState(null, '', '/resume-game/?start=blank&application=a1');
  render(<ResumeGame />);
  expect(screen.getByRole('heading', { name: 'Build a first resume' })).toBeVisible();
  expect(localStorage.getItem(KEY)).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Back to paste or upload' }));
  expect(screen.getByLabelText('Paste resume text')).toBeVisible();
  expect(window.location.search).toBe('?application=a1');
  expect(localStorage.getItem(KEY)).toBeNull();
});

it('asks before replacing a resume already in the box', () => {
  vi.useFakeTimers();
  render(<ResumeGame />);
  fireEvent.change(screen.getByLabelText('Paste resume text'), {
    target: { value: 'Ran the bake sale.' },
  });
  openForm();
  type('Your name', 'Maya Torres');
  type('Email', 'maya@example.com');
  fireEvent.click(screen.getByRole('button', { name: 'Next: School or training' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Experience' }));
  type('Your role', 'Volunteer');
  const line = screen.getByRole('group', { name: 'Line 1' });
  fireEvent.change(within(line).getByLabelText('Action word'), { target: { value: 'Sorted' } });
  fireEvent.change(within(line).getByLabelText('What you did'), {
    target: { value: 'donations by date' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next: Skills' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use this as my resume' }));
  expect(stored().resumeText).toBe('Ran the bake sale.');
  fireEvent.click(screen.getByRole('button', { name: 'Replace the resume in the box?' }));
  expect(stored().resumeText).toContain('- Sorted donations by date.');
  act(() => vi.advanceTimersByTime(500));
  expect(
    screen.getAllByRole('status').some((s) => /Scored 1 bullet/.test(s.textContent ?? ''))
  ).toBe(true);
});

it('offers a first-job sample beside the college one', () => {
  render(<ResumeGame />);
  fireEvent.click(screen.getByRole('button', { name: 'First job' }));
  const box = () => (screen.getByLabelText('Paste resume text') as HTMLTextAreaElement).value;
  expect(box()).toContain('Riverside High School');
  fireEvent.click(screen.getByRole('button', { name: 'College student' }));
  expect(box()).toContain('Jordan Lee');
});
