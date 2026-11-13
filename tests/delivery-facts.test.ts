import { describe, expect, test } from 'vitest';
import { deliveryFacts } from '../src/lib/speech/facts';

const facts = (text: string, durationSeconds = 60) => deliveryFacts({ text, durationSeconds });
describe('delivery facts', () => {
  test('counts words, contractions, Unicode and numbers without ratings', () => {
    const result = facts("I'm writing café notes, 12 today.");
    expect(result.wordCount).toBe(6);
    expect(result.wordsPerMinute).toBe(6);
    expect(Object.keys(result).sort()).toEqual([
      'durationSeconds',
      'fillers',
      'pauses',
      'wordCount',
      'wordsPerMinute',
    ]);
  });
  test.each([0, 4.999, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not calculate pace for invalid or short duration %s',
    (duration) => {
      expect(facts('hello there', duration).wordsPerMinute).toBeNull();
    }
  );
  test('calculates pace at five seconds and never divides empty text', () => {
    expect(facts('one two', 5).wordsPerMinute).toBe(24);
    expect(facts('... ', 60).wordsPerMinute).toBeNull();
  });
  test('matches whole words and phrases case-insensitively, with separate context-dependent labels', () => {
    const result = facts(
      'Um, uh. ER ah hmm. Human umbrella. You know, you know. Sort of. Kind of. I mean it.'
    );
    expect(result.fillers.map((f) => f.count)).toEqual([1, 1, 1, 1, 1, 2, 1, 1, 1]);
    expect(result.fillers.slice(0, 5).every((f) => !f.contextDependent)).toBe(true);
    expect(result.fillers.slice(5).every((f) => f.contextDependent)).toBe(true);
    expect(result.fillers[0].occurrences).toEqual([{ wordIndex: 0, timestamp: null }]);
  });
  test('accepts a configurable list, removes duplicate phrases and does not reinterpret regex syntax', () => {
    expect(
      deliveryFacts({
        text: 'Well well, sort of good.',
        durationSeconds: 30,
        fillers: ['well', 'WELL', '', { phrase: 'sort of', contextDependent: true }],
      }).fillers.map((f) => [f.phrase, f.count])
    ).toEqual([
      ['well', 2],
      ['sort of', 1],
    ]);
  });
  test('locates fillers with segment boundaries and leaves mismatched timestamps unknown', () => {
    const input = {
      text: 'Um hello you know',
      durationSeconds: 15,
      segments: [
        { text: 'Um hello', start: 1, end: 3 },
        { text: 'you know', start: 6, end: 8 },
      ],
    };
    const result = deliveryFacts(input);
    expect(result.fillers[0].occurrences[0].timestamp).toEqual({ start: 1, end: 3 });
    expect(result.fillers[5].occurrences[0].timestamp).toEqual({ start: 6, end: 8 });
    expect(
      deliveryFacts({ ...input, text: 'Um edited' }).fillers[0].occurrences[0].timestamp
    ).toBeNull();
    expect(result.pauses).toEqual([{ start: 3, end: 6, durationSeconds: 3 }]);
  });
  test('counts only pauses strictly longer than the threshold, excluding leading, trailing, overlapping and invalid segments', () => {
    const result = deliveryFacts({
      text: 'a b c d',
      durationSeconds: 30,
      segments: [
        { text: 'a', start: 5, end: 8 },
        { text: 'b', start: 10, end: 12 },
        { text: 'overlap', start: 11, end: 11.5 },
        { text: 'c', start: 15, end: 17 },
        { text: 'd', start: 22, end: 24 },
        { text: 'invalid', start: 26, end: 40 },
      ],
      pauseThresholdSeconds: 2,
    });
    expect(result.pauses).toEqual([
      { start: 12, end: 15, durationSeconds: 3 },
      { start: 17, end: 22, durationSeconds: 5 },
    ]);
  });
  test('uses a configurable threshold and ignores empty segments', () => {
    expect(
      deliveryFacts({
        text: 'a b',
        durationSeconds: 10,
        segments: [
          { text: 'a', start: 1, end: 2 },
          { text: '', start: 3, end: 4 },
          { text: 'b', start: 5, end: 6 },
        ],
        pauseThresholdSeconds: 4,
      }).pauses
    ).toEqual([]);
  });
});
