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
});

it('deletes an intro version in-place with ConfirmButton without window.confirm', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  render(<NetworkingPractice />);

  // Open the customize disclosure
  fireEvent.click(screen.getByRole('button', { name: /Customize this scenario/i }));

  // Create another version so "Delete this intro" is rendered
  fireEvent.click(screen.getByRole('button', { name: 'Start another intro' }));

  const deleteButton = screen.getByRole('button', { name: 'Delete this intro' });
  expect(deleteButton).toBeInTheDocument();

  // First click arms the button
  fireEvent.click(deleteButton);
  expect(confirmSpy).not.toHaveBeenCalled();

  const armedButton = screen.getByRole('button', { name: 'Delete this intro?' });
  expect(armedButton).toBeInTheDocument();

  // Second click executes the deletion
  fireEvent.click(armedButton);
  expect(confirmSpy).not.toHaveBeenCalled();

  confirmSpy.mockRestore();
});
