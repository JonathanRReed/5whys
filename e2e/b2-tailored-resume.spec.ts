import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import JSZip from 'jszip';
import { createDefaultData, createRole } from '../src/lib/glowup-store';
import {
  addRequirement,
  bulletsFromRequirements,
  type PostingRequirement,
} from '../src/lib/posting';
import { readStorage, waitForHydration, watchConsoleErrors } from './helpers';

const RESUME = `Marcus Bell
Riverside, CA | marcus.bell.student@example.com
Education
Inland Valley Community College, Associate in Business Administration, expected May 2027
Experience
Cashier, Valley Fresh Market, Aug 2023 - Present
- Responsible for helping customers
- Handled the cash register and counted the drawer
- Stocked shelves and did other tasks when needed
Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present
- In charge of club money
- Helped plan events and fundraisers
Skills
Excel, customer service, teamwork, hard worker`;

const DRAWER =
  'Ran a cash register and counted the drawer at close, so the drawer balanced at the end of my shifts.';
const CLUB =
  'Tracked the Business Club budget, dues and receipts in a shared Excel sheet, so officers knew what was left before planning each event.';
const DESK_CLUB =
  'Tracked the Business Club budget, dues and receipts in Excel and gave a money report at each monthly meeting';
const DESK_DRAWER =
  'Balanced my register drawer at close at Valley Fresh Market and answered customer questions at the front registers';
const LINES = ['Experience with Microsoft Excel', 'Strong attention to detail'];

/** Marcus, as he left things: a posting, two rewritten lines, two desk bullets. */
async function seed(page: Page, deskBullets: string[]) {
  const requirements = LINES.reduce<PostingRequirement[]>(
    (list, line) => addRequirement(list, line),
    []
  );
  const glow = createRole(createDefaultData(), {
    jobTitle: 'Operations Intern',
    company: 'Coastline Supply Co.',
    rawJdText: LINES.join('\n'),
    parsedJdText: LINES.join('\n'),
    bullets: bulletsFromRequirements(requirements),
  });
  await page.goto('/');
  await page.evaluate(
    ({ glow, resume, drawer, club, deskBullets }) => {
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
              title: 'Operations Intern',
              company: 'Coastline Supply Co.',
              deadline: null,
              roleId: glow.currentRoleId,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        })
      );
      localStorage.setItem(
        'resume-game-session-v2',
        JSON.stringify({
          resumeText: resume,
          bullets: [
            {
              original: '- Handled the cash register and counted the drawer',
              improved: drawer,
              edited: true,
            },
            { original: '- In charge of club money', improved: club, edited: true },
          ],
          lastAnalyzedAt: null,
        })
      );
      localStorage.setItem(
        'career-application-desk',
        JSON.stringify({
          version: 1,
          desks: {
            a: {
              bullets: {
                experience: '',
                impact: '',
                reflection: '',
                bullets: [0, 1].map((i) => ({
                  bulletId: null,
                  text: deskBullets[i] ?? '',
                  included: true,
                })),
              },
            },
          },
        })
      );
    },
    { glow, resume: RESUME, drawer: DRAWER, club: CLUB, deskBullets }
  );
}

/** The paragraphs of a downloaded .docx, read from its document.xml. */
async function docxLines(path: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(await readFile(path));
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  return [...xml.matchAll(/<w:p>(.*?)<\/w:p>/g)].map((match) =>
    match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  );
}

