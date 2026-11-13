import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Career5Whys from '../src/components/Career5Whys';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
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

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

it('opening the tool on a fresh profile writes nothing', async () => {
  render(<Career5Whys />);
  await settle();
  expect(Object.keys(localStorage)).toEqual([]);
});

it('opening the tool leaves a saved session, history, and limit exactly as stored', async () => {
  const history = JSON.stringify(
    Array.from({ length: 20 }, (_, index) => ({
      id: `snap-${index}`,
      timestamp: '2026-01-01T00:00:00.000Z',
      track: 'career',
      topic: `Topic ${index}`,
      responses: ['a', 'b', 'c', 'd', 'e'],
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 3,
    }))
  );
  const session = JSON.stringify({
    id: 'session-1',
    track: 'interest',
    topic: 'Biology',
    responses: ['I like labs', '', '', '', ''],
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  localStorage.setItem('career-why-history', history);
  localStorage.setItem('career-why-history-limit', '24');
  localStorage.setItem('career-why-session-v2', session);

  render(<Career5Whys />);
  await settle();

  // The saved limit is 24, so 20 snapshots fit; the default of 12 must not trim them on load.
  expect(localStorage.getItem('career-why-history')).toBe(history);
  expect(localStorage.getItem('career-why-history-limit')).toBe('24');
  expect(localStorage.getItem('career-why-session-v2')).toBe(session);
});
