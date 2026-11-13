import { expect, test } from '@playwright/test';
import { useStudentProfile, waitForHydration, watchConsoleErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('a student with no resume builds one, sees it scored, and tailors it on the Desk', async ({
  page,
}) => {
  const errors = watchConsoleErrors(page);
  await useStudentProfile(page);

  // The Desk's Resume station, with no resume yet, offers to build one.
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role').fill('Program Assistant');
  await page.getByLabel('Company or organization').fill('Harbor Street Food Bank');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await page.getByRole('tab', { name: /Resume/ }).click();
  const build = page.getByRole('link', { name: 'No resume yet? Build one' });
  await expect(build).toHaveAttribute('href', /^\/resume-game\/\?start=blank/);

  await page.goto('/resume-game/?start=blank');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Build a first resume' })).toBeVisible();
  const step = page.getByTestId('first-resume-step');
  const preview = page.getByTestId('first-resume-preview');

  await page.getByLabel('Your name').fill('Ava Morales');
  await page.getByLabel('Email').fill('ava.morales@example.com');
  await page.getByLabel('City').fill('Riverside, CA');
  await page.getByRole('button', { name: 'Next: School or training' }).click();
  await expect(step).toHaveText('School or training');
  await expect(step).toBeFocused();

  await page.getByLabel('School or program').fill('Riverside High School');
  await page.getByLabel('What you are studying').fill('High school diploma');
  await page.getByLabel('When you finish').fill('June 2027');
  await page.getByRole('button', { name: 'Next: Experience' }).click();
  await expect(step).toHaveText('Experience');

  await page.getByLabel('Your role').fill('Cashier');
  await page.getByLabel('Where').fill('FreshWay Market');
  await page.getByLabel('Started').fill('June 2025');
  await page.getByLabel('I still do this').check();
  const fill = async (
    experience: string,
    line: string,
    verb: string,
    task: string,
    impact = ''
  ) => {
    const group = page.getByRole('group', { name: experience }).getByRole('group', { name: line });
    await group.getByLabel('Action word').fill(verb);
    await group.getByLabel('What you did').fill(task);
    if (impact) await group.getByLabel('What happened because of it').fill(impact);
  };
  await fill(
    'Your experience',
    'Line 1',
    'Counted',
    'my cash drawer at close',
    'my drawer balanced every shift'
  );
  await fill('Your experience', 'Line 2', 'Stocked', 'the dairy shelves before opening');

  await page.getByRole('button', { name: 'Add another experience' }).click();
  await expect(page.locator('#first-resume-exp-1-role')).toBeFocused();
  await page.locator('#first-resume-exp-1-role').fill('Volunteer');
  await page.locator('#first-resume-exp-1-where').fill('Harbor Street Food Bank');
  await page.locator('#first-resume-exp-1-start').fill('2024');
  await page.locator('#first-resume-exp-1-end').fill('2025');
  await fill(
    'Experience 2',
    'Line 1',
    'Made',
    'a sign-up sheet for weekend shifts',
    'new volunteers stopped missing shifts'
  );

  // The preview becomes a resume as it is typed.
  await expect(preview).toContainText('Ava Morales');
  await expect(preview).toContainText(
    'Riverside High School | High school diploma, expected Jun 2027'
  );
  await expect(preview).toContainText('Cashier, FreshWay Market | Jun 2025 - Present');
  await expect(preview).toContainText(
    'Made a sign-up sheet for weekend shifts, so new volunteers stopped missing shifts.'
  );

  await page.getByRole('button', { name: 'Next: Skills' }).click();
  await page.getByLabel('Skills').fill('Spanish, cash handling');
  await page.getByRole('button', { name: 'Use this as my resume' }).click();

  // In the box as if pasted, and every line already scored.
  await expect(page.getByLabel('Paste resume text')).toHaveValue(/^Ava Morales\n/);
  const scored = page.locator('[data-bullet-list] button');
  await expect(scored).toHaveCount(3);
  await expect(scored.first()).toContainText('Counted my cash drawer at close');
  await expect(page.getByRole('button', { name: 'Download .docx' })).toBeVisible();

  // The Desk reads the same resume and lists its bullets for this role.
  await page.goto('/application/?station=resume');
  await waitForHydration(page);
  await expect(page.getByTestId('resume-selection-count')).toContainText(
    '3 of 3 bullets included.'
  );
  await expect(page.getByText('Stocked the dairy shelves before opening.')).toBeVisible();
  await expect(
    page.getByText(
      'Made a sign-up sheet for weekend shifts, so new volunteers stopped missing shifts.'
    )
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  expect(errors).toEqual([]);
});

test('a resume that exists only as text can be saved as a .docx', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'First job' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .docx' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ava-morales-resume.docx');
  await expect(page.getByText('We read the new file back')).toBeVisible();
});
