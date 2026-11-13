import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

test('the offer worksheet puts an offer into plain terms and requests nothing it does not have', async ({
  page,
}) => {
  const requests: string[] = [];
  const failed: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto('/pay/');
  await waitForHydration(page);

  // Without wage figures built in, no search promises pay and no wage file is asked for.
  await expect(page.getByText('What the job tends to pay')).toHaveCount(0);
  await expect(page.getByLabel('Job title')).toHaveCount(0);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);

  // Nothing is assumed: hours and weeks are needed before an hourly figure appears.
  await page.getByLabel('Base pay').fill('6000');
  await page.getByLabel('Paid').selectOption('month');
  const worksOutTo = page.locator('dl > div').filter({ hasText: 'An hour' });
  await expect(worksOutTo).toContainText('Needs more detail');
  await page.getByLabel('Hours a week').fill('40');
  await page.getByLabel('Weeks a year').fill('10');
  await expect(worksOutTo).toContainText('an hour');
  await expect(worksOutTo).not.toContainText('Needs more detail');

  // A bonus typed as a percentage follows the base pay when the base pay is corrected.
  await page.getByLabel('Paid').selectOption('year');
  await page.getByLabel('Weeks a year').fill('52');
  await page.getByLabel('Base pay').fill('62000');
  await page.getByLabel('Guaranteed bonus, a year').fill('5%');
  const withBonus = page.locator('dl > div').filter({ hasText: 'With the guaranteed bonus' });
  await expect(withBonus).toContainText('65,100');
  await page.getByLabel('Base pay').fill('100000');
  await expect(withBonus).toContainText('105,000');
  expect(requests.some((url) => /oews|wages/i.test(url))).toBe(false);
  expect(failed).toEqual([]);
});
