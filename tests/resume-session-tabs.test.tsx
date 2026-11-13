import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SESSION_STORAGE_KEY, useResumeSession } from '../src/lib/resume-game/session';

const jordan = { resumeText: 'Jordan Lee\nEXPERIENCE\n• Stocked shelves at Acme.', bullets: [] };
const avery = {
  resumeText: 'Avery Chen\nEXPERIENCE\n• Rebuilt the campus library sign-up form.',
  bullets: [],
};

const stored = () => JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(jordan));
});
afterEach(() => localStorage.clear());

// Finding 5: tab B loaded Jordan, tab A then saved Avery. An edit in B must
// not write the old Jordan resume back over Avery.
it('does not overwrite newer work another tab saved after this tab loaded', () => {
  const { result } = renderHook(() => useResumeSession());
  expect(result.current.session.resumeText).toBe(jordan.resumeText);

  // Tab A saves; this tab missed the storage event.
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(avery));

  act(() => {
    result.current.setSession((prev) => ({ ...prev, resumeText: `${prev.resumeText} edited` }));
  });

  expect(stored().resumeText).toBe(avery.resumeText);
  expect(result.current.session.resumeText).toBe(avery.resumeText);
  expect(result.current.storageNotice).toMatch(/changed in another tab/);
});

it('follows a save from another tab, then saves the next edit on top of it', () => {
  const { result } = renderHook(() => useResumeSession());
  act(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(avery));
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_STORAGE_KEY }));
  });
  expect(result.current.session.resumeText).toBe(avery.resumeText);

  act(() => {
    result.current.setSession((prev) => ({ ...prev, resumeText: `${prev.resumeText} edited` }));
  });
  expect(stored().resumeText).toBe(`${avery.resumeText} edited`);
  expect(result.current.storageNotice).toBeNull();
});

it('keeps saving normally when no other tab wrote', () => {
  const { result } = renderHook(() => useResumeSession());
  act(() => {
    result.current.setSession((prev) => ({ ...prev, resumeText: 'first' }));
  });
  act(() => {
    result.current.setSession((prev) => ({ ...prev, resumeText: 'second' }));
  });
  expect(stored().resumeText).toBe('second');
  expect(result.current.storageNotice).toBeNull();
});
