import { expect, type Page, test } from '@playwright/test';
import { chooseOption, rate, readStorage, useStudentProfile, waitForHydration } from './helpers';

// One recording at a time, with a fake microphone and no sound.
test.describe.configure({ mode: 'serial' });
test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

async function rateAll(page: Page, value: number) {
  for (const label of ['Confidence', 'Clarity', 'Rapport', 'Authenticity']) {
    await rate(page, label, value);
  }
}

async function openHelp(page: Page) {
  const toggle = page.getByRole('button', { name: /Help me write it/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

test('a recorded rep runs the clock, saves its length, and leaves its fix for the next rep', async ({
  page,
}) => {
  // The preview server sends only the site-wide headers. In production the
  // microphone is allowed on this route, so give the page that header.
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
  await useStudentProfile(page);
  await page.goto('/networking-practice/');
  await waitForHydration(page);

  const flow = page.locator('[data-guide="rep-flow"]');
  await expect(flow.locator('[aria-current="step"]')).toContainText('Write it');
  await page
    .locator('#intro-draft')
    .fill('Hi, I am Jordan, a sophomore. What do interns own here?');
  await expect(flow.locator('[aria-current="step"]')).toContainText('Say it');

  await page.getByRole('button', { name: 'Record this rep' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('audio')).toBeVisible();
  await expect(page.locator('[data-guide="timer-elapsed"]')).toBeVisible();
  await expect(flow.locator('[aria-current="step"]')).toContainText('Rate it');

  await rateAll(page, 3);
  await page.locator('#reflection-nextFocus').fill('Slow down the opener');
  await page.locator('[data-guide="rep-save"]').click();
  await expect(page.locator('[data-guide="saved-rep"]')).toHaveCount(1);

  const sessions = JSON.parse((await readStorage(page, 'networking-practice-sessions')) ?? '[]');
  expect(sessions[0].attempts[0].durationSeconds).toBeGreaterThanOrEqual(1);

  // The ratings reset for the next rep, but the fix and next step stay in view.
  await expect(page.getByText('Not rated', { exact: true })).toHaveCount(4);
  const last = page.locator('[data-guide="last-rep"]');
  await expect(last).toContainText('Your fix: Slow down the opener');
  await expect(last).toContainText('Next step:');
  await expect(page.locator('[data-guide="saved-rep"]')).toContainText('Next step');
});

test('a customized scenario keeps the preset flow and names the person on the saved rep', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/networking-practice/');
  await waitForHydration(page);
  await chooseOption(page, '#scenario', 'Following Up After Two Weeks of Silence');

  await page.getByRole('button', { name: /Customize this scenario/ }).click();
  await page.getByLabel('Who you are speaking with').fill('Dana Whitfield, my VP until 2022.');
  await page
    .getByLabel('What you want to ask or share')
    .fill('Ask for 20 minutes on who is hiring');

  await openHelp(page);
  const help = page.locator('#networking-help');
  await expect(help.getByText('Add value, drop guilt')).toBeVisible();
  await expect(help.getByText('Your ask: Ask for 20 minutes on who is hiring')).toBeVisible();
  await expect(help.locator('ol li')).toHaveCount(5);
  await expect(
    help.getByText(/Before you reach out to Dana Whitfield, my VP until 2022:/)
  ).toBeVisible();
  await expect(help.getByText(/Prepare for:/)).toHaveCount(0);
  await expect(
    help.getByText(/Written for "Following Up After Two Weeks of Silence"/)
  ).toBeVisible();

  // A written message is counted as writing.
  await page
    .locator('#intro-draft')
    .fill('Hi Dana. It has been a while. Could we talk this month?');
  await expect(page.getByText(/3 sentences, 1 question/)).toBeVisible();

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Pause' }).click();
  await rateAll(page, 4);
  await page.locator('[data-guide="rep-save"]').click();
  const sessions = JSON.parse((await readStorage(page, 'networking-practice-sessions')) ?? '[]');
  expect(sessions[0].scenarioTitle).toBe(
    'Following Up After Two Weeks of Silence (Dana Whitfield)'
  );
});

test('a lab meeting is one of the situations, and a senior profile starts at work', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'career-tools-profile',
      JSON.stringify({ stage: 'senior', focus: 'networking', updatedAt: new Date().toISOString() })
    );
  });
  await page.goto('/networking-practice/');
  await waitForHydration(page);
  await expect(page.locator('#scenario')).toContainText('Reconnecting with a Former Colleague');
  await openHelp(page);
  await expect(page.getByText(/No achievements to cite/)).toHaveCount(0);
  await chooseOption(page, '#scenario', 'Lab or Research Group Meeting');
  await expect(page.locator('#scenario')).toContainText('Lab or Research Group Meeting');
  // Choosing a situation writes it; opening the page did not.
  expect(await readStorage(page, 'networking-practice-versions')).toContain('lab-meeting');
});
