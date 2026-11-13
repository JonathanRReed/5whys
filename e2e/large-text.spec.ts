import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * A visitor with low vision who doubles the text size on a phone, in the
 * OpenDyslexic typeface. Nothing may run past the right edge of the screen:
 * the page clips sideways overflow, so anything that does is simply gone.
 */
const ROUTES = [
  '/',
  '/start/',
  '/dashboard/',
  '/career/',
  '/resume-game/',
  '/networking-practice/',
  '/interview-glow-up/',
  '/interview-glow-up/workspace/',
  '/interview-glow-up/rehearse/',
  '/application/',
  '/pay/',
  '/about/',
  '/privacy/',
];

test.use({ viewport: { width: 390, height: 844 } });

for (const route of ROUTES) {
  test(`${route} reflows at 200 percent text in OpenDyslexic`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('career-tools-font', 'dyslexic');
    });
    await page.goto(route);
    await waitForHydration(page);
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const width = document.documentElement.clientWidth;
            const cut: string[] = [];
            for (const element of document.querySelectorAll('main *, header *')) {
              const box = element.getBoundingClientRect();
              if (box.width === 0 || box.height === 0) continue;
              const style = getComputedStyle(element);
              if (style.position === 'fixed' || style.visibility === 'hidden') continue;
              if (element.closest('.sr-only, [aria-hidden="true"]')) continue;
              if (box.right > width + 2 && box.left < width) {
                cut.push(
                  `${element.tagName.toLowerCase()}: ${(element.textContent ?? '').trim().slice(0, 40)}`
                );
              }
            }
            return cut.slice(0, 5);
          }),
        { timeout: 8000 }
      )
      .toEqual([]);
    // The header would cover a fifth of the screen at this size: it must not stay stuck to the top.
    const header = page.locator('[data-site-header]');
    await expect(header).toHaveCSS('position', 'static');
  });
}
