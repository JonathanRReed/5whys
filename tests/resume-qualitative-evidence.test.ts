import { expect, it } from 'vitest';
import { createBulletRecord, generateBulletSuggestions, scoreBullet } from '../src/lib/resume-game';

it('recognizes adoption as qualitative evidence without demanding an invented number', () => {
  const text = 'Designed a workshop syllabus adopted by the volunteer teaching team.';
  const suggestions = generateBulletSuggestions(createBulletRecord(text, 0));
  expect(suggestions.map((suggestion) => suggestion.type)).not.toContain('missing-number');
  expect(suggestions.map((suggestion) => suggestion.type)).not.toContain('missing-impact');
  expect(scoreBullet(text)).toBeGreaterThanOrEqual(70);
});

it('recognizes a concrete removed obstacle as a result', () => {
  const text = 'Built a validation workflow that eliminated duplicate records before publication.';
  expect(
    generateBulletSuggestions(createBulletRecord(text, 0)).map((item) => item.type)
  ).not.toContain('missing-impact');
});

it('still asks vague duties for evidence', () => {
  const suggestions = generateBulletSuggestions(
    createBulletRecord('Helped with team activities', 0)
  );
  expect(suggestions.map((suggestion) => suggestion.type)).toContain('missing-number');
  expect(suggestions.map((suggestion) => suggestion.type)).toContain('missing-impact');
});

it.each([
  'Built a spreadsheet template not used by the research team.',
  'Designed a workshop syllabus never adopted by the teaching team.',
])('does not reward a negated qualitative outcome: %s', (text) => {
  expect(scoreBullet(text)).toBeLessThan(70);
  expect(generateBulletSuggestions(createBulletRecord(text, 0)).length).toBeGreaterThan(0);
});
