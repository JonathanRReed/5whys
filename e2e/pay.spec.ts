import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

test('a job title is matched on the device and an offer is put into plain terms', async ({
  page,
}) => {
  await page.goto('/pay/');
  await waitForHydration(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.getByLabel('Job title').fill('marketing assistant');
  const firstMatch = page.getByRole('listitem').getByRole('button').first();
  await expect(firstMatch).toBeVisible();
  await firstMatch.click();
  await expect(page.getByTestId('pay-occupation')).not.toBeEmpty();

  // What was typed never appears in a request.
  expect(requests.some((url) => /marketing/i.test(decodeURIComponent(url)))).toBe(false);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);

  // Nothing is assumed: hours and weeks are needed before an hourly figure appears.
  await page.getByLabel('Base pay').fill('6000');
  await page.getByLabel('Paid').selectOption('month');
  const worksOutTo = page.locator('dl > div').filter({ hasText: 'Works out to' });
  await expect(worksOutTo).toContainText('Needs more detail');
  await page.getByLabel('Hours a week').fill('40');
  await page.getByLabel('Weeks a year').fill('10');
  await expect(worksOutTo).toContainText('an hour');
  await expect(worksOutTo).not.toContainText('Needs more detail');
});
