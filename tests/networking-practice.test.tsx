import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NetworkingPractice from '../src/components/NetworkingPractice';

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

const DRAFT_KEY = 'networking-practice-draft';

function rateRep(label: string, value: number) {
  const group = screen.getByRole('radiogroup', { name: label });
  fireEvent.click(within(group).getByRole('radio', { name: String(value) }));
}

it('starts with every rating unset, no average, and nothing written', () => {
  render(<NetworkingPractice />);
  for (const label of ['Confidence', 'Clarity', 'Rapport', 'Authenticity']) {
    const group = screen.getByRole('radiogroup', { name: label });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect(within(group).queryByRole('radio', { checked: true })).toBeNull();
  }
  expect(screen.getAllByText('Not rated')).toHaveLength(4);
  expect(screen.queryByText('Average')).toBeNull();
  expect(screen.queryByText('Next step')).toBeNull();
  expect(document.body.textContent).not.toMatch(/\d(\.\d)?\s*\/\s*5\b/);
  expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
});

it('shows the average and next step only once all four are rated, and saves only then', () => {
  render(<NetworkingPractice />);
  fireEvent.change(screen.getByLabelText('Draft', { selector: 'textarea' }), {
    target: { value: 'Hi, I am Jordan, a sophomore in communications.' },
  });
  rateRep('Confidence', 2);
  expect(screen.getByText('2/5')).toBeInTheDocument();
  expect(screen.queryByText('Average')).toBeNull();
  expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}').ratings).toEqual({ confidence: 2 });

  fireEvent.click(screen.getByRole('button', { name: 'Save this rep' }));
  expect(
    screen.getAllByText(/Clarity, Rapport and Authenticity (are|is) not rated yet/).length
  ).toBeGreaterThan(0);
  expect(localStorage.getItem('networking-practice-sessions')).toBeNull();

  rateRep('Clarity', 4);
  rateRep('Rapport', 4);
  rateRep('Authenticity', 4);
  expect(screen.getByText('Average')).toBeInTheDocument();
  expect(screen.getByText('3.5/5')).toBeInTheDocument();
  expect(screen.getByText('Next step')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save this rep' }));
  const sessions = JSON.parse(localStorage.getItem('networking-practice-sessions') ?? '[]');
  expect(sessions).toHaveLength(1);
  expect(sessions[0].ratings).toEqual({ confidence: 2, clarity: 4, rapport: 4, authenticity: 4 });
  // The next rep starts unrated again.
  expect(screen.getAllByText('Not rated')).toHaveLength(4);
});

it('loads an old draft, keeping only the ratings that were moved off the old default', () => {
  const stored = JSON.stringify({
    text: 'My saved intro',
    ratings: { confidence: 3, clarity: 5, rapport: 3, authenticity: 2 },
    ratingsTouched: true,
    reflection: { humanNote: '', nervesNote: '', nextFocus: '', wins: '' },
    versionId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  localStorage.setItem(DRAFT_KEY, stored);
  render(<NetworkingPractice />);
  expect(screen.getByDisplayValue('My saved intro')).toBeInTheDocument();
  expect(screen.getByText('5/5')).toBeInTheDocument();
  expect(screen.getByText('2/5')).toBeInTheDocument();
  expect(screen.getAllByText('Not rated')).toHaveLength(2);
  // Reading the draft does not rewrite it.
  expect(localStorage.getItem(DRAFT_KEY)).toBe(stored);
});

it('treats an old untouched draft as unrated', () => {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      text: 'Intro',
      ratings: { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 },
      ratingsTouched: false,
    })
  );
  render(<NetworkingPractice />);
  expect(screen.getAllByText('Not rated')).toHaveLength(4);
});

it('restores a new-format draft exactly, threes included', () => {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      text: 'Intro',
      ratings: { confidence: 3, rapport: 4 },
      ratingsTouched: true,
      ratingFormat: 2,
    })
  );
  render(<NetworkingPractice />);
  expect(screen.getByText('3/5')).toBeInTheDocument();
  expect(screen.getByText('4/5')).toBeInTheDocument();
  expect(screen.getAllByText('Not rated')).toHaveLength(2);
});

it('shows old saved sessions with all four ratings and their average', () => {
  localStorage.setItem(
    'networking-practice-sessions',
    JSON.stringify([
      {
        id: 's1',
        versionId: 'v1',
        scenarioId: 'career-fair',
        scenarioTitle: 'Career Fair',
        attempts: [
          {
            id: 'a1',
            label: 'Rep',
            script: 'Old intro',
            durationSeconds: 40,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        ratings: { confidence: 3, clarity: 4, rapport: 3, authenticity: 4 },
        reflection: { humanNote: '', nervesNote: '', nextFocus: '', wins: '' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])
  );
  render(<NetworkingPractice />);
  expect(screen.getByText(/Old intro/)).toBeInTheDocument();
  expect(screen.getByText(/3\.5/)).toBeInTheDocument();
});
