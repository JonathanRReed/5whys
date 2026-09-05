import { expect, test } from '@playwright/test';
import { readStorage, waitForHydration } from './helpers';

test('the career review recommends a tool and saves the profile', async ({ page }) => {
  await page.goto('/start/');
  await waitForHydration(page);

  // The first step is server-rendered: it is in the DOM before hydration.
  await expect(page.getByRole('heading', { name: 'Where are you in your career?' })).toBeVisible();

  await page.getByRole('button', { name: 'Student' }).click();
  await page.getByRole('button', { name: 'Unclear direction' }).click();

  await expect(page.getByRole('heading', { name: 'Here is your starting point' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start now/ })).toHaveAttribute('href', '/career/');
  await expect(page.getByText('2 min')).toHaveCount(0);

  const profile = JSON.parse((await readStorage(page, 'career-tools-profile')) ?? 'null');
  expect(profile).toMatchObject({ stage: 'student', focus: 'direction' });

  // A returning visitor lands on the recommendation, not the first question.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: /Your starting point/ })).toBeVisible();
});
