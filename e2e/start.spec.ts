import { expect, test } from '@playwright/test';
import { readStorage, waitForHydration, watchConsoleErrors } from './helpers';

test('the career review recommends a tool and saves the profile', async ({ page }) => {
  await page.goto('/start/');
  await waitForHydration(page);

  // The first step is server-rendered: it is in the DOM before hydration.
  await expect(page.getByRole('heading', { name: 'Where are you in your career?' })).toBeVisible();

  await page.getByRole('button', { name: 'Student' }).click();
  await page.getByRole('button', { name: 'Unclear direction' }).click();

  await expect(page.getByRole('heading', { name: 'Here is your starting point' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start now/ })).toHaveAttribute('href', '/career/');
  await expect(page.getByText('2 min')).toHaveCount(0);

  const profile = JSON.parse((await readStorage(page, 'career-tools-profile')) ?? 'null');
  expect(profile).toMatchObject({ stage: 'student', focus: 'direction' });

  // A returning visitor lands on the recommendation, not the first question.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: /Your starting point/ })).toBeVisible();
});

for (const theme of ['night', 'dawn']) {
  test(`career review focus is visible and follows user navigation in ${theme}`, async ({
    page,
  }, testInfo) => {
    const errors = watchConsoleErrors(page);
    await page.goto('/start/');
    await waitForHydration(page);
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const status = await page.getByRole('status').elementHandle();
    if (!status) throw new Error('Missing career review status region');
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(
      page.getByRole('heading', { name: 'Where are you in your career?' })
    ).not.toBeFocused();
    await page.getByRole('button', { name: 'Student', exact: true }).focus();
    await page.keyboard.press('Enter');
    const question = page.getByRole('heading', {
      name: 'What is your biggest challenge right now?',
    });
    await expect(question).toBeFocused();
    const outline = await question.evaluate((node) => ({
      style: getComputedStyle(node).outlineStyle,
      width: getComputedStyle(node).outlineWidth,
    }));
    expect(outline).toEqual({ style: 'solid', width: '2px' });
    await expect(page.getByRole('status')).toHaveText('Step 2 of 2.');
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`career-review-${theme}-question.png`),
    });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Where are you in your career?' })
    ).toBeFocused();
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await page.getByRole('button', { name: 'Unclear direction', exact: true }).focus();
    await page.keyboard.press('Enter');
    const result = page.getByRole('heading', { name: 'Here is your starting point' });
    await expect(result).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Career review complete.');
    expect(
      await status.evaluate((node) => node === document.querySelector('[role="status"]'))
    ).toBe(true);
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`career-review-${theme}-result.png`),
    });
    await page.getByRole('button', { name: 'Change the last answer' }).click();
    await expect(question).toBeFocused();
    await page.getByRole('button', { name: 'Unclear direction', exact: true }).click();
    await page.getByRole('button', { name: 'Start over', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Where are you in your career?' })
    ).toBeFocused();
    expect(
      await status.evaluate((node) => node === document.querySelector('[role="status"]'))
    ).toBe(true);
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await page.getByRole('button', { name: 'Unclear direction', exact: true }).click();
    await page.reload();
    await waitForHydration(page);
    await expect(
      page.getByRole('heading', { name: 'Welcome back. Your starting point' })
    ).not.toBeFocused();
    await expect(page.getByRole('status')).toBeEmpty();
    expect(errors).toEqual([]);
  });
}
