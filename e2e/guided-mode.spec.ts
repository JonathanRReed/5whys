import { expect, test } from '@playwright/test';
import { useStudentProfile, waitForHydration } from './helpers';

test('guided mode walks a first-timer through the Resume Game by watching what they do', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);

  // Offered, not forced.
  await expect(page.getByText(/New to this\?/)).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Guide' })).toHaveCount(0);

  await page.getByRole('radio', { name: 'Guided' }).check();
  const coach = page.getByRole('complementary', { name: 'Guide' });
  await expect(coach).toContainText('Step 1 of 5');
  await expect(page.getByLabel('Paste resume text')).toHaveAttribute('data-guide-active', '');

  // The example shortcut does the step, and the coach notices on its own.
  await coach.getByRole('button', { name: 'Use a sample resume' }).click();
  await expect(coach).toContainText('Step 2 of 5');
  await expect(coach).toContainText('Score it');

  await page.getByRole('button', { name: 'Analyze resume' }).click();
  await expect(coach).toContainText('Step 3 of 5');
  await expect(page.locator('[data-bullet-list]')).toHaveAttribute('data-guide-active', '');

  // Some steps only the visitor can confirm.
  await page.locator('[data-bullet-list] button').first().click();
  await coach.getByRole('button', { name: 'I did this' }).click();
  await expect(coach).toContainText('Step 4 of 5');

  // Progress survives a reload, and the guide can be ended.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('complementary', { name: 'Guide' })).toContainText('Step 4 of 5');
  await page.getByRole('button', { name: 'End guide' }).click();
  await expect(page.getByRole('complementary', { name: 'Guide' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'On my own' })).toBeChecked();
});
