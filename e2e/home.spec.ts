import { expect, test } from '@playwright/test';

test('the homepage decodes a sample posting on the device with one press', async ({ page }) => {
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
      await page.getByRole('button', { name: 'Decode this posting' }).click({ timeout: 1000 });
    }
    await expect(specimen.locator('mark').first()).toBeVisible({ timeout: 2000 });
  }).toPass();
  // It also names what the posting leaves unsaid, with a question to ask.
  await expect(page.getByTestId('home-asks').getByRole('listitem')).not.toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Do this with a real posting' })).toHaveAttribute(
    'href',
    '/application/'
  );
  await page.getByRole('button', { name: 'Put it back' }).click();
  await expect(specimen.locator('mark')).toHaveCount(0);
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});

test('a visitor picks their situation and lands in the tool with the guide on', async ({
  page,
}) => {
  await page.goto('/');
  const way = page.getByRole('region', { name: /What brought you here/ });
  await expect(way.getByRole('listitem')).toHaveCount(6);
  await way.getByRole('link', { name: /I found a job I want to apply for/ }).click();
  await expect(page).toHaveURL(/\/application\/\?guide=1$/);
  await expect(page.getByRole('complementary', { name: 'Guide' })).toBeVisible();
});

test('a posting pasted into the demo is sorted and carried to the desk', async ({ page }) => {
  await page.goto('/');
  const posting =
    'Front Desk Assistant\n\nRequirements\n• Experience answering phones and greeting visitors\n• Comfortable with spreadsheets\n\nNice to have\n• Spanish language skills';
  await page.getByTestId('home-specimen').scrollIntoViewIfNeeded();
  await expect(async () => {
    if ((await page.getByTestId('home-own-posting').count()) === 0) {
      await page.getByRole('button', { name: 'Try your own posting' }).click({ timeout: 1000 });
    }
    await expect(page.getByTestId('home-own-posting')).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.getByTestId('home-own-posting').fill(posting);
  await page.getByRole('button', { name: 'Decode this posting' }).click();
  await expect(page.getByTestId('home-specimen').locator('mark')).toHaveCount(3);
  await page.getByRole('link', { name: 'Take this posting to the desk' }).click();
  await expect(page).toHaveURL(/\/application\/$/);
  await page.getByLabel(/^Role/).fill('Front Desk Assistant');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await expect(page.getByLabel('Job description')).toHaveValue(posting);
  // Used once: it does not follow the visitor to the next application.
  expect(await page.evaluate(() => sessionStorage.getItem('desk-posting-handoff'))).toBeNull();
});
