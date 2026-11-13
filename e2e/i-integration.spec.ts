/**
 * Batch I, integration: flows that cross tools. Each test names its item.
 */
import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import JSZip from 'jszip';
import { createDefaultData, createRole } from '../src/lib/glowup-store';
import { readStorage, useStudentProfile, waitForHydration, watchConsoleErrors } from './helpers';

const POSTING = `Operations Intern (Summer 2027)
Coastline Supply Co. | Ontario, CA

Required qualifications
- Working knowledge of Microsoft Excel, including sorting, filters, and basic formulas
- Clear written communication with vendors and drivers

Preferred qualifications
- Experience in retail, food service, or a warehouse`;

const desks = async (page: Page) =>
  JSON.parse((await readStorage(page, 'career-application-desk')) ?? 'null');

async function startApplication(page: Page) {
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role', { exact: true }).fill('Operations Intern (Summer 2027)');
  await page.getByLabel('Company or organization (optional)').fill('Coastline Supply Co.');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await page.getByLabel('Job description').fill(POSTING);
  await page.getByRole('button', { name: 'Decode the posting' }).click();
  await page.getByRole('button', { name: /^Confirm the required and preferred ones/ }).click();
}

for (const link of ['a saved link', 'a title match only'] as const) {
  test(`item 4: "Parse again" keeps what was decided on the desk (${link})`, async ({ page }) => {
    const errors = watchConsoleErrors(page);
    await useStudentProfile(page);
    await startApplication(page);

    await page.getByRole('tab', { name: /Qualifications/ }).click();
    const row = (text: string) => page.locator('li', { hasText: text }).last();
    await row('Working knowledge of Microsoft Excel')
      .getByRole('radio', { name: 'Have it' })
      .check();
    await row('Working knowledge of Microsoft Excel')
      .getByRole('textbox')
      .fill('I keep the club budget in Excel');
    await row('Experience in retail').getByRole('radio', { name: 'Not yet' }).check();
    await expect
      .poll(async () => {
        const saved = await desks(page);
        const appId = Object.keys(saved?.desks ?? {})[0];
        return (saved?.desks?.[appId]?.qualifications ?? []).filter(
          (q: { status: string }) => q.status !== 'unset'
        ).length;
      })
      .toBe(2);
    const appId = new URL(page.url()).searchParams.get('id') as string;
    const glow = JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}');
    const roleId = glow.currentRoleId as string;
    if (link === 'a title match only') {
      // An application added in Pay has no saved link: the desk and the
      // dashboard find its posting by title, and so must the remapping.
      await page.evaluate((id) => {
        const data = JSON.parse(localStorage.getItem('career-applications') ?? '{}');
        for (const app of data.applications ?? []) if (app.id === id) app.roleId = null;
        localStorage.setItem('career-applications', JSON.stringify(data));
      }, appId);
    }

    // The posting gains a line at the top, so every line moves, then is parsed again.
    await page.goto(`/interview-glow-up/workspace/?tab=decode&role=${roleId}`);
    await waitForHydration(page);
    await page.locator('#jd-text').fill(`Hiring now for summer.\n${POSTING}`);
    await page.getByRole('button', { name: 'Parse again' }).click();
    await expect
      .poll(async () => {
        const saved = JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}');
        return saved.roles?.find((r: { id: string }) => r.id === roleId)?.parsedJdText ?? '';
      })
      .toContain('Hiring now for summer.');

    await page.goto(`/application/?id=${appId}&station=qualifications`);
    await waitForHydration(page);
    await page.reload();
    await waitForHydration(page);
    await expect(
      row('Working knowledge of Microsoft Excel').getByRole('radio', { name: 'Have it' })
    ).toBeChecked();
    await expect(row('Working knowledge of Microsoft Excel').getByRole('textbox')).toHaveValue(
      'I keep the club budget in Excel'
    );
    await expect(row('Experience in retail').getByRole('radio', { name: 'Not yet' })).toBeChecked();
    expect(errors).toEqual([]);
  });
}

