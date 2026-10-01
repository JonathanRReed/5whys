import { expect, it } from 'vitest';
import { detectResumeStructure } from '../src/lib/resume-game/structure';

it('keeps wrapped result lines with their marked achievement', () => {
  const result = detectResumeStructure(
    'EXPERIENCE\n• Automated weekly reporting in Python\n  to save the team 6 hours per week.\n• Built accessible workshop materials\n  for students using screen readers.'
  );
  expect(result.bullets).toEqual([
    'Automated weekly reporting in Python to save the team 6 hours per week.',
    'Built accessible workshop materials for students using screen readers.',
  ]);
});

it('does not append a new section or job header to a wrapped bullet', () => {
  const result = detectResumeStructure(
    '• Built accessible workshop materials\n  for students using screen readers.\nEDUCATION\nState University, 2026\n• Led weekly tutoring sessions'
  );
  expect(result.bullets).toEqual([
    'Built accessible workshop materials for students using screen readers.',
    'Led weekly tutoring sessions',
  ]);
});

it('recognizes a single marked bullet and its wrapped continuation', () => {
  const result = detectResumeStructure(
    'Jordan Example\nEXPERIENCE\n• Built a reporting workflow\n  that removed duplicate entries before monthly review.'
  );
  expect(result.usedGlyphs).toBe(true);
  expect(result.bullets).toEqual([
    'Built a reporting workflow that removed duplicate entries before monthly review.',
  ]);
});
