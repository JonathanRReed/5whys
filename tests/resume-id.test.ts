import { afterEach, describe, expect, it, vi } from 'vitest';
import { uniqueId } from '../src/lib/resume-game/text';

describe('resume record IDs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the complete UUID with the caller prefix and index', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    vi.stubGlobal('crypto', { randomUUID: () => uuid });
    expect(uniqueId('bullet', 3)).toBe(`bullet-3-${uuid}`);
  });

  it('does not collapse UUIDs that share their first eight characters', () => {
    const first = '123e4567-e89b-42d3-a456-426614174000';
    const second = '123e4567-e89b-42d3-a456-426614174001';
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
    });
    expect(uniqueId('bullet', 0)).toBe(`bullet-0-${first}`);
    expect(uniqueId('bullet', 0)).toBe(`bullet-0-${second}`);
  });

  it('retains the compatibility fallback when crypto is absent', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(uniqueId('stored-bullet', 2)).toBe('stored-bullet-2-i');
  });

  it('retains the compatibility fallback when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(uniqueId('stored-bullet', 2)).toBe('stored-bullet-2-i');
  });
});
