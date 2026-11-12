import { describe, expect, it } from 'vitest';
import { findVaguePhrases, VAGUE_PHRASES } from '../src/lib/posting';

describe('vague phrase dictionary', () => {
  it('has at least 25 entries with unique ids', () => {
    expect(VAGUE_PHRASES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(VAGUE_PHRASES.map((p) => p.id)).size).toBe(VAGUE_PHRASES.length);
  });

  it('maps every phrase to one or two neutral questions in the site voice', () => {
    for (const phrase of VAGUE_PHRASES) {
      expect(phrase.questions.length, phrase.id).toBeGreaterThanOrEqual(1);
      expect(phrase.questions.length, phrase.id).toBeLessThanOrEqual(2);
      expect(phrase.patterns.length, phrase.id).toBeGreaterThan(0);
      for (const question of [...phrase.questions, phrase.label]) {
        expect(question, phrase.id).not.toMatch(/[—!]/);
        expect(question, phrase.id).toMatch(/^[A-Z]/);
      }
      for (const question of phrase.questions) {
        expect(question.endsWith('?'), question).toBe(true);
        // Questions, never claims about what the employer secretly means.
        expect(question, phrase.id).not.toMatch(
          /\b(?:means|code for|red flag|really|actually|secretly|warning)\b/i
        );
        expect(question, phrase.id).not.toMatch(/\d/);
      }
    }
  });

  it('finds phrases with offsets, ignoring case, spacing, and hyphens', () => {
    const text =
      'We move in a Fast-Paced environment and need a self starter. Competitive  salary. Other duties as assigned.';
    const hits = findVaguePhrases(text);
    expect(hits.map((h) => h.id)).toEqual([
      'fast-paced',
      'self-starter',
      'competitive-pay',
      'other-duties',
    ]);
    for (const hit of hits) {
      expect(text.slice(hit.start, hit.end)).toBe(hit.text);
      expect(hit.phrase.id).toBe(hit.id);
    }
    expect(hits[0].text).toBe('Fast-Paced environment');
  });

  it('prefers the longer phrase where two overlap', () => {
    const hits = findVaguePhrases('You will thrive in a fast paced environment.');
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe('fast paced environment');
  });

  it('matches whole words only', () => {
    expect(findVaguePhrases('Our ninjas are cats; doe is a deer.')).toEqual([]);
    expect(findVaguePhrases('Pay: $18 to $22, DOE').map((h) => h.id)).toEqual([
      'depends-on-experience',
    ]);
  });

  it('finds nothing in a plain posting line', () => {
    expect(findVaguePhrases('Write SQL queries to answer questions from route planners')).toEqual(
      []
    );
  });
});
