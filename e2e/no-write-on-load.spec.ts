import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

// Opening a page is not a change. A visitor who types nothing leaves nothing
// on the device: no localStorage keys, no IndexedDB database. Writing an
// untouched snapshot on load can also overwrite newer work from another tab.
const PAGES = [
  '/career/',
  '/resume-game/',
  '/networking-practice/',
  '/interview-glow-up/',
  '/interview-glow-up/workspace/',
  '/interview-glow-up/rehearse/',
  '/application/',
  '/pay/',
  '/dashboard/',
  '/start/',
];

for (const path of PAGES) {
  test(`opening ${path} and typing nothing stores nothing`, async ({ page }) => {
    await page.goto(path);
    await waitForHydration(page);
    // Effects that read storage, open IndexedDB, or load lazy features run
    // after hydration. Give them time to finish before looking.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const stored = await page.evaluate(() => Object.keys(window.localStorage));
    expect(stored).toEqual([]);
    const databases = await page.evaluate(async () =>
      (await indexedDB.databases()).map((info) => info.name)
    );
    expect(databases).toEqual([]);
  });
}
