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

it('preserves achievements in a resume with mixed bullet markers', () => {
  const parsed = detectResumeStructure(
    'Built a reporting tool for a research team.\nLed weekly training for new volunteers.\n• Automated grant reports to save 6 hours weekly.'
  );
  expect(parsed.bullets).toEqual([
    'Built a reporting tool for a research team.',
    'Led weekly training for new volunteers.',
    'Automated grant reports to save 6 hours weekly.',
  ]);
});

it('keeps a capitalized technical continuation after an unfinished phrase', () => {
  expect(
    detectResumeStructure(
      '• Built a reporting workflow in\nPython to save the team 6 hours per week.'
    ).bullets
  ).toEqual(['Built a reporting workflow in Python to save the team 6 hours per week.']);
});
