import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

// One recording at a time. Several fake microphones opening at once on a busy
// machine made the recorder slow to start, and these tests timed out together.
test.describe.configure({ mode: 'serial' });

// A fake microphone, so recording can be tested without a real device.
test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test('a question is answered in writing and reviewed with counts, not a grade', async ({
  page,
}) => {
  await page.goto('/interview-glow-up/rehearse/');
  await waitForHydration(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.getByRole('radio', { name: /In writing/ }).check();
  await page.getByRole('button', { name: 'Start with the first question' }).click();
  await expect(page.getByTestId('rehearsal-question')).not.toBeEmpty();
  await expect(page.getByText('Question 1 of')).toBeVisible();

  await page
    .getByLabel('Your answer')
    .fill('I ran the weekly schedule for our campus food pantry and, um, cut missed shifts.');
  await page.getByRole('button', { name: 'Review my answer' }).click();

  await expect(page.getByTestId('take-words')).toHaveText('15');
  // A typed answer has no pace or pauses, and its words are not counted as fillers.
  await expect(page.getByText('Said "um"')).toHaveCount(0);
  await expect(page.getByText('Count pace, pauses and repeated words')).toHaveCount(0);
  await expect(page.getByText('These are counts, not grades.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\d+\s?%|\/100|out of 10/);

  // A follow-up question comes from the built-in rules when there is no model.
  await page.getByRole('button', { name: 'What might they ask next?' }).click();
  await expect(page.getByText('From the built-in rules')).toBeVisible();

  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByText('Question 2 of')).toBeVisible();

  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});

test('an answer is recorded on the device, played back, and kept only when asked', async ({
  page,
}) => {
  // The preview server sends only the site-wide headers. In production,
  // public/_headers allows the microphone on this route (a unit test asserts
  // that), so give the document the header it will really have.
  await page.route('**/interview-glow-up/rehearse/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'permissions-policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
      },
    });
  });
  await page.goto('/interview-glow-up/rehearse/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Start with the first question' }).click();
  await page.getByRole('button', { name: 'Record my answer' }).click();
  await expect(page.getByRole('button', { name: 'Stop and review' })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Stop and review' }).click();

  await expect(page.locator('audio')).toBeVisible();
  await expect(page.getByTestId('take-length')).toHaveText(/^0:0[1-9]$/);

  // A spoken answer counts pace by default, and the visitor can switch that off.
  await expect(page.getByText('Pace', { exact: true })).toBeVisible();
  await page.getByLabel('Count pace, pauses and repeated words').uncheck();
  await expect(page.getByText('Pace', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('take-length')).toBeVisible();

  // Nothing is stored until the visitor says so.
  const stored = () =>
    page.evaluate(async () => {
      const names = (await indexedDB.databases()).map((db) => db.name);
      let total = 0;
      for (const name of names) {
        if (!name) continue;
        total += await new Promise<number>((resolve) => {
          const open = indexedDB.open(name);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('recordings')) {
              db.close();
              resolve(0);
              return;
            }
            const count = db.transaction('recordings').objectStore('recordings').count();
            count.onsuccess = () => {
              db.close();
              resolve(count.result);
            };
            count.onerror = () => resolve(0);
          };
          open.onerror = () => resolve(0);
        });
      }
      return total;
    });
  expect(await stored()).toBe(0);

  await page.getByRole('button', { name: 'Keep this recording' }).click();
  await expect(page.getByRole('button', { name: 'Recording kept on this device' })).toBeDisabled();
  expect(await stored()).toBe(1);
});

test('a networking rep can be recorded and played back', async ({ page }) => {
  await page.route('**/networking-practice/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'permissions-policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
      },
    });
  });
  await page.goto('/networking-practice/');
  await waitForHydration(page);
  const recorder = page.getByRole('region', { name: 'Hear how it sounds' });
  await recorder.getByRole('button', { name: 'Record this rep' }).click();
  await expect(recorder.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(1200);
  await recorder.getByRole('button', { name: 'Stop' }).click();
  await expect(recorder.locator('audio')).toBeVisible();
  await expect(recorder.getByRole('button', { name: 'Record again' })).toBeVisible();
  await recorder.getByRole('button', { name: 'Keep this recording' }).click();
  await expect(recorder.getByRole('button', { name: 'Kept on this device' })).toBeDisabled();

  // A kept recording can be heard again after the page is reopened, and deleted on its own.
  await page.reload();
  await waitForHydration(page);
  const saved = page.getByRole('region', { name: 'Recordings you kept' });
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await saved.getByRole('button', { name: /^Play/ }).click();
  await expect(saved.locator('audio')).toBeVisible();
  const remove = saved.getByRole('button', { name: /Delete/ });
  await remove.click();
  await remove.click();
  await expect(saved).toHaveCount(0);
});
