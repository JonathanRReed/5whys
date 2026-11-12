import { expect, it } from 'vitest';
import { createEmptyDesk } from '../src/lib/application-desk';
import { isGenericOpener, runSendChecks } from '../src/lib/desk-checks';
import { addRequirement } from '../src/lib/posting';

const letter = (parts: Partial<ReturnType<typeof createEmptyDesk>['letter']>) => ({
  ...createEmptyDesk().letter,
  ...parts,
});

it('flags the opener most letters use and not a specific one', () => {
  expect(isGenericOpener('I am writing to apply for the Marketing Assistant position.')).toBe(true);
  expect(isGenericOpener('Dear Jordan, I am excited to apply for this role.')).toBe(true);
  expect(
    isGenericOpener('Over the last year, I grew my club Instagram into a community of students.')
  ).toBe(false);
});

it('leaves a check undecided until there is something to check', () => {
  const checks = runSendChecks({
    letter: letter({}),
    title: 'Marketing Assistant',
    company: 'Acme',
    requirements: [],
  });
  expect(checks.every((check) => check.passed === null)).toBe(true);
});

it('computes each check from the letter and the confirmed requirements', () => {
  const requirements = addRequirement([], 'Experience with social media scheduling');
  const checks = runSendChecks({
    letter: letter({
      hook: 'I grew my club Instagram and want to do the same as Marketing Assistant at Acme.',
      whyYou: 'I planned social media posts each week.',
      closingAsk: 'Could we talk for 15 minutes next week?',
    }),
    title: 'Marketing Assistant',
    company: 'Acme',
    requirements,
  });
  const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
  expect(byId.names.passed).toBe(true);
  expect(byId['one-page'].passed).toBe(true);
  expect(byId['posting-words'].passed).toBe(true);
  expect(byId['posting-words'].detail).toBe('Touches 1 of 1 confirmed requirements.');
  expect(byId['ends-with-ask'].passed).toBe(true);
});

it('says which name is missing and when the closing asks for nothing', () => {
  const checks = runSendChecks({
    letter: letter({ hook: 'I would be a great Marketing Assistant.', closingAsk: 'Thank you.' }),
    title: 'Marketing Assistant',
    company: 'Acme',
    requirements: [],
  });
  const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
  expect(byId.names.passed).toBe(false);
  expect(byId.names.detail).toBe('Does not mention Acme.');
  expect(byId['ends-with-ask'].passed).toBe(false);
});
