import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const { listeners, applyUpdate } = vi.hoisted(() => ({
  listeners: [] as ((status: string) => void)[],
  applyUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/lib/offline', () => ({
  subscribe: (listener: (status: string) => void) => {
    listeners.push(listener);
    listener('ready');
    return () => undefined;
  },
  applyUpdate,
}));

import UpdateNotice from '../src/components/UpdateNotice';

afterEach(() => {
  listeners.length = 0;
  applyUpdate.mockClear();
});

it('stays silent until an update is waiting, then never reloads on its own', async () => {
  render(<UpdateNotice />);
  await vi.waitFor(() => expect(listeners.length).toBe(1));
  expect(screen.queryByRole('status')).toBeNull();

  fireEvent.click(document.body);
  listeners[0]('update-waiting');
  expect(await screen.findByRole('status')).toHaveTextContent(
    'A new version of the studio is ready'
  );
  expect(applyUpdate).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
  await vi.waitFor(() => expect(applyUpdate).toHaveBeenCalledTimes(1));
});

it('can be put off', async () => {
  render(<UpdateNotice />);
  await vi.waitFor(() => expect(listeners.length).toBe(1));
  listeners[0]('update-waiting');
  fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
  expect(screen.queryByRole('status')).toBeNull();
});