/** One application on a decoded posting, with nothing yet on its desk. */
async function seedOne(page: Page, extra: Record<string, string> = {}) {
  const glow = createRole(createDefaultData(), {
    jobTitle: 'Library aide',
    company: 'City Library',
    rawJdText: 'Library aide\nShelve returned books',
    bullets: [],
  });
  await page.goto('/');
  await page.evaluate(
    ({ glow, extra }) => {
      localStorage.setItem(
        'career-tools-profile',
        JSON.stringify({ stage: 'student', focus: 'applying', updatedAt: '2026-11-13T00:00:00Z' })
      );
      localStorage.setItem('interview-glow-up-data', JSON.stringify(glow));
      localStorage.setItem(
        'career-applications',
        JSON.stringify({
          version: 1,
          activeId: 'a',
          applications: [
            {
              id: 'a',
              title: 'Library aide',
              company: 'City Library',
              deadline: null,
              roleId: glow.currentRoleId,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        })
      );
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
    },
    { glow, extra }
  );
  return glow.currentRoleId as string;
}

test('item 2: a bullet draft survives a reload, and opening the station writes nothing', async ({
  page,
}) => {
  await seedOne(page);
  await page.goto('/application/?id=a&station=bullets');
  await waitForHydration(page);
  expect(await desks(page)).toBeNull();

  await page
    .getByRole('textbox', { name: 'Pick one experience' })
    .fill('I shelve returned books every Saturday morning.');
  await page.getByRole('button', { name: 'Draft a bullet from what I wrote' }).click();
  await page.getByRole('textbox', { name: 'Verb', exact: true }).fill('Shelved');
  await page
    .getByRole('textbox', { name: 'What happened', exact: true })
    .fill('so the returns cart was empty by noon');
  const drafted = await page.getByTestId('bullet-draft').textContent();

  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('textbox', { name: 'Verb', exact: true })).toHaveValue('Shelved');
  await expect(page.getByRole('textbox', { name: 'What happened', exact: true })).toHaveValue(
    'so the returns cart was empty by noon'
  );
  await expect(page.getByTestId('bullet-draft')).toHaveText(drafted ?? '');
});

test('item 11: the desk reopens on the station last used for that application', async ({
  page,
}) => {
  await seedOne(page);
  await page.goto('/application/?id=a');
  await waitForHydration(page);
  // Opening the desk writes nothing.
  expect(await desks(page)).toBeNull();
  await page.getByRole('tab', { name: /Letter/ }).click();
  await expect.poll(async () => (await desks(page))?.desks?.a?.lastStation ?? null).toBe('letter');

  await page.goto('/application/?id=a');
  await waitForHydration(page);
  await expect(page.getByRole('tab', { name: /Letter/ })).toHaveAttribute('aria-selected', 'true');
  // A station named in the address still wins.
  await page.goto('/application/?id=a&station=bullets');
  await waitForHydration(page);
  await expect(page.getByRole('tab', { name: /Bullets/ })).toHaveAttribute('aria-selected', 'true');
});

test('item 10: a link that names a role opens on it, and an unknown one changes nothing', async ({
  page,
}) => {
  let glow = createRole(createDefaultData(), {
    jobTitle: 'Library aide',
    company: 'City Library',
    rawJdText: 'Library aide',
    bullets: [],
  });
  const first = glow.currentRoleId as string;
  glow = createRole(glow, {
    jobTitle: 'Bike shop helper',
    company: 'Spokes',
    rawJdText: 'Bike shop helper',
    bullets: [],
  });
  await page.goto('/');
  await page.evaluate((data) => {
    localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
  }, glow);
  const before = await readStorage(page, 'interview-glow-up-data');

  // An unknown role: the page opens on the current one and writes nothing.
  await page.goto('/interview-glow-up/workspace/?role=nope');
  await waitForHydration(page);
  await expect(page.getByText('Prepping for')).toBeVisible();
  await expect(page.getByText('Bike shop helper at Spokes').first()).toBeVisible();
  await page.waitForTimeout(600);
  expect(await readStorage(page, 'interview-glow-up-data')).toBe(before);

  // A known role, as a dashboard link opened in a new tab carries it.
  await page.goto(`/interview-glow-up/workspace/?role=${first}`);
  await waitForHydration(page);
  await expect(page.getByText('Library aide at City Library').first()).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}').currentRoleId
    )
    .toBe(first);
  // The rehearsal link from here names it too.
  await expect(page.getByRole('link', { name: 'Rehearse out loud' })).toHaveAttribute(
    'href',
    `/interview-glow-up/rehearse/?role=${first}`
  );
});

