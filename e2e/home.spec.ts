import { expect, test } from '@playwright/test';

test('the homepage sorts a sample posting on the device with one press', async ({ page }) => {
  await page.goto('/');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const specimen = page.getByTestId('home-specimen');
  await specimen.scrollIntoViewIfNeeded();
  await expect(specimen.locator('mark')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sort what it asks for' }).click();
  await expect(specimen.locator('mark').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Do this with a real posting' })).toHaveAttribute(
    'href',
    '/application/'
  );
  await page.getByRole('button', { name: 'Put it back' }).click();
  await expect(specimen.locator('mark')).toHaveCount(0);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});
