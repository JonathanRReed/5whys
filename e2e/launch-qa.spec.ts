/**
 * Launch QA regressions that need real storage or a second tab: two pages in
 * one browser context share localStorage and receive each other's storage
 * events, as two tabs do. Each test names its finding.
 */
import { readFile } from 'node:fs/promises';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import JSZip from 'jszip';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

type SeedApp = { id: string; title: string; company?: string };

/** Write applications (and optionally other stores) on the site's origin. */
async function seed(page: Page, apps: SeedApp[], extra: Record<string, unknown> = {}) {
  await page.goto('/');
  await page.evaluate(
    ({ apps, extra }) => {
      window.localStorage.setItem(
        'career-applications',
        JSON.stringify({
          version: 1,
          activeId: apps[0]?.id ?? null,
          applications: apps.map((app) => ({
            id: app.id,
            title: app.title,
            company: app.company ?? '',
            deadline: null,
            roleId: null,
            createdAt: 1,
            updatedAt: 1,
          })),
        })
      );
      for (const [key, value] of Object.entries(extra)) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { apps, extra }
  );
}

async function open(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.goto(path);
  await waitForHydration(page);
  return page;
}

const resumeSession = (volunteers: number) => ({
  resumeText: [
    'Sam Lee',
    'sam@example.edu',
    '',
    'EXPERIENCE',
    'Volunteer Coordinator, Harbor Street Food Bank | Jan 2025 - Present',
    `- Built a spreadsheet tracking ${volunteers} volunteers.`,
    '- Ran the front desk on Saturday mornings for the pantry.',
    '- Wrote the weekly newsletter for 200 readers.',
  ].join('\n'),
  bullets: [],
  lastAnalyzedAt: null,
  needsRescan: true,
});

test('finding 1: clearing everything in one tab empties the desk in another', async ({
  page,
  context,
}) => {
  await useStudentProfile(page);
  await seed(page, [{ id: 'a', title: 'Library assistant' }]);
  const desk = await open(context, '/application/?id=a&station=letter');
  await desk.getByLabel(/Name the role with a hook/).fill('A private letter about my family');
  await expect.poll(() => readStorage(desk, 'career-application-desk')).toContain('private');

  const dashboard = await open(context, '/dashboard/');
  const clear = dashboard.getByRole('button', { name: 'Clear everything on this device' });
  await clear.click();
  await dashboard.getByRole('button', { name: /Delete everything you wrote/ }).click();
  await expect.poll(() => readStorage(desk, 'career-applications')).toBeNull();

  await desk.bringToFront();
  await expect(desk.getByRole('alert')).toContainText('cleared in another tab');
  await expect(desk.getByText('A private letter about my family')).toHaveCount(0);
  await expect(desk.getByLabel(/Name the role with a hook/)).toHaveCount(0);
  expect(await readStorage(desk, 'career-application-desk')).toBeNull();
  expect(await readStorage(desk, 'career-applications')).toBeNull();
});

test('clearing everything in one tab also empties a tool open in another', async ({
  page,
  context,
}) => {
  await useStudentProfile(page);
  const career = await open(context, '/career/');
  await career.locator('#career-topic').fill('Something private about my family');
  await expect.poll(() => readStorage(career, 'career-why-session-v2')).toContain('private');

  const dashboard = await open(context, '/dashboard/');
  await dashboard.getByRole('button', { name: 'Clear everything on this device' }).click();
  await dashboard.getByRole('button', { name: /Delete everything you wrote/ }).click();
  await expect.poll(() => readStorage(career, 'career-why-session-v2')).toBeNull();

  await career.bringToFront();
  await expect(career.locator('#career-topic')).toHaveValue('');
  // And nothing typed afterwards can bring the cleared words back.
  expect(await readStorage(career, 'career-why-session-v2')).toBeNull();
});

test('finding 2: confirmations made in two tabs are both kept', async ({ page, context }) => {
  await useStudentProfile(page);
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role').fill('Community programs intern');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await page.getByRole('button', { name: 'Use a sample posting' }).click();
  await page.getByRole('button', { name: 'Decode the posting', exact: true }).click();
  await expect(page.getByTestId('posting-count')).toBeVisible();

  const other = await open(context, '/application/');
  await other.getByRole('button', { name: /^Confirm\s*: Schedule and confirm 30/ }).click();
  await page
    .getByRole('button', { name: /^Confirm\s*: Write the weekly volunteer update/ })
    .click();

  const glow = JSON.parse((await readStorage(page, 'interview-glow-up-data')) as string) as {
    roles: { bullets: { text: string; confirmed?: boolean }[] }[];
  };
  const bullets = glow.roles[0].bullets;
  const confirmed = (start: string) => bullets.find((b) => b.text.startsWith(start))?.confirmed;
  expect(confirmed('Schedule and confirm 30')).toBe(true);
  expect(confirmed('Write the weekly volunteer update')).toBe(true);
});

test('finding 3: the tailored download uses the resume as saved now', async ({ page }) => {
  await useStudentProfile(page);
  await seed(page, [{ id: 'a', title: 'Program assistant' }], {
    'resume-game-session-v2': resumeSession(30),
  });
  await page.goto('/application/?id=a&station=resume');
  await waitForHydration(page);
  await expect(page.getByText('Built a spreadsheet tracking 30 volunteers.')).toBeVisible();

  // The resume is corrected without this page being told (as from a tab that
  // was asleep). The download notices and refuses to use the old copy.
  await page.evaluate(
    (session) => window.localStorage.setItem('resume-game-session-v2', JSON.stringify(session)),
    resumeSession(45)
  );
  await page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click();
  await expect(page.getByText(/Your resume changed in another tab/)).toBeVisible();
  await expect(page.getByText('Built a spreadsheet tracking 45 volunteers.')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  const path = await download.path();
  const zip = await JSZip.loadAsync(await readFile(path));
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  expect(xml).toContain('45 volunteers');
  expect(xml).not.toContain('30 volunteers');
});

test('finding 3: a correction saved in another tab shows on the open desk', async ({
  page,
  context,
}) => {
  await useStudentProfile(page);
  await seed(page, [{ id: 'a', title: 'Program assistant' }], {
    'resume-game-session-v2': resumeSession(30),
  });
  const desk = await open(context, '/application/?id=a&station=resume');
  await expect(desk.getByText('Built a spreadsheet tracking 30 volunteers.')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(
    (session) => window.localStorage.setItem('resume-game-session-v2', JSON.stringify(session)),
    resumeSession(45)
  );
  await expect(desk.getByText('Built a spreadsheet tracking 45 volunteers.')).toBeVisible();
});

test('finding 5: an application removed on the dashboard stops saving in its open desk', async ({
  page,
  context,
}) => {
  await useStudentProfile(page);
  await seed(page, [
    { id: 'a', title: 'Research assistant' },
    { id: 'b', title: 'Library assistant' },
  ]);
  const desk = await open(context, '/application/?id=b&station=letter');
  await desk.getByLabel(/Name the role with a hook/).fill('Note typed before the removal');

  const dashboard = await open(context, '/dashboard/');
  const row = dashboard.locator('#app-row-b');
  await row.getByRole('button', { name: 'Remove' }).click();
  await row.getByRole('button', { name: /^Remove it\?/ }).click();
  await expect(dashboard.locator('#app-row-b')).toHaveCount(0);

  await desk.bringToFront();
  await expect(desk.getByRole('alert')).toContainText(
    '"Library assistant" was removed in another tab'
  );
  await expect(desk.getByLabel('What you had written for the removed application')).toHaveValue(
    /Note typed before the removal/
  );
  await expect(desk.getByLabel(/Name the role with a hook/)).toHaveCount(0);
  const desks = JSON.parse((await readStorage(desk, 'career-application-desk')) ?? '{"desks":{}}');
  expect(desks.desks.b).toBeUndefined();
});

test('finding 6: a full browser store keeps the new-application form', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/dashboard/');
  await waitForHydration(page);
  await page.evaluate(() => {
    let n = 0;
    for (let size = 1 << 20; size >= 1; size = Math.floor(size / 2)) {
      const chunk = 'x'.repeat(size);
      try {
        for (;;) window.localStorage.setItem(`qa-quota-fill-${n++}`, chunk);
      } catch {
        // Full at this size; try a smaller piece.
      }
    }
  });
  try {
    await page.getByLabel('Role').fill('Student research intern');
    await page.getByRole('button', { name: 'Track this application' }).click();
    await expect(page.getByRole('alert')).toContainText('This browser would not save it.');
    await expect(page.getByLabel('Role')).toHaveValue('Student research intern');
  } finally {
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('qa-quota-fill-')) window.localStorage.removeItem(key);
      }
    });
  }
});

