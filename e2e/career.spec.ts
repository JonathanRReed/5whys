import { expect, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

const ANSWERS = [
  'Not the memorization, the part where a tiny mechanism explains a huge visible thing.',
  'Chemistry has mechanisms too but I do not care until it connects to a living thing.',
  'Tenth grade, when a doctor drew the dopamine pathway on a napkin for my grandmother.',
  'I need work that turns confusing scary things into explanations people can act on.',
  'A path fits if I can trace a line from mechanism to a person. Bench work probably does not.',
];

test('a student completes five whys and leaves with a statement and a next step', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);

  // Students start on the Interest Path.
  await expect(page.getByRole('button', { name: /Interest Path/ })).toHaveClass(
    /border-primary\/80/
  );

  await page.locator('#career-topic').fill('I want to work in biology');
  await expect(page.locator('#career-topic-reads-as')).toContainText('biology');

  const answers = page.locator('textarea');
  for (let i = 0; i < ANSWERS.length; i += 1) {
    await answers.nth(i).fill(ANSWERS[i]);
  }

  await expect(page.getByText('You started with "I want to work in biology"')).toBeVisible();
  await expect(page.getByText(/Find one person who turned biology into work/)).toBeVisible();

  await page.getByRole('button', { name: 'Save snapshot' }).click();
  const history = JSON.parse((await readStorage(page, 'career-why-history')) ?? '[]');
  expect(history).toHaveLength(1);
  expect(history[0].version).toBe(3);
  expect(history[0].rootReason).toBe(
    'A path fits if I can trace a line from mechanism to a person.'
  );
  expect(history[0].nextStep).toMatch(/biology/);
});
