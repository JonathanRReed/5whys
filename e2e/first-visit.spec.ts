import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * A first-time visitor is told each rule before they trip over it, and
 * nothing they write is dropped without a word.
 */

test('Five Whys states the three-word rule, counts down, and unlocks the next question', async ({
  page,
}) => {
  await page.goto('/career/');
  await waitForHydration(page);
  await expect(
    page.getByText('3 words or more counts as an answer and opens depth 2.')
  ).toBeVisible();
  await expect(
    page.getByText('Answer depth 1 first. This question is built from it.')
  ).toBeVisible();
  const first = page.getByLabel('Depth 1 response');
  await first.fill('test this');
  await expect(
    page.getByText('Add 1 more word. 3 words or more counts as an answer.')
  ).toBeVisible();
  await expect(page.getByLabel('Depth 2 response')).toBeDisabled();
  await first.fill('I like helping people');
  await expect(page.getByLabel('Depth 2 response')).toBeEnabled();
  await expect(page.getByText('Answered', { exact: true })).toBeVisible();
  // A status pill stays on one line.
  const pill = page.getByText('Your turn', { exact: true });
  const box = await pill.boundingBox();
  expect(box?.height ?? 99).toBeLessThan(40);
});

test('Pay keeps hours and notes written before the rate is known', async ({ page }) => {
  await page.goto('/pay/');
  await waitForHydration(page);
  await page.getByLabel('Hours a week').fill('40');
  await page.getByLabel('Weeks a year').fill('52');
  await page.getByLabel('Notes').fill('Ask about Saturday shifts');
  await page.getByRole('button', { name: 'Save it as an offer' }).click();
  await page.getByLabel('Role', { exact: true }).fill('Front desk');
  await page.getByRole('button', { name: 'Add it' }).click();
  await expect(page.getByLabel('Hours a week')).toHaveValue('40');
  await expect(page.getByLabel('Notes')).toHaveValue('Ask about Saturday shifts');
  // The hint names the one thing still missing.
  await page.getByLabel('Base pay').fill('25');
  await expect(page.getByTestId('pay-missing-hint')).toContainText('how often this is paid');
});

test('the interview page offers both actions before the advice', async ({ page }) => {
  await page.goto('/interview-glow-up/');
  const start = page.getByTestId('glowup-start');
  await expect(start.getByRole('link', { name: 'Prepare for a posting' })).toBeVisible();
  await expect(start.getByRole('link', { name: 'Rehearse questions' })).toHaveAttribute(
    'href',
    '/interview-glow-up/rehearse/'
  );
  const box = await start.boundingBox();
  expect(box?.y ?? 9999).toBeLessThan(1400);
});

test('an empty story library leads to the first story', async ({ page }) => {
  await page.goto('/interview-glow-up/workspace/?tab=vault');
  await waitForHydration(page);
  await page.getByRole('tab', { name: /Library/ }).click();
  await page.getByRole('button', { name: 'Write your first story' }).click();
  await expect(page.locator('#story-play')).toBeVisible();
  await expect(page.getByText(/3 words or more counts as an answer/).first()).toBeVisible();
});
