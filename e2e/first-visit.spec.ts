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

test('the career review starts a guided path that hands off from tool to tool', async ({
  page,
}) => {
  await page.goto('/start/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await expect(page.getByRole('heading', { name: /biggest challenge/ })).toBeVisible();
  // The review ignores a tap that lands right after the question changes.
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'I have an offer to answer' }).click();

  const card = page.getByTestId('path-card');
  await expect(card).toContainText('Answer an offer');
  await expect(card).toContainText('2 stops');
  await page.getByRole('link', { name: /Start now/ }).click();
  await expect(page).toHaveURL(/\/pay\/\?guide=1$/);
  await waitForHydration(page);
  await expect(page.locator('[data-guide-bar]')).toContainText('Stop 1 of 2 on your path.');

  const coach = page.locator('aside[aria-label="Guide"]');
  await page.getByLabel('Base pay').fill('18');
  await page.getByLabel('Paid').selectOption('hour');
  await page.getByLabel('Hours a week').fill('20');
  await page.getByLabel('Weeks a year').fill('10');
  await expect(coach).toContainText('Guide finished');
  // The closing task is offered, and the way onward is the next stop.
  await expect(coach.locator('[data-guide-challenge="open"]').first()).toContainText(
    'Add a second offer and compare them'
  );
  const next = coach.getByRole('link', { name: 'Next stop: Check it against what you want' });
  await expect(next.first()).toHaveAttribute('href', '/career/?guide=1');
  await next.first().click();
  await waitForHydration(page);
  await expect(page.locator('[data-guide-bar]')).toContainText('Stop 2 of 2 on your path.');
  await expect(coach).toContainText('Step 1 of 7');

  // The review remembers how far along the path is.
  await page.goto('/start/');
  await waitForHydration(page);
  await expect(page.getByTestId('path-card')).toContainText('1 of 2 stops done');
});
