import { expect, type Page, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

/** Applications, a decoded role and Pay worksheets, as the tools would have saved them. */
async function seedPriya(page: Page) {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('career-applications')) return;
    const blank = {
      basePay: null,
      payPeriod: null,
      guaranteedBonus: null,
      variablePay: null,
      hoursPerWeek: null,
      weeksPerYear: null,
      overtimeHoursPerWeek: null,
      notes: '',
      wageSource: '',
      wageSourceDate: null,
    };
    const desk = (offer: object) => ({
      qualifications: [],
      actionPlan: [],
      bullets: { experience: '', impact: '', bullets: [], reflection: '' },
      letter: {
        hook: '',
        whyYou: '',
        whyThem: '',
        closingAsk: '',
        recipient: '',
        sender: '',
        messages: { linkedin: null, 'follow-up-email': null, 'intro-call': null },
      },
      checklist: {},
      offer: { ...blank, ...offer },
      resumeSelection: null,
      updatedAt: 1,
    });
    window.localStorage.setItem(
      'career-applications',
      JSON.stringify({
        version: 1,
        activeId: 'pharm',
        applications: [
          // Added in Pay: no saved link to the posting decoded in the workspace.
          {
            id: 'tech',
            title: 'Research Technician I',
            company: 'Halvorsen Institute',
            deadline: null,
            roleId: null,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'pharm',
            title: 'Pharmacy technician',
            company: 'Northside Pharmacy',
            deadline: null,
            roleId: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      })
    );
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'r-tech',
            jobTitle: 'Research Technician I',
            company: 'Halvorsen Institute',
            rawJdText:
              'Run PCR on submitted samples\nSalary range: $44,000 to $48,000 per year\nFull time, 40 hours per week',
            bullets: [
              {
                id: 'b1',
                text: 'Run PCR on submitted samples',
                status: 'active',
                primarySkillId: null,
                secondarySkillIds: [],
                suggestion: [],
              },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        stories: [],
        packets: [],
        currentRoleId: 'r-tech',
        currentPacketId: null,
      })
    );
    window.localStorage.setItem(
      'career-application-desk',
      JSON.stringify({
        version: 1,
        desks: {
          pharm: desk({ basePay: 19.5, payPeriod: 'hour', hoursPerWeek: 40, weeksPerYear: 52 }),
        },
      })
    );
  });
}

test('Pay takes the posting range, counts a signing bonus once, and records an answer-by date', async ({
  page,
}) => {
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await useStudentProfile(page);
  await seedPriya(page);

  // The posting decoded in the workspace reaches the offer added in Pay.
  await page.goto('/pay/?id=tech');
  await waitForHydration(page);
  const fromPosting = page.getByTestId('posting-pay');
  await expect(fromPosting).toContainText('Salary range: $44,000 to $48,000 per year');
  await fromPosting.getByRole('button', { name: 'Use the figures from the posting' }).click();
  await expect(fromPosting).toHaveCount(0);
  await page.getByLabel('Weeks a year').fill('52');
  const results = page.locator('[data-guide="offer-results"]');
  await expect(results).toContainText('$21.15 to $23.08 an hour');
  await expect(results).toContainText('$44,000 to $48,000 a year');

  // The pharmacy offer: a one-time bonus is the first year only.
  await page.getByLabel('Save with').selectOption('pharm');
  await page.getByLabel('One-time bonus').fill('1000');
  const row = (term: string) => results.locator('dt', { hasText: term }).locator('+ dd');
  await expect(row('First year, with the one-time bonus')).toHaveText('$41,560 a year');
  await expect(row('Each year after')).toHaveText('$40,560 a year');
  await expect(row('A month')).toHaveText('$3,380 a month');

  await page.getByLabel('I have this offer and need to answer it').check();
  await page.getByLabel('Answer by').fill('2030-01-18');
  const deciding = page.getByTestId('offer-deciding');
  await expect(deciding).toContainText(
    'Pharmacy technician at Northside Pharmacy: answer by Jan 18'
  );
  await expect(deciding).toContainText('Could I give you my answer by');

  // Side by side fits the screen either way: cards on a phone, a table on a wider one.
  const compare = page.getByTestId('offer-compare');
  const cards = page.getByTestId('offer-compare-cards');
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await expect(cards).toBeVisible();
    await expect(cards).toContainText('$1,000 once');
    await expect(compare).toBeHidden();
  } else {
    await expect(compare).toBeVisible();
    await expect(compare.getByRole('columnheader', { name: 'One-time' })).toBeVisible();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Kept after a reload, and nothing asked for a file that is not there.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByLabel('Save with')).toHaveValue('pharm');
  await expect(page.getByLabel('One-time bonus')).toHaveValue('1000');
  await expect(page.getByLabel('Answer by')).toHaveValue('2030-01-18');
  expect(failed).toEqual([]);
});

