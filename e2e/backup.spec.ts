import { expect, test } from '@playwright/test';
import { readStorage, waitForHydration, watchConsoleErrors } from './helpers';

for (const theme of ['night', 'dawn']) {
  test(`a failed replacement preserves saved work and can be retried (${theme})`, async ({
    page,
  }, testInfo) => {
    const errors = watchConsoleErrors(page);
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('career-tools-theme', selectedTheme);
      const now = new Date().toISOString();
      localStorage.setItem(
        'career-tools-profile',
        JSON.stringify({ stage: 'student', focus: 'direction', updatedAt: now })
      );
      localStorage.setItem(
        'career-why-history',
        JSON.stringify([
          {
            id: 'saved-reflection',
            timestamp: now,
            rootReason: 'Original reflection',
            whyStatement: 'Original reflection',
            nextStep: 'Keep the saved work',
            track: 'interest',
            topic: 'biology',
            responses: ['a', 'b', 'c', 'd', 'e'],
            updatedAt: now,
            version: 3,
          },
        ])
      );
      localStorage.setItem('resume-game-session-v2', JSON.stringify({ bullets: [] }));
      localStorage.setItem('unrelated', 'keep');
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          key === 'career-why-history' &&
          value.includes('imported-reflection') &&
          sessionStorage.getItem('allow-backup-import') !== 'yes'
        ) {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      };
    }, theme);
    await page.goto('/dashboard/');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const original = await page.evaluate(() =>
      Object.fromEntries(
        [
          'career-tools-profile',
          'career-why-history',
          'resume-game-session-v2',
          'unrelated',
          'career-tools-theme',
        ].map((key) => [key, localStorage.getItem(key)])
      )
    );
    const now = new Date().toISOString();
    await page.getByLabel('Import a 5 Whys Career Studio export file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: '5whys-career-studio',
          version: 1,
          exportedAt: now,
          stores: {
            'career-tools-profile': { stage: 'early', focus: 'interview', updatedAt: now },
            'career-why-history': [
              {
                id: 'imported-reflection',
                timestamp: now,
                rootReason: 'Imported reflection',
                whyStatement: 'Imported reflection',
                nextStep: 'Read the imported work',
                track: 'interest',
                topic: 'biology',
                responses: ['a', 'b', 'c', 'd', 'e'],
                updatedAt: now,
                version: 3,
              },
            ],
          },
        })
      ),
    });
    await page.getByRole('button', { name: 'Replace everything here' }).click();
    await expect(page.getByRole('alert')).toContainText('Your previous saved work was restored.');
    await expect(page.getByRole('status')).not.toContainText('Brought in');
    for (const [key, value] of Object.entries(original)) {
      expect(await readStorage(page, key)).toBe(value);
    }
    await page.getByRole('alert').scrollIntoViewIfNeeded();
    const controls = page.getByRole('alert').locator('..').locator('..');
    expect(await controls.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
    await controls.screenshot({ path: testInfo.outputPath('backup-failure.png') });

    await page.evaluate(() => sessionStorage.setItem('allow-backup-import', 'yes'));
    await page.getByRole('button', { name: 'Replace everything here' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Brought in 1 reflection.');
    expect(await readStorage(page, 'career-why-history')).toContain('imported-reflection');
    expect(await readStorage(page, 'career-tools-profile')).toContain('interview');
    expect(await readStorage(page, 'resume-game-session-v2')).toBeNull();
    expect(await readStorage(page, 'unrelated')).toBe('keep');
    expect(await readStorage(page, 'career-tools-theme')).toBe(theme);
    expect(errors).toEqual([]);
  });
}
