import { expect, test } from '@playwright/test';
import { chooseOption, rate, readStorage, useStudentProfile, waitForHydration } from './helpers';

test('a rep is drafted, timed, rated, and saved, and the draft survives a reload', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/networking-practice/');
  await waitForHydration(page);

  await chooseOption(page, '#scenario', 'Career Fair: Long Line Behind You');
  await page
    .locator('#intro-draft')
    .fill(
      'Hi, I am Jordan, a sophomore in communications. I run the radio station Instagram. What does a first-year marketing hire actually do here?'
    );

  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Pause' }).click();

  // Nothing is rated until the visitor rates it: no average, no next step.
  await expect(page.getByText('Not rated', { exact: true })).toHaveCount(4);
  await expect(page.getByText(/\d(\.\d)?\s*\/\s*5/)).toHaveCount(0);

  // Saving before rating is refused with a reason that names what is missing.
  await page.getByRole('button', { name: 'Save this rep' }).click();
  await expect(page.getByText(/Rate the rep first/)).toBeVisible();

  await rate(page, 'Confidence', 4);
  await page.getByRole('button', { name: 'Save this rep' }).click();
  await expect(
    page.getByText('Rate the rep first. Clarity, Rapport and Authenticity are not rated yet.')
  ).toBeVisible();
  await expect(page.getByText('Next step', { exact: true })).toHaveCount(0);

  await rate(page, 'Clarity', 3);
  await rate(page, 'Rapport', 4);
  await rate(page, 'Authenticity', 5);
  await expect(page.getByText('4.0/5')).toBeVisible();
  await expect(page.getByText('Next step', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save this rep' }).click();
  await expect(page.getByText(/Rep saved to your local history/)).toBeVisible();

  const sessions = JSON.parse((await readStorage(page, 'networking-practice-sessions')) ?? '[]');
  expect(sessions).toHaveLength(1);
  expect(sessions[0].attempts[0].script).toContain('I am Jordan');
  expect(sessions[0].ratings).toEqual({ confidence: 4, clarity: 3, rapport: 4, authenticity: 5 });

  await page.reload();
  await waitForHydration(page);
  await expect(page.locator('#intro-draft')).toHaveValue(/I am Jordan/);
});
