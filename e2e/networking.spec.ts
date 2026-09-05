import { expect, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

test('a rep is drafted, timed, rated, and saved, and the draft survives a reload', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/networking-practice/');
  await waitForHydration(page);

  await page.locator('#scenario').selectOption('career-fair');
  await page
    .locator('#intro-draft')
    .fill(
      'Hi, I am Jordan, a sophomore in communications. I run the radio station Instagram. What does a first-year marketing hire actually do here?'
    );

  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Pause' }).click();

  // Saving before rating is refused with a reason.
  await page.getByRole('button', { name: 'Save this rep' }).click();
  await expect(page.getByText(/Rate the rep first/)).toBeVisible();

  await page.locator('input[type="range"]').first().fill('4');
  await page.getByRole('button', { name: 'Save this rep' }).click();
  await expect(page.getByText(/Rep saved to your local history/)).toBeVisible();

  const sessions = JSON.parse((await readStorage(page, 'networking-practice-sessions')) ?? '[]');
  expect(sessions).toHaveLength(1);
  expect(sessions[0].attempts[0].script).toContain('I am Jordan');

  await page.reload();
  await waitForHydration(page);
  await expect(page.locator('#intro-draft')).toHaveValue(/I am Jordan/);
});
