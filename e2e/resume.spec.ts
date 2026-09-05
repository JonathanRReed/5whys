import { expect, test } from '@playwright/test';
import { useStudentProfile, waitForHydration } from './helpers';

test('a pasted student resume is scored honestly and a rewrite moves the score', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);

  await page.getByRole('button', { name: 'Try sample' }).click();
  await expect(page.getByLabel('Paste resume text')).toHaveValue(/Jordan Lee/);

  await page.getByRole('button', { name: 'Analyze resume' }).click();
  await expect(page.getByText('Scored 4 bullets')).toBeVisible();
  // Name, contact line, headings, and education are left out of scoring.
  await expect(page.getByText(/No bullet markers found/)).toBeVisible();
  await expect(page.getByText(/2 contact, 3 heading, 1 education/)).toBeVisible();
  await expect(page.locator('[data-bullet-list] button')).toHaveCount(4);

  // The first bullet scores as written; no free points before an edit.
  await expect(page.getByText(/Scores \d+\/100 as written/)).toBeVisible();
  const before = Number(
    (await page.getByText(/Scores \d+\/100 as written/).textContent())?.match(/(\d+)\/100/)?.[1]
  );

  await page.locator('input[id$="-verb"]').fill('Wrote');
  await page.locator('input[id$="-quantifier"]').fill('3 posts a week');

  const after = page.getByText(/Started at \d+\/100, now \d+\/100/);
  await expect(after).toBeVisible();
  const now = Number((await after.textContent())?.match(/now (\d+)\/100/)?.[1]);
  expect(now).toBeGreaterThan(before);

  // Skills are context-gated: "Spring 2024" is not the Spring framework.
  await expect(page.getByText('spring', { exact: true })).toHaveCount(0);
});
