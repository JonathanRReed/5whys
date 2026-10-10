import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { normalizeLine } from '../src/lib/resume-game/text';

describe('normalizeLine alphanumeric scan', () => {
  it.each(['', 'A', 'A7'])(
    'rejects punctuation padding with %j ASCII characters promptly',
    (text) => {
      const line = `${'!'.repeat(50_000)}${text}`;
      const start = performance.now();
      expect(normalizeLine(line)).toBe('');
      // A generous ceiling catches quadratic rescanning without asserting microbenchmarks.
      expect(performance.now() - start).toBeLessThan(1_000);
    }
  );

  it('accepts three ASCII characters separated by punctuation', () => {
    const line = `${'!'.repeat(50_000)}A!7?z`;
    expect(normalizeLine(line)).toBe(line);
  });

  it('preserves the ASCII-only threshold after entity decoding', () => {
    expect(normalizeLine('é界🙂A7')).toBe('');
    expect(normalizeLine('é界🙂A7z')).toBe('é界🙂A7z');
    expect(normalizeLine('&amp;A&nbsp;7&lt;z')).toBe('&A 7<z');
    expect(normalizeLine('&amp;&lt;&gt;')).toBe('');
  });
});