test('the dashboard reads the offer, the matched posting and where the visitor left off', async ({
  page,
}) => {
  await useStudentProfile(page);
  await seedPriya(page);
  await page.goto('/pay/?id=pharm');
  await waitForHydration(page);
  await page.getByLabel('I have this offer and need to answer it').check();
  await page.getByLabel('Answer by').fill('2030-01-18');

  await page.goto('/dashboard/');
  await waitForHydration(page);
  const leftOff = page.getByTestId('left-off');
  await expect(leftOff).toContainText('The pay for Pharmacy technician at Northside Pharmacy');
  await expect(leftOff.getByRole('link', { name: 'Pick it up' })).toHaveAttribute(
    'href',
    '/pay/?id=pharm'
  );

  const pharmacy = page.locator('li[id="app-row-pharm"]');
  await expect(pharmacy.getByText('Offer in hand')).toBeVisible();
  await expect(pharmacy.getByText('Paste the posting on the desk')).toHaveCount(0);
  await expect(pharmacy.getByRole('link', { name: 'Weigh it in Pay' })).toBeVisible();

  // The technician posting was decoded in the workspace; the dashboard says so.
  const tech = page.locator('li[id="app-row-tech"]');
  await expect(tech.getByText('Posting decoded')).toBeVisible();

  // A rep is said once, for every application.
  await expect(page.getByTestId('shared-readiness')).toContainText(
    'These count for every application.'
  );

  // "Not applying" keeps the work and moves the row to the end.
  await tech.getByRole('button', { name: /^Not applying\s*: Research Technician I$/ }).click();
  await page.getByLabel('Why not (optional)').fill('The other one pays sooner');
  await page.getByRole('button', { name: 'Set it aside' }).click();
  await expect(tech).toContainText('The other one pays sooner. Its work is kept.');
  const ids = await page.locator('li[id^="app-row-"]').evaluateAll((rows) => rows.map((r) => r.id));
  expect(ids).toEqual(['app-row-pharm', 'app-row-tech']);
  const stored = JSON.parse((await readStorage(page, 'career-applications')) ?? '{}');
  expect(stored.applications.find((a: { id: string }) => a.id === 'tech').setAside.reason).toBe(
    'The other one pays sooner'
  );
});

test('a recommendation opens the rehearsal for the application it names', async ({ page }) => {
  await useStudentProfile(page);
  await page.addInitScript(() => {
    if (window.localStorage.getItem('career-applications')) return;
    const role = (id: string, jobTitle: string, company: string) => ({
      id,
      jobTitle,
      company,
      rawJdText: 'Shelve returned books\nHelp patrons find what they need',
      bullets: [
        {
          id: `${id}-b`,
          text: 'Help patrons find what they need',
          status: 'active',
          primarySkillId: null,
          secondarySkillIds: [],
          suggestion: [],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          role('r-a', 'Library role', 'Library'),
          role('r-b', 'Other employer role', 'Other Company'),
        ],
        stories: [],
        packets: [],
        // The workspace was last on the other role.
        currentRoleId: 'r-b',
        currentPacketId: null,
      })
    );
    window.localStorage.setItem(
      'career-applications',
      JSON.stringify({
        version: 1,
        activeId: 'a',
        applications: [
          {
            id: 'a',
            title: 'Library role',
            company: 'Library',
            deadline: null,
            roleId: 'r-a',
            sentOn: '2026-11-01',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      })
    );
  });
  await page.goto('/dashboard/');
  await waitForHydration(page);
  await page
    .getByRole('link', { name: /"Library role at Library" was sent .* Practice for the interview/ })
    .click();
  await page.waitForURL('**/interview-glow-up/rehearse/?role=r-a');
  await waitForHydration(page);
  const glow = JSON.parse((await readStorage(page, 'interview-glow-up-data')) ?? '{}');
  expect(glow.currentRoleId).toBe('r-a');
  await expect(page.getByText(/Library role/).first()).toBeVisible();
  await expect(page.getByText(/Other employer role/)).toHaveCount(0);
});