test('item 10: the rehearsal room opens on the role in the address', async ({ page }) => {
  let glow = createRole(createDefaultData(), {
    jobTitle: 'Library aide',
    company: 'City Library',
    rawJdText: 'Library aide',
    bullets: [],
  });
  const first = glow.currentRoleId as string;
  glow = createRole(glow, {
    jobTitle: 'Bike shop helper',
    company: 'Spokes',
    rawJdText: 'Bike shop helper',
    bullets: [],
  });
  await page.goto('/');
  await page.evaluate((data) => {
    localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
  }, glow);
  await page.goto(`/interview-glow-up/rehearse/?role=${first}`);
  await waitForHydration(page);
  await expect(page.getByText(/Library aide/).first()).toBeVisible();
  await expect(page.getByText(/Bike shop helper/)).toHaveCount(0);
  await expect
    .poll(
      async () =>
        JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}').currentRoleId
    )
    .toBe(first);
});

test('item 5: the dashboard asks before marking a letter with a placeholder as sent', async ({
  page,
}) => {
  await seedOne(page, {
    'career-application-desk': JSON.stringify({
      version: 1,
      desks: {
        a: {
          letter: {
            hook: 'I shelved books at my school library for two years. [your proof]',
            whyYou: '',
            whyThem: '',
            closingAsk: '',
          },
          updatedAt: 1,
        },
      },
    }),
  });
  await page.goto('/dashboard/');
  await waitForHydration(page);
  await page.getByRole('button', { name: /^Mark as sent/ }).click();
  // It arms in place and names what is open; nothing is marked yet.
  const send = page.getByRole('button', {
    name: /The letter still has \[your proof\]\. Mark as sent anyway/,
  });
  await expect(send).toBeVisible();
  const apps = JSON.parse((await readStorage(page, 'career-applications')) ?? '{}');
  expect(apps.applications[0].sentOn ?? null).toBeNull();
  await send.click();
  await expect
    .poll(
      async () =>
        JSON.parse((await readStorage(page, 'career-applications')) ?? '{}').applications[0].sentOn
    )
    .toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('item 1: a rewrite of a line that appears twice lands on its own line in the .docx', async ({
  page,
}) => {
  const RESUME = `Jordan Lee
jordan.lee@example.edu
Experience
Library aide, City Library, Sep 2024 - Present
- Answered questions at the front desk
- Shelved returned books
Front desk, Campus Gym, Jan 2025 - Present
- Answered questions at the front desk
- Checked member cards at the door
Skills
Excel`;
  const BETTER = 'Answered about 40 member questions a shift at the gym front desk';
  await seedOne(page, {
    'resume-game-session-v2': JSON.stringify({
      resumeText: RESUME,
      bullets: [
        {
          id: 'b1',
          original: '- Answered questions at the front desk',
          improved: '- Answered questions at the front desk',
          edited: false,
        },
        {
          id: 'b2',
          original: '- Shelved returned books',
          improved: '- Shelved returned books',
          edited: false,
        },
        {
          id: 'b3',
          original: '- Answered questions at the front desk',
          improved: BETTER,
          edited: true,
        },
        {
          id: 'b4',
          original: '- Checked member cards at the door',
          improved: '- Checked member cards at the door',
          edited: false,
        },
      ],
      lastAnalyzedAt: null,
    }),
  });
  await page.goto('/application/?id=a&station=resume');
  await waitForHydration(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  const zip = await JSZip.loadAsync(await readFile((await download.path()) as string));
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const lines = [...xml.matchAll(/<w:p>(.*?)<\/w:p>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  );
  const library = lines.findIndex((line) => line.startsWith('Library aide, City Library'));
  const gym = lines.findIndex((line) => line.startsWith('Front desk, Campus Gym'));
  expect(library).toBeGreaterThan(-1);
  expect(gym).toBeGreaterThan(library);
  // The library's line as written; the gym's line rewritten, once.
  const plain = lines.indexOf('Answered questions at the front desk');
  expect(plain).toBeGreaterThan(library);
  expect(plain).toBeLessThan(gym);
  expect(lines.filter((line) => line === BETTER)).toHaveLength(1);
  expect(lines.indexOf(BETTER)).toBeGreaterThan(gym);
  expect(lines.filter((line) => line === 'Answered questions at the front desk')).toHaveLength(1);
});
