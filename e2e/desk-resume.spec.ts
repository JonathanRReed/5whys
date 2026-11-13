import { expect, test } from '@playwright/test';
import { singleColumnPdf } from '../tests/fixtures/resume-doc';
import { useStudentProfile, waitForHydration } from './helpers';

test('an application keeps its own selection of bullets from the one resume', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role').fill('Program Assistant');
  await page.getByLabel('Company or organization').fill('Harbor Street Food Bank');
  await page.getByRole('button', { name: 'Start this application' }).click();

  // With no resume uploaded, the station says where to add one.
  await page.getByRole('tab', { name: /Resume/ }).click();
  await expect(page.getByRole('link', { name: 'Open the Resume Game' })).toBeVisible();

  await page.goto('/resume-game/');
  await waitForHydration(page);
  const file = singleColumnPdf();
  await page.getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)').setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await expect(page.getByRole('region', { name: 'Machine view' })).toBeVisible();

  await page.goto('/application/?station=resume');
  await waitForHydration(page);
  const count = page.getByTestId('resume-selection-count');
  await expect(count).toContainText(/^(\d+) of \1 bullets included\./);

  // Leaving one out is remembered for this application only.
  await page.getByRole('checkbox').first().uncheck();
  await expect(count).not.toContainText(/^(\d+) of \1 bullets included\./);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the resume for this role (.docx)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    'resume-program-assistant-harbor-street-food-bank.docx'
  );
  await expect(page.getByRole('status').last()).toContainText(
    'Open it and read it once before you send it.'
  );
});
