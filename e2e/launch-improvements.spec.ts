import { expect, type Page, test } from '@playwright/test';
import { createDefaultData, createRole } from '../src/lib/glowup-store';
import {
  addRequirement,
  bulletsFromRequirements,
  type PostingRequirement,
} from '../src/lib/posting';
import { readStorage, waitForHydration } from './helpers';

const LINES = [
  "Must be at least 18 and have a valid driver's license",
  'Customer service experience',
  'Experience with Excel or Google Sheets',
];

const RESUME = `Maya Torres
maya@example.edu

Skills
- Excel

Experience
FreshWay Market, Cashier, 2025 to present
- Handled cash and card payments at a busy register
- Tracked weekly inventory counts in Excel

Education
Lakeshore Community College, expected May 2027`;

/** One application with a decoded posting, a resume, and desk work, as a visitor leaves them. */
async function seedDesk(page: Page, desk: Record<string, unknown> = {}) {
  const requirements = LINES.reduce<PostingRequirement[]>(
    (list, line) => addRequirement(list, line),
    []
  );
  const glow = createRole(createDefaultData(), {
    jobTitle: 'Summer Operations Intern',
    company: 'Cedar Valley Parks',
    rawJdText: LINES.join('\n'),
    parsedJdText: LINES.join('\n'),
    bullets: bulletsFromRequirements(requirements),
  });
  await page.goto('/');
  await page.evaluate(
    ({ glow, desk, resume }) => {
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
              title: 'Summer Operations Intern',
              company: 'Cedar Valley Parks',
              deadline: '2020-01-10',
              roleId: glow.currentRoleId,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        })
      );
      localStorage.setItem(
        'resume-game-session-v2',
        JSON.stringify({ resumeText: resume, bullets: [], lastAnalyzedAt: null })
      );
      localStorage.setItem(
        'career-application-desk',
        JSON.stringify({ version: 1, desks: { a: desk } })
      );
    },
    { glow, desk, resume: RESUME }
  );
  return requirements;
}

test('bullets written on the desk are in the tailored resume, under the job', async ({ page }) => {
  await seedDesk(page, {
    bullets: {
      experience: '',
      impact: '',
      reflection: '',
      bullets: [
        {
          bulletId: null,
          text: 'Balanced my register drawer at the end of every shift',
          included: true,
        },
        { bulletId: null, text: '', included: true },
      ],
    },
  });
  await page.goto('/application/?id=a&station=resume');
  await waitForHydration(page);
  const written = page.getByRole('checkbox', { name: /Balanced my register drawer/ });
  await expect(written).toBeChecked();
  const box = await written.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  await expect(page.getByLabel(/Place it after/)).toContainText('Tracked weekly inventory');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await readFile(path));
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const text = xml.replace(/<[^>]+>/g, '\n');
  const lines = text.split('\n').filter((line) => line.trim());
  const drawer = lines.indexOf('Balanced my register drawer at the end of every shift');
  expect(drawer).toBeGreaterThan(lines.indexOf('Tracked weekly inventory counts in Excel'));
  expect(drawer).toBeLessThan(lines.indexOf('Education'));
});

test('the letter uses the proof already written and shows whole', async ({ page }) => {
  await seedDesk(page);
  // Mark "have it" with proof on the Qualifications station, as a visitor would.
  await page.goto('/application/?id=a&station=qualifications');
  await waitForHydration(page);
  const service = page.getByRole('listitem').filter({ hasText: 'Customer service experience' });
  await service.getByRole('radio', { name: 'Have it' }).check();
  await service
    .getByLabel(/Plan for/)
    .fill('Cashier at FreshWay Market since 2025, I help customers every shift');

  await page.getByRole('tab', { name: /Letter/ }).click();
  await page.getByRole('button', { name: 'Start from what you marked "have it"' }).click();
  await expect(page.getByLabel(/Why you/)).toHaveValue(
    'Customer service experience: Cashier at FreshWay Market since 2025, I help customers every shift.'
  );
  await page.getByLabel(/Name the role with a hook/).fill('I kept the weekly counts at FreshWay.');
  const preview = page.getByTestId('letter-preview').first();
  await expect(preview).toContainText('Dear Hiring Team,');
  await expect(preview).toContainText('Sincerely,');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download as .docx' }).first().click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    'letter-summer-operations-intern-cedar-valley-parks.docx'
  );
});

test('a sent application is never late on the dashboard', async ({ page }) => {
  await seedDesk(page);
  await page.goto('/application/?id=a&station=send');
  await waitForHydration(page);
  await page
    .getByRole('region', { name: 'Sent it?' })
    .getByRole('button', { name: /Mark as sent/ })
    .click();
  await expect
    .poll(async () => JSON.parse((await readStorage(page, 'career-applications')) ?? '{}'))
    .toMatchObject({ applications: [{ sentOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }] });

  await page.goto('/dashboard/');
  await waitForHydration(page);
  await expect(page.getByText(/^Sent [A-Z][a-z]{2} \d+/).first()).toBeVisible();
  await expect(page.getByText(/days past|past its deadline|deadline has passed/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'the thank-you note' })).toBeVisible();
});

test('Pay names a summer total by its weeks and compares another offer', async ({ page }) => {
  await seedDesk(page);
  await page.goto('/pay/');
  await waitForHydration(page);
  await expect(page.getByLabel('Save with')).toHaveValue('a');
  await page.getByLabel('Base pay').fill('17');
  await page.getByLabel('Paid').selectOption('hour');
  await page.getByLabel('Hours a week').fill('25');
  await page.getByLabel('Weeks a year').fill('10');
  const results = page.locator('[data-guide="offer-results"]');
  await expect(results).toContainText('$425 a week');
  await expect(results).toContainText('$4,250 over 10 weeks');
  await expect(results).not.toContainText('a year');
  await expect(results).toContainText('before taxes');

  await page.getByRole('button', { name: 'Add another offer' }).click();
  await page.getByLabel('Role', { exact: true }).fill('Camp counselor');
  await page.getByRole('button', { name: 'Add it' }).click();
  await page.getByLabel('Base pay').fill('15');
  await page.getByLabel('Paid').selectOption('hour');
  await page.getByLabel('Hours a week').fill('45');
  await expect(page.getByTestId('overtime-hint')).toBeVisible();
  await page.getByLabel('Weeks a year').fill('8');
  const table = page.getByTestId('offer-compare');
  await expect(table.getByRole('columnheader', { name: 'Hours a week' })).toBeVisible();
  await expect(table).toContainText('$4,250 over 10 weeks');

  await page.getByLabel('Base pay').fill('62.000');
  await expect(page.getByText('Did you mean 62,000 or 62?')).toBeVisible();
});
