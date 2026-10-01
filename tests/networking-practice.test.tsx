import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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


it('uses customized audience, setting and goal in the visible practice plan after reload', () => {
  const view = render(<NetworkingPractice />);
  fireEvent.click(screen.getByRole('button', { name: /Customize this scenario/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Who you are speaking with' }), { target: { value: 'An engineer at a campus meetup' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Where the networking conversation happens' }), { target: { value: 'At the library after a workshop' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'What you want to ask or share' }), { target: { value: 'Ask which skill helps a new teammate most' } });
  expect(screen.getByText('An engineer at a campus meetup', { selector: 'dd' })).toBeInTheDocument();
  expect(screen.getAllByText('At the library after a workshop', { selector: 'dd, p' }).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Ask which skill helps a new teammate most', { selector: 'span, p' }).length).toBeGreaterThan(0);
  expect(screen.getByText('Your conversation goal')).toBeInTheDocument();
  view.unmount();
  render(<NetworkingPractice />);
  expect(screen.getByText('An engineer at a campus meetup', { selector: 'dd' })).toBeInTheDocument();
  expect(screen.getByText('Your conversation goal')).toBeInTheDocument();
});
