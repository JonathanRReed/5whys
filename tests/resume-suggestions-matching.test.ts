import { describe, expect, it } from 'vitest';
import { createBulletRecord } from '../src/lib/resume-game/analysis';
import { BUZZWORDS } from '../src/lib/resume-game/constants';
import { generateBulletSuggestions } from '../src/lib/resume-game/suggestions';

describe('buzzword suggestions', () => {
  it.each(BUZZWORDS)('preserves case and punctuation matching for %s', (word) => {
    for (const written of [word, word.toUpperCase(), `(${word}),`]) {
      const suggestions = generateBulletSuggestions(
        createBulletRecord(`Built a ${written} project`, 0)
      );
      expect(suggestions.find((suggestion) => suggestion.type === 'buzzword')?.message).toContain(
        word
      );
    }
    expect(
      generateBulletSuggestions(createBulletRecord(`Built x${word}x projects`, 0)).some(
        (suggestion) => suggestion.type === 'buzzword'
      )
    ).toBe(false);
  });

  it('preserves list priority when multiple buzzwords match', () => {
    const suggestions = generateBulletSuggestions(
      createBulletRecord('Built a detail-oriented team player project', 0)
    );
    const buzzwords = suggestions.filter((suggestion) => suggestion.type === 'buzzword');
    expect(buzzwords).toHaveLength(1);
    expect(buzzwords[0].message).toContain('team player');
  });
});