test('the tailored resume puts each line under its job, once, and says what is in it', async ({
  page,
}) => {
  const errors = watchConsoleErrors(page);
  await seed(page, [DESK_CLUB, DESK_DRAWER]);
  await page.goto('/application/?id=a&station=resume');
  await waitForHydration(page);

  // The rewritten club line names Excel, so it answers the posting.
  await expect(page.getByTestId('resume-selection-count')).toContainText(
    '1 mention a confirmed requirement'
  );
  await expect(page.getByTestId('desk-bullet-place-note-0')).toContainText(
    'Under Treasurer, Business Club'
  );
  await expect(page.getByTestId('desk-bullet-place-note-1')).toContainText(
    'Under Cashier, Valley Fresh Market'
  );

  // Both say what a resume line already says. Each takes that line's place.
  for (const slot of [0, 1]) {
    const repeat = page.getByTestId(`desk-bullet-repeat-${slot}`);
    await expect(repeat).toContainText('If both describe the same work, keep one.');
    await repeat.getByRole('button', { name: 'Use this one in its place' }).click();
    await expect(repeat).toHaveCount(0);
  }
  const summary = page.getByTestId('resume-copy-summary');
  await expect(summary).toContainText('3 of 5 bullets from your resume');
  await expect(summary).toContainText('Bullet 1 written on this desk, under Treasurer');
  await expect(summary).toContainText('Bullet 2 written on this desk, under Cashier');
  await expect(summary).not.toContainText('says much the same');

  // The page shows the file line by line before it is downloaded.
  await page.getByText('Read the file line by line').click();
  const preview = page.getByTestId('resume-copy-preview');
  await expect(preview).toContainText(DESK_CLUB);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  await expect(page.getByRole('status').last()).toContainText(
    'Open it and read it once before you send it.'
  );
  const lines = await docxLines((await download.path()) as string);
  const cashier = lines.findIndex((line) => line.startsWith('Cashier, Valley Fresh Market'));
  const treasurer = lines.findIndex((line) => line.startsWith('Treasurer, Business Club'));
  const skills = lines.indexOf('Skills');
  expect(cashier).toBeGreaterThan(-1);
  expect(treasurer).toBeGreaterThan(cashier);
  // Each desk bullet under its own job.
  expect(lines.indexOf(DESK_DRAWER)).toBeGreaterThan(cashier);
  expect(lines.indexOf(DESK_DRAWER)).toBeLessThan(treasurer);
  expect(lines.indexOf(DESK_CLUB)).toBeGreaterThan(treasurer);
  expect(lines.indexOf(DESK_CLUB)).toBeLessThan(skills);
  // The lines they replace are not in the file, and no line is in it twice.
  expect(lines).not.toContain(DRAWER);
  expect(lines).not.toContain(CLUB);
  expect(lines).not.toContain('In charge of club money');
  const filled = lines.filter((line) => line.trim());
  expect(new Set(filled).size).toBe(filled.length);
  // The page's preview is the file.
  const shown = (await preview.locator('p').allTextContents()).map((line) =>
    line.replace(/^• /, '').replace(/ \(written on this desk\)$/, '')
  );
  expect(shown).toEqual(filled);
  expect(errors).toEqual([]);
});

test('a desk bullet that names no job stays out until the visitor places it', async ({ page }) => {
  await seed(page, ['Answered phones for the front office during the lunch rush']);
  await page.goto('/application/?id=a&station=resume');
  await waitForHydration(page);
  await expect(page.getByTestId('resume-copy-summary')).toContainText(
    'Not in it: bullet 1 written on this desk, until you choose where it goes.'
  );
  await page
    .getByLabel(/Which part of your resume is this from/)
    .selectOption({ label: 'Cashier, Valley Fresh Market, Aug 2023 - Present' });
  await expect(page.getByTestId('desk-bullet-place-note-0')).toContainText(
    'Under Cashier, Valley Fresh Market, Aug 2023 - Present, after its last line.'
  );
  const saved = JSON.parse((await readStorage(page, 'career-application-desk')) ?? '{}');
  expect(saved.desks.a.bullets.bullets[0].bulletId).toBeTruthy();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  const lines = await docxLines((await download.path()) as string);
  const phones = lines.indexOf('Answered phones for the front office during the lunch rush');
  expect(phones).toBeGreaterThan(lines.indexOf('Stocked shelves and did other tasks when needed'));
  expect(phones).toBeLessThan(lines.findIndex((line) => line.startsWith('Treasurer')));
});

test('the Bullets station starts from a resume line and drafts from its verb', async ({ page }) => {
  await seed(page, []);
  await page.goto('/application/?id=a&station=bullets');
  await waitForHydration(page);
  await page
    .getByLabel('Start from a line on your resume')
    .selectOption({ label: CLUB.slice(0, 77).trimEnd() + '...' });
  await page.getByRole('button', { name: 'Use this line' }).click();
  await expect(page.getByRole('textbox', { name: 'Pick one experience' })).toHaveValue(CLUB);

  // Written in the first person, with "am" before the action.
  await page
    .getByRole('textbox', { name: 'Pick one experience' })
    .fill('I am the treasurer of the Business Club. I keep the club budget in Excel.');
  await page.getByRole('button', { name: 'Draft a bullet from what I wrote' }).click();
  await expect(page.getByTestId('bullet-draft')).toHaveText('Keep the club budget in Excel.');
  await expect(page.getByText('No verb was found')).toHaveCount(0);
});
