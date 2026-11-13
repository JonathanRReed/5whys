import { expect, type Page, test } from '@playwright/test';
import { readStorage, waitForHydration, watchConsoleErrors } from './helpers';

/**
 * A click this soon after the question changed is read as the second tap of
 * a double tap and ignored, so a test that answers twice waits as a person
 * would between two questions.
 */
const nextQuestion = (page: Page) => page.waitForTimeout(450);

test('the career review recommends a tool and saves the profile', async ({ page }) => {
  await page.goto('/start/');
  await waitForHydration(page);

  // The first step is server-rendered: it is in the DOM before hydration.
  await expect(page.getByRole('heading', { name: 'Where are you in your career?' })).toBeVisible();

  await page.getByRole('button', { name: 'Student' }).click();
  await nextQuestion(page);
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
    await nextQuestion(page);
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
    await nextQuestion(page);
    await page.getByRole('button', { name: 'Unclear direction', exact: true }).click();
    // "Start over" asks in place before it clears the answers.
    await page.getByRole('button', { name: 'Start over', exact: true }).click();
    await page.getByRole('button', { name: 'Clear both answers', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Where are you in your career?' })
    ).toBeFocused();
    expect(
      await status.evaluate((node) => node === document.querySelector('[role="status"]'))
    ).toBe(true);
    await nextQuestion(page);
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await nextQuestion(page);
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

test('a double tap on an answer does not skip the next question', async ({ page }) => {
  await page.goto('/start/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Student', exact: true }).dblclick();
  await expect(
    page.getByRole('heading', { name: 'What is your biggest challenge right now?' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /starting point/ })).toHaveCount(0);
});

test('someone with little to show is sent to start a resume from nothing', async ({ page }) => {
  await page.goto('/start/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'High school or first job' }).click();
  await nextQuestion(page);
  await page.getByRole('button', { name: 'I do not have much to show yet' }).click();
  await expect(page.getByRole('link', { name: /Start now/ })).toHaveAttribute(
    'href',
    '/resume-game/?start=blank'
  );
  const profile = JSON.parse((await readStorage(page, 'career-tools-profile')) ?? 'null');
  expect(profile).toMatchObject({ stage: 'student', focus: 'starting', firstJob: true });
});
