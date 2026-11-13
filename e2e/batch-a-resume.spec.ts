import { expect, test } from '@playwright/test';
import { docxBytes, xmlParagraph } from '../tests/fixtures/resume-doc';
import { useStudentProfile, waitForHydration, watchConsoleErrors } from './helpers';

/**
 * Round 3, batch A: the Resume Game and the start-from-nothing form, as a
 * first-job visitor on a phone and as a keyboard visitor on a desktop.
 */

test.describe('a first resume on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a sentence in Action word is split, the past form is offered, and names get capitals', async ({
    page,
  }) => {
    const errors = watchConsoleErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'career-tools-profile',
        JSON.stringify({
          stage: 'student',
          focus: 'resume',
          firstJob: true,
          updatedAt: new Date().toISOString(),
        })
      );
    });
    await page.goto('/resume-game/?start=blank');
    await waitForHydration(page);

    await page.getByLabel('Your name').fill('dani');
    await page.getByLabel('Email').fill('dani@example.com');
    await page.getByRole('button', { name: 'Next: School or training' }).click();
    // A first job sees a high school example.
    await expect(page.getByLabel('School or program')).toHaveAttribute(
      'placeholder',
      'Roosevelt High School'
    );
    await page.getByLabel('School or program').fill('roosevelt high');
    await page.getByRole('button', { name: 'Next: Experience' }).click();

    await page.locator('#first-resume-exp-0-kind').click();
    await page.getByRole('option', { name: 'Babysitting or pet sitting' }).click();
    await page.getByLabel('Your role').fill('babysitter');
    await page.getByLabel('Started').fill('2024');
    await page.getByLabel('Ended', { exact: true }).fill('2025');

    const line = page.getByRole('group', { name: 'Line 1' });
    await line.getByLabel('Action word').fill('i watch my cousin after school');
    await line.getByLabel('Action word').press('Tab');
    await expect(line.getByLabel('Action word')).toHaveValue('watch');
    await expect(line.getByLabel('What you did')).toHaveValue('my cousin after school');
    await expect(line.getByText('Moved here from Action word')).toBeVisible();

    await line.getByRole('button', { name: 'Use Watched' }).click();
    await expect(line.getByLabel('Action word')).toHaveValue('Watched');
    await expect(line.getByText('Reads: Watched my cousin after school.')).toBeVisible();

    await page.getByRole('button', { name: 'Next: Skills' }).click();
    const capitals = page.getByTestId('capital-check');
    await expect(capitals).toContainText('Dani');
    await expect(capitals).toContainText('Roosevelt High');
    await expect(capitals).toContainText('Babysitter');
    await capitals.getByRole('button', { name: 'Fix them' }).click();
    await expect(capitals).toHaveCount(0);
    await expect(page.getByTestId('first-resume-preview')).toContainText('Dani');

    await page.getByRole('button', { name: 'Use this as my resume' }).click();
    const scored = page.locator('[data-bullet-list] button');
    await expect(scored.first()).toContainText('Watched my cousin after school.');
    await expect(page.getByText('Opens with what you did: "Watched".')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('typing the past form never doubles the first word, and the score says so', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByLabel('Paste resume text').fill('- Watch my cousin after school.');
  await page.getByRole('button', { name: 'Analyze resume' }).click();
  await expect(page.getByText('Opens with what you did: "Watch".')).toBeVisible();

  await page.getByLabel('What you did (first word)').fill('Watched');
  await page.getByLabel('What happened because of it').fill('so my aunt can go to work');
  const now = page.getByText('Your line now').locator('..');
  await expect(now).toContainText('Watched my cousin after school, so my aunt can go to work.');
  await expect(now).not.toContainText('Watched Watch');
});

test('a sample asks before replacing the visitor resume, and puts it back', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  const box = page.getByLabel('Paste resume text');
  await box.fill('Dani Reyes\n- Watched my cousin after school.');

  await page.getByRole('button', { name: 'First job' }).click();
  await expect(box).toHaveValue(/Dani Reyes/);
  await page
    .getByRole('button', { name: 'Replace your resume with the first job sample?' })
    .click();
  await expect(box).toHaveValue(/Ava Morales/);
  await page.getByRole('button', { name: 'Put my resume back' }).click();
  await expect(box).toHaveValue('Dani Reyes\n- Watched my cousin after school.');
});

test('a career break, personal details, and a summary each get a plain note', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByLabel('Paste resume text').fill(
    [
      'Renee Alvarado',
      'Date of Birth: 1985/03/14 | Nationality: US',
      '',
      'SUMMARY',
      'Dedicated, hard-working team player seeking an operations role.',
      '',
      'EXPERIENCE',
      'Store Manager, Brightline Home Goods',
      'March 2018 - February 2026',
      '- Rebuilt the weekly schedule, so every shift was covered without overtime.',
      '',
      'Family Caregiver',
      'March 2026 - October 2026',
      '- Full-time caregiver for a parent after surgery',
    ].join('\n')
  );
  await page.getByRole('button', { name: 'Analyze resume' }).click();
  await expect(page.getByTestId('career-break-note')).toContainText(
    'A career break, stated plainly. It is not scored, and there is nothing to rewrite.'
  );
  await expect(page.locator('[data-bullet-list]')).not.toContainText('Full-time caregiver');
  await expect(page.getByTestId('personal-details-note')).toContainText(
    'This resume lists date of birth and nationality.'
  );
  await expect(page.getByTestId('summary-note')).toContainText('"team player"');
});

test('Suggest a rewrite keeps keyboard focus while it writes', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByLabel('Paste resume text').fill('- Responsible for social media');
  await page.getByRole('button', { name: 'Analyze resume' }).click();
  const suggest = page.getByRole('button', { name: 'Suggest a rewrite' });
  await suggest.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Suggest another|Writing/ })).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
});

test('the machine view retypes a damaged line and names a missing heading, with undo', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  const bytes = await docxBytes(
    [
      'Avery Chen',
      'avery@example.edu',
      'EXPERIENCE',
      'Library Assistant, Campus Library | Jan 2024 - Present',
      'Rebuilt the room sign-up form, so more students could reserve rooms.',
      'Things I know',
      'P y t h o n, Excel',
    ]
      .map((line) => xmlParagraph(line))
      .join('')
  );
  await page.getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)').setInputFiles({
    name: 'avery.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from(bytes),
  });
  const view = page.getByRole('region', { name: 'Machine view' });
  await expect(view).toBeVisible();

  await view.getByRole('button', { name: 'Retype this line' }).click();
  await view.getByLabel('The line as it should read').fill('Python, Excel');
  await view.getByRole('button', { name: 'Use this wording' }).click();
  await expect(view.getByRole('status')).toHaveText('Line replaced.');
  await expect(view.getByText(/spaced-out letters/)).toHaveCount(0);

  await view.getByRole('button', { name: 'Undo the last repair' }).click();
  await expect(view.getByRole('status')).toHaveText('Undone: Line replaced.');
  await expect(view.getByText(/spaced-out letters/).first()).toBeVisible();

  await view.getByLabel('Is one of these your skills heading?').selectOption({
    label: 'Things I know',
  });
  await view.getByRole('button', { name: 'Rename it Skills' }).click();
  await expect(view.getByRole('status')).toHaveText('"Things I know" now reads Skills.');
  await expect(view.getByText('No heading we recognize for skills.')).toHaveCount(0);
});
