import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { useStudentProfile, waitForHydration } from './helpers';

const resume = readFileSync(
  new URL('../tests/fixtures/postings/student-resume.txt', import.meta.url),
  'utf8'
);
const posting = readFileSync(
  new URL('../tests/fixtures/postings/student-internship.txt', import.meta.url),
  'utf8'
);

test('a posting is pasted once and worked through the desk, and it survives a reload', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/application/');
  await waitForHydration(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.getByLabel('Role').fill('Data Analytics Intern');
  await page.getByLabel('Company or organization').fill('Larkspur Transit Authority');
  await page.getByRole('button', { name: 'Start this application' }).click();

  // Posting: decoded into requirements that stay next to their sentence.
  await page.getByLabel('Job description').fill(posting);
  await page.getByRole('button', { name: 'Decode the posting' }).click();
  const specimen = page.getByTestId('posting-specimen');
  await expect(specimen.locator('mark').first()).toBeVisible();
  await expect(page.getByTestId('posting-count')).toContainText('0 confirmed');
  await expect(page.getByRole('heading', { name: 'Worth asking about' })).toBeVisible();
  await page.getByRole('button', { name: /^Confirm the required and preferred ones/ }).click();
  await expect(page.getByTestId('posting-count')).not.toContainText('0 confirmed');

  // Qualifications: one row per confirmed requirement, and a dated step.
  await page.getByRole('tab', { name: /Qualifications/ }).click();
  await page.getByRole('radio', { name: 'Have it' }).first().check();
  await page.getByLabel('Next step').fill('Finish the SQL course project');
  await page.getByLabel('Do it by').fill('2027-01-15');
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Done: Finish the SQL course project' })
  ).toBeVisible();

  // Letter: the generic opener is flagged, a specific one is not.
  await page.getByRole('tab', { name: /Letter/ }).click();
  const hook = page.getByLabel(/Name the role with a hook/);
  await hook.fill('I am writing to apply for the Data Analytics Intern position.');
  await expect(page.getByText('This opens the way most letters do.')).toBeVisible();
  await hook.fill(
    'Last spring I cleaned three semesters of survey data for my capstone, and I would like to do that work as Data Analytics Intern at Larkspur Transit Authority.'
  );
  await expect(page.getByText('This opens the way most letters do.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Write the three messages' }).click();
  await expect(page.getByLabel('LinkedIn message')).toHaveValue(/Larkspur Transit Authority/);
  await expect(page.getByText('From the built-in rules').first()).toBeVisible();

  // Before you send: computed from the letter, never guessed.
  await page.getByRole('tab', { name: /Before you send/ }).click();
  await expect(
    page.getByText('Mentions Data Analytics Intern and Larkspur Transit Authority.')
  ).toBeVisible();
  await expect(page.getByText('No closing written yet.')).toBeVisible();

  await page.reload();
  await waitForHydration(page);
  await expect(
    page.getByText('Data Analytics Intern at Larkspur Transit Authority', { exact: true })
  ).toBeVisible();
  await page.getByRole('tab', { name: /Qualifications/ }).click();
  await expect(page.getByRole('radio', { name: 'Have it' }).first()).toBeChecked();

  // The Resume Game compares the resume with this posting: a count, no percentage.
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByLabel('Paste resume text').fill(resume);
  const match = page.getByRole('region', { name: 'Match it to a posting' });
  await expect(match.getByTestId('match-summary')).toHaveText(
    /^\d+ of \d+ confirmed requirements? ha(s|ve) evidence in your resume\.$/
  );
  await expect(match).not.toContainText('%');
  await expect(match.getByText('Your line:').first()).toBeVisible();

  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
});
