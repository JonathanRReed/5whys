import { expect, test } from '@playwright/test';
import { columnPdf, singleColumnPdf } from '../tests/fixtures/resume-doc';
import { useStudentProfile, waitForHydration } from './helpers';

const upload = async (file: File) => ({
  name: 'resume.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(await file.arrayBuffer()),
});

test('a two-column resume is shown as read, repaired, and exported without leaving the device', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  const input = page.getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)');
  await input.setInputFiles(await upload(columnPdf()));

  const view = page.getByRole('region', { name: 'Machine view' });
  await expect(view).toBeVisible();
  // No score, only counted findings.
  await expect(view.getByTestId('machine-summary')).toContainText(/to (fix|check)/);
  await expect(view).not.toContainText(/%|\/100|score of/i);
  await expect(view.getByText('This looks like columns. Check the order below.')).toBeVisible();

  // Both the column and the reading-order findings offer this repair.
  await view.getByRole('button', { name: 'Put it in one column' }).first().click();
  await expect(view.getByRole('status')).toHaveText('Reordered into one column.');
  await expect(view.getByText('This looks like columns. Check the order below.')).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    view.getByRole('button', { name: 'Download clean .docx' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('resume-clean.docx');
  await expect(view.getByRole('status')).toContainText('We read the new file back');

  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => url.startsWith('blob:') || new URL(url).origin === origin)).toBe(
    true
  );
});

test('a clean single-column resume has nothing to fix', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page
    .getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)')
    .setInputFiles(await upload(singleColumnPdf()));
  const view = page.getByRole('region', { name: 'Machine view' });
  await expect(view.getByTestId('machine-summary')).toHaveText(
    'Nothing to fix in how this file reads.'
  );
});
