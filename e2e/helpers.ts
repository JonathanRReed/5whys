import type { Page } from '@playwright/test';

/** Seed the career profile before the page loads, the way /start saves it. */
export async function useStudentProfile(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'career-tools-profile',
      JSON.stringify({ stage: 'student', focus: 'direction', updatedAt: new Date().toISOString() })
    );
  });
}

/** Collect console errors so a test can assert the page stayed clean. */
export function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export const readStorage = (page: Page, key: string) =>
  page.evaluate((k) => window.localStorage.getItem(k), key);

/**
 * Wait until every React island on the page has hydrated. Astro drops the
 * `ssr` attribute from <astro-island> once the component is interactive;
 * typing into a controlled input before that point is silently discarded.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const islands = Array.from(document.querySelectorAll('astro-island'));
    return islands.length > 0 && islands.every((island) => !island.hasAttribute('ssr'));
  });
}
