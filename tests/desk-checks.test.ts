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
  // A letter this short is not ticked: it reads as a note.
  expect(byId['one-page'].passed).toBe(false);
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

it('assembles the full letter with a greeting and a sign-off', async () => {
  const { fullLetter, greeting } = await import('../src/lib/desk-checks');
  expect(greeting('')).toBe('Dear Hiring Team,');
  expect(greeting('Marketing Team')).toBe('Dear Marketing Team,');
  expect(greeting('Dear Ms. Rivera,')).toBe('Dear Ms. Rivera,');
  expect(fullLetter(letter({}))).toBe('');
  expect(
    fullLetter(
      letter({ hook: 'I grew a club.', closingAsk: 'Could we talk?', sender: 'Sam Alvarez' })
    )
  ).toBe('Dear Hiring Team,\n\nI grew a club.\n\nCould we talk?\n\nSincerely,\nSam Alvarez');
});

it('accepts the role named without the season or extras from the posting title', async () => {
  const { coreTitle } = await import('../src/lib/desk-checks');
  expect(coreTitle('Operations Intern, Summer 2027')).toBe('Operations Intern');
  expect(coreTitle('Data Analyst (Remote)')).toBe('Data Analyst');
  expect(coreTitle('Program Assistant - Night shift')).toBe('Program Assistant');
  const checks = runSendChecks({
    letter: letter({
      hook: 'I want the operations intern position at Harbor Freight Logistics.',
    }),
    title: 'Operations Intern, Summer 2027',
    company: 'Harbor Freight Logistics',
    requirements: [],
  });
  const names = checks.find((check) => check.id === 'names');
  expect(names?.passed).toBe(true);
  expect(names?.detail).toBe('Mentions Operations Intern and Harbor Freight Logistics.');
});

it('fails a letter that still has template placeholders in it', () => {
  const checks = runSendChecks({
    letter: letter({ hook: 'I ran a club.', whyYou: 'Attention to detail: [your proof]' }),
    title: 'Intern',
    company: 'Acme',
    requirements: [],
  });
  const check = checks.find((c) => c.id === 'no-placeholders');
  expect(check?.passed).toBe(false);
  expect(check?.detail).toBe('Still to replace: [your proof].');
});

it('accepts a company named by its distinctive first word', () => {
  const checks = runSendChecks({
    letter: letter({
      hook: 'As an operations coordinator at Northgate I would keep trucks moving.',
    }),
    title: 'Operations Coordinator',
    company: 'Northgate Logistics Partners',
    requirements: [],
  });
  expect(checks.find((check) => check.id === 'names')?.passed).toBe(true);
  const generic = runSendChecks({
    letter: letter({ hook: 'As a program assistant at the university I would help.' }),
    title: 'Program Assistant',
    company: 'University of Somewhere',
    requirements: [],
  });
  expect(generic.find((check) => check.id === 'names')?.passed).toBe(false);
});

it('does not count thanks as an ask, and catches the contracted generic opener', async () => {
  const { asks } = await import('../src/lib/desk-checks');
  expect(asks('I would like to thank you for your time.')).toBe(false);
  expect(asks('Thank you for considering my application.')).toBe(false);
  expect(asks('Thank you for your time. Could we talk for 15 minutes next week?')).toBe(true);
  expect(asks("I'd like to talk about how I could help with scheduling.")).toBe(true);
  expect(isGenericOpener("I'm writing to apply for the internship.")).toBe(true);
});
