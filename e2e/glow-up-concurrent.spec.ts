import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

const IMPORTED = {
  version: 1,
  currentRoleId: 'r1',
  currentPacketId: null,
  roles: [
    {
      id: 'r1',
      jobTitle: 'Imported Role',
      company: 'Elsewhere',
      rawJdText: 'Pasted on another device',
      bullets: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  stories: [],
  packets: [],
};

// A workspace tab that only read storage must never write to it. Before this
// was guarded, importing a backup in a second tab was silently reverted the
// next time the untouched workspace tab unloaded.
test('an untouched workspace tab never overwrites work saved elsewhere', async ({
  page,
  context,
}) => {
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);

  const other = await context.newPage();
  await other.goto('/dashboard/');
  await other.evaluate((data) => {
    window.localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
  }, IMPORTED);

  // Returning to the stale tab and reloading must keep the imported role.
  await page.bringToFront();
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);

  await expect(page.locator('#job-title')).toHaveValue('Imported Role');
  const roles = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem('interview-glow-up-data') ?? '{"roles":[]}').roles
        .length
  );
  expect(roles).toBe(1);
});

test('a workspace tab with real edits still saves them on unload', async ({ page }) => {
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);

  await page.locator('#job-title').fill('Edited Role');
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);

  await expect(page.locator('#job-title')).toHaveValue('Edited Role');
});
