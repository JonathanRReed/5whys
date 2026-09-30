import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '../src/lib/utils';

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Not started" when iso is null', () => {
    expect(formatDate(null)).toBe('Not started');
  });

  it('returns "Not started" when iso is empty string', () => {
    expect(formatDate('')).toBe('Not started');
  });

  it('returns "Today" for dates on the same day', () => {
    const todayIso = new Date('2025-05-15T08:00:00Z').toISOString();
    expect(formatDate(todayIso)).toBe('Today');
  });

  it('returns "Yesterday" for dates 1 day ago', () => {
    const yesterdayIso = new Date('2025-05-14T12:00:00Z').toISOString();
    expect(formatDate(yesterdayIso)).toBe('Yesterday');
  });

  it('returns "X days ago" for dates between 2 and 6 days ago', () => {
    const threeDaysAgoIso = new Date('2025-05-12T12:00:00Z').toISOString();
    expect(formatDate(threeDaysAgoIso)).toBe('3 days ago');

    const sixDaysAgoIso = new Date('2025-05-09T12:00:00Z').toISOString();
    expect(formatDate(sixDaysAgoIso)).toBe('6 days ago');
  });

  it('returns formatted date string for dates 7 or more days ago', () => {
    const oldDateIso = new Date('2025-05-01T12:00:00Z').toISOString();
    expect(formatDate(oldDateIso)).toBe('May 1');
  });
});
