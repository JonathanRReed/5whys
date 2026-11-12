import { expect, type Page, test } from '@playwright/test';
import { useStudentProfile, waitForHydration } from './helpers';

/** Start an application and load the sample posting into the editor. */
async function openSamplePosting(page: Page) {
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role').fill('Programs intern');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await page.getByRole('button', { name: 'Use a sample posting' }).click();
  // The sample button goes away; focus moves to the next step.
  await expect(page.getByRole('button', { name: 'Decode the posting' })).toBeFocused();
}

test('decoding a posting puts focus on the result and says what it found', async ({ page }) => {
  await useStudentProfile(page);
  await openSamplePosting(page);
  await page.getByRole('button', { name: 'Decode the posting' }).press('Enter');

  await expect(page.getByRole('heading', { name: 'The posting', level: 2 })).toBeFocused();
  const count = await page.getByTestId('posting-count').textContent();
  const shown = count?.match(/^\d+ confirmed, \d+ to review\./)?.[0];
  expect(shown).toBeTruthy();
  // The status repeats the count line the page shows.
  await expect(page.getByRole('status').filter({ hasText: 'Posting decoded.' })).toHaveText(
    `Posting decoded. ${shown}`
  );
});

test('Confirm keeps focus, toggles, and announces the new count', async ({ page }) => {
  await useStudentProfile(page);
  await openSamplePosting(page);
  await page.getByRole('button', { name: 'Decode the posting' }).click();

  const confirm = page.getByRole('button', { name: /^Confirm\s*:/ }).first();
  const id = await confirm.getAttribute('id');
  await confirm.focus();
  await page.keyboard.press('Enter');

  const toggled = page.locator(`[id="${id}"]`);
  await expect(toggled).toBeFocused();
  await expect(toggled).toHaveAttribute('aria-pressed', 'true');
  await expect(toggled).toHaveAccessibleName(/^Confirmed\s*:/);
  await expect(page.getByTestId('posting-count')).toContainText('1 confirmed');
  await expect(page.getByRole('status').filter({ hasText: /^Confirmed\./ })).toContainText(
    '1 confirmed'
  );

  // A second press undoes it, and focus still stays.
  await page.keyboard.press('Enter');
  await expect(toggled).toBeFocused();
  await expect(toggled).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('posting-count')).toContainText('0 confirmed');
});

const TOOL_PAGES = [
  '/career/',
  '/resume-game/',
  '/networking-practice/',
  '/interview-glow-up/',
  '/interview-glow-up/workspace/',
  '/interview-glow-up/rehearse/',
  '/application/',
  '/pay/',
  '/dashboard/',
];

test.describe('reflow at 320 px in OpenDyslexic', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  for (const path of TOOL_PAGES) {
    test(`${path} does not scroll sideways or clip content`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('career-tools-font', 'dyslexic'));
      await page.goto(path);
      await waitForHydration(page);
      await expect(page.locator('html')).toHaveAttribute('data-font', 'dyslexic');
      await page.evaluate(() => document.fonts.ready);

      const result = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const over: string[] = [];
        for (const element of document.querySelectorAll('main *')) {
          if (!element.checkVisibility()) continue;
          if (element.closest('.sr-only, [inert], [aria-hidden="true"]')) continue;
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          if (box.right <= width + 1 && box.left >= -1) continue;
          // A table or strip that scrolls sideways on purpose is fine.
          let parent = element.parentElement;
          let scrolls = false;
          while (parent) {
            const style = getComputedStyle(parent);
            if (
              (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
              parent.scrollWidth > parent.clientWidth
            ) {
              scrolls = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!scrolls)
            over.push(`${element.tagName} "${element.textContent?.trim().slice(0, 40)}"`);
        }
        return { scrollWidth: document.documentElement.scrollWidth, width, over: over.slice(0, 5) };
      });

      expect(result.scrollWidth).toBeLessThanOrEqual(result.width);
      expect(result.over).toEqual([]);
    });
  }
});

test.describe('phone menu', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('closes when Tab moves past its last link', async ({ page }) => {
    await page.goto('/career/');
    await waitForHydration(page);
    const toggle = page.getByRole('button', { name: 'Toggle navigation' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const menu = page.getByRole('navigation', { name: 'Menu' });
    await menu.getByRole('button', { name: 'Tools' }).focus();
    // Through the tool links and out into the page.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('#primary-navigation'))
      );
      if (!inside) break;
    }

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#primary-navigation')).toHaveAttribute('inert', '');
  });
});
