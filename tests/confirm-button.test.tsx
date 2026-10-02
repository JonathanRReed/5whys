import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConfirmButton from '../src/components/shared/ConfirmButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('executes only on the second press and disarms afterward', () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmButton confirmLabel="Delete snapshot?" onConfirm={onConfirm}>
      Delete
    </ConfirmButton>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete snapshot?' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
});

it.each(['Escape', 'blur', 'timeout'])('cancels armed deletion on %s', (cancel) => {
  vi.useFakeTimers();
  const onConfirm = vi.fn();
  render(
    <ConfirmButton confirmLabel="Delete snapshot?" onConfirm={onConfirm}>
      Delete
    </ConfirmButton>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const armed = screen.getByRole('button', { name: 'Delete snapshot?' });
  if (cancel === 'Escape') fireEvent.keyDown(armed, { key: 'Escape' });
  else if (cancel === 'blur') fireEvent.blur(armed);
  else act(() => vi.advanceTimersByTime(4001));
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Delete snapshot?' })).toBeVisible();
});
