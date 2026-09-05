import { expect, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration, watchConsoleErrors } from './helpers';

const JOB_POSTING = `Junior Software Developer
Brightline Health - Remote (US)

Responsibilities
- Build and maintain features in our Python backend and React frontend
- Write unit and integration tests for new code
- Collaborate with designers and product managers on requirements
- Participate in code reviews and daily standups with the team

Requirements
- Familiarity with Python or JavaScript from coursework or projects
- Comfortable with Git and pull request workflows
- Clear written communication`;

test('a job is decoded, a story is built into the packet, and the HUD opens above the nav', async ({
  page,
}) => {
  await useStudentProfile(page);
  const errors = watchConsoleErrors(page);
  await page.goto('/interview-glow-up/workspace/');
  await waitForHydration(page);

  await page.locator('#jd-text').fill(JOB_POSTING);
  await page.getByRole('button', { name: 'Parse the requirements' }).click();
  await expect(page.getByRole('heading', { name: /Requirements \(\d+\)/ })).toBeVisible();
  // The company/location header line is not a requirement.
  await expect(page.locator('.max-h-96').getByText('Brightline Health - Remote (US)')).toHaveCount(
    0
  );
  // The role saved itself and took its title from the posting.
  await expect(page.locator('#job-title')).toHaveValue('Junior Software Developer');

  // Switching tabs and back keeps the decoded requirements.
  await page.getByRole('tab', { name: /Build stories/ }).click();
  await page.getByRole('tab', { name: /Decode the job/ }).click();
  await expect(page.getByRole('heading', { name: /Requirements \(\d+\)/ })).toBeVisible();

  await page.getByRole('tab', { name: /Build stories/ }).click();
  await page.getByRole('button', { name: '+ New story' }).click();
  await page.locator('#story-primary-skill').selectOption('python');
  await page.locator('#story-trigger').fill('Capstone scraper');
  await page
    .locator('#story-play')
    .fill('I built the data pipeline for our capstone in Python when the original plan broke.');
  await page.getByRole('radio', { name: /Solid/ }).check();
  await page.getByRole('button', { name: 'Save and add to packet' }).click();

  await expect(page.getByText('Solid', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Pack the proof/ }).click();
  await expect(page.getByText('1 story in the packet')).toBeVisible();

  // The HUD renders above the site chrome and closes on Escape.
  await page.getByRole('button', { name: 'Open the HUD' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Interview HUD' });
  await expect(dialog).toBeVisible();
  const closeButton = dialog.getByRole('button', { name: 'Close HUD' });
  const hitTest = await closeButton.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    return el.contains(target);
  });
  expect(hitTest).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Reloading with saved data must not throw a hydration error.
  await page.reload();
  await waitForHydration(page);
  await expect(page.locator('#job-title')).toHaveValue('Junior Software Developer');
  expect(errors.filter((e) => /418|hydrat/i.test(e))).toEqual([]);

  const saved = JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}');
  expect(saved.roles).toHaveLength(1);
  expect(saved.stories).toHaveLength(1);
  expect(saved.packets[0].topStoryIds).toHaveLength(1);
});
