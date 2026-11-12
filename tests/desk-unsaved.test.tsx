import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesk } from '../src/components/application-desk/useDesk';
import { APPLICATION_DESK_KEY, getDesk, updateLetter } from '../src/lib/application-desk';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the desk when the browser will not save', () => {
  it('keeps each change in the page, and says so', () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === APPLICATION_DESK_KEY) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    const { result } = renderHook(() => useDesk());
    act(() => result.current.changeDesks((data) => updateLetter(data, 'a', { hook: 'My hook' })));
    act(() => result.current.changeDesks((data) => updateLetter(data, 'a', { whyYou: 'Why me' })));
    const letter = getDesk(result.current.desks, 'a').letter;
    expect(letter.hook).toBe('My hook');
    expect(letter.whyYou).toBe('Why me');
    expect(result.current.unsaved).toBe(true);
  });

  it('builds on the store again once saving works', () => {
    const { result } = renderHook(() => useDesk());
    act(() => result.current.changeDesks((data) => updateLetter(data, 'a', { hook: 'Saved' })));
    expect(result.current.unsaved).toBe(false);
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toContain('Saved');
  });
});
