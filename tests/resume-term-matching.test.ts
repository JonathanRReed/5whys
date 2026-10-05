import { describe, expect, it } from 'vitest';
import { HARD_SKILLS, matchesTerm, SOFT_SKILLS } from '../src/lib/resume-game/constants';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('substring prefilter matching parity', () => {
  it('preserves legacy case, punctuation, and boundary behavior for every skill entry', () => {
    for (const term of [...HARD_SKILLS, ...SOFT_SKILLS]) {
      const legacy = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:$|[^a-z0-9])`, 'i');
      const examples = [
        term,
        term.toUpperCase(),
        `Built a ${term} project`,
        `(${term}),`,
        `${term}-based`,
        `x${term}x`,
        `1${term}2`,
        '',
      ];
      for (const text of examples) {
        const expected = legacy.test(text);
        expect(matchesTerm(text, term), `${term} in ${JSON.stringify(text)}`).toBe(expected);
        expect(matchesTerm(text, term, text.toLowerCase(), term.toLowerCase())).toBe(expected);
      }
    }
  });

  it.each([
    ['Built C++ and C# projects with Next.js.', 'c++', true],
    ['Built C++ and C# projects with Next.js.', 'c#', true],
    ['Built C++ and C# projects with Next.js.', 'next.js', true],
    ['Built nextXjs tools.', 'next.js', false],
    ['Scored a goal.', 'go', false],
    ['Used Go, R, and SQL.', 'go', true],
    ['Used Go, R, and SQL.', 'r', true],
    ['Wrote reports.', 'r', false],
    ['Used SQL-based reporting.', 'sql', true],
    ['Used NoSQL storage.', 'sql', false],
    ['Kept (design) notes.', '(design)', true],
    ['Kept design notes.', '(design)', false],
    ['Communicated clearly.', 'communication', false],
    ['Strong COMMUNICATION skills.', 'communication', true],
  ])('matches %s against %s as %s', (text, term, expected) => {
    expect(matchesTerm(text, term)).toBe(expected);
  });
});