test('finding 8: a percentage bonus survives a reload and follows base pay', async ({ page }) => {
  await useStudentProfile(page);
  await seed(page, [{ id: 'a', title: 'Program assistant' }]);
  await page.goto('/pay/?id=a');
  await waitForHydration(page);
  await page.getByLabel('Base pay').fill('62000');
  await page.getByLabel('Paid').selectOption('year');
  await page.getByLabel('Hours a week').fill('40');
  await page.getByLabel('Weeks a year').fill('52');
  await page.getByLabel('Guaranteed bonus, a year').fill('5%');
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByLabel('Guaranteed bonus, a year')).toHaveValue('5%');
  await page.getByLabel('Base pay').fill('100000');
  const guaranteed = page.locator('dt', { hasText: 'With the guaranteed bonus' }).locator('+ dd');
  await expect(guaranteed).toHaveText('$105,000 a year');
});

test('findings 12 and 17: decimal commas and huge numbers on the pay page', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/pay/');
  await waitForHydration(page);
  await page.getByLabel('Base pay').fill('26,50');
  await page.getByLabel('Paid').selectOption('hour');
  await page.getByLabel('Hours a week').fill('40');
  await page.getByLabel('Weeks a year').fill('52');
  const worksOut = page.locator('dt', { hasText: 'Works out to' }).locator('+ dd');
  await expect(worksOut).toHaveText('$26.50 an hour');

  await page.getByLabel('Base pay').fill('26,5000');
  await expect(page.getByLabel('Base pay')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Base pay').fill('9'.repeat(308));
  await expect(page.getByLabel('Base pay')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('∞')).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('finding 18: the storage panel measures again after an import', async ({ page }) => {
  await useStudentProfile(page);
  await seed(page, [{ id: 'a', title: 'Program assistant' }], {
    'career-application-desk': {
      version: 1,
      desks: { a: { letter: { hook: 'x'.repeat(30000) } } },
    },
  });
  await page.goto('/dashboard/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Measure it' }).click();
  const total = page.getByTestId('storage-total');
  await expect(total).toBeVisible();
  const before = await total.textContent();
  await page.getByLabel('Import a 5 Whys Career Studio export file').setInputFiles({
    name: 'small.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: '5whys-career-studio',
        version: 2,
        exportedAt: '',
        stores: {
          'career-applications': {
            version: 1,
            activeId: null,
            applications: [
              {
                id: 's',
                title: 'Small',
                company: '',
                deadline: null,
                roleId: null,
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        },
      })
    ),
  });
  await page.getByRole('button', { name: 'Replace everything here' }).click();
  await expect(total).not.toHaveText(before ?? '');
});

test('finding 19: removing an application hands focus to the next one', async ({ page }) => {
  await useStudentProfile(page);
  await seed(page, [
    { id: 'a', title: 'Research assistant' },
    { id: 'b', title: 'Library assistant' },
  ]);
  await page.goto('/dashboard/');
  await waitForHydration(page);
  const remove = page.locator('#app-row-a').getByRole('button', { name: 'Remove' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('#app-row-a')).toHaveCount(0);
  await expect(page.locator('#app-row-b')).toBeFocused();
});

test.describe('finding 20: the career review at phone width', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test('the question gets the full width in OpenDyslexic', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('career-tools-font', 'dyslexic'));
    await page.goto('/start/');
    await waitForHydration(page);
    const heading = page.getByRole('heading', { name: 'Where are you in your career?' });
    const box = await heading.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
  });
});
