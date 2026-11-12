import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import UpdateNotice from '../src/components/UpdateNotice';
import {
  dismissFeatureFailure,
  FAILED_FEATURE_MESSAGE,
  loadFeature,
  MISSING_FEATURE_MESSAGE,
  runFeature,
} from '../src/lib/lazy-feature';

afterEach(() => {
  cleanup();
  dismissFeatureFailure();
  vi.restoreAllMocks();
});

test('a missing offline module gives a readable alert and resets the action', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  render(<UpdateNotice />);
  const settled = vi.fn();
  await act(async () => {
    await runFeature(
      () => loadFeature(Promise.reject(new TypeError('module fetch failed'))),
      settled
    );
  });
  expect(screen.getByRole('alert')).toHaveTextContent(MISSING_FEATURE_MESSAGE);
  expect(settled).toHaveBeenCalledOnce();
  await act(async () => {
    screen.getByRole('button', { name: 'Dismiss' }).click();
  });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('an online chunk failure asks for a retry without claiming it was never downloaded', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await expect(loadFeature(Promise.reject(new TypeError('module fetch failed')))).rejects.toThrow(
    FAILED_FEATURE_MESSAGE
  );
});

test('a loaded feature returns its module unchanged', async () => {
  const module = { run: () => 'ready' };
  expect(await loadFeature(Promise.resolve(module))).toBe(module);
});
