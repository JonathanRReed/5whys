import { expect, test } from '@playwright/test';

test('the homepage sorts a sample posting on the device with one press', async ({ page }) => {
  await page.goto('/');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const specimen = page.getByTestId('home-specimen');
  await specimen.scrollIntoViewIfNeeded();
  await expect(specimen.locator('mark')).toHaveCount(0);
  // The demo hydrates when it scrolls into view, so a press can land a moment
  // before it is live. Press until it takes, as a visitor would.
  await expect(async () => {
    // Once a press has taken, the button is renamed; do not press again.
    if ((await specimen.locator('mark').count()) === 0) {
      await page.getByRole('button', { name: 'Sort what it asks for' }).click({ timeout: 1000 });
    }
    await expect(specimen.locator('mark').first()).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(page.getByRole('link', { name: 'Do this with a real posting' })).toHaveAttribute(
    'href',
    '/application/'
  );
  await page.getByRole('button', { name: 'Put it back' }).click();
  await expect(specimen.locator('mark')).toHaveCount(0);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});
