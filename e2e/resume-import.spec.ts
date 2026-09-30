import { expect, test } from '@playwright/test';
import { japanesePdfFile, pdfFile } from '../tests/fixtures/resume-pdfs';
import { useStudentProfile, waitForHydration } from './helpers';

test('a PDF is read locally for review, and a bad retry preserves the resume', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  const requests: Array<{ url: string; method: string }> = [];
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
  const input = page.getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)');
  const textarea = page.getByLabel('Paste resume text');
  const file = pdfFile(
    'BT /F1 12 Tf 72 720 Td (Jordan Lee) Tj 0 -24 Td (- Built 3 tools for a student team.) Tj ET'
  );
  await input.setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await expect(textarea).toHaveValue('Jordan Lee\n- Built 3 tools for a student team.');
  await expect(page.locator('[data-bullet-list] button')).toHaveCount(0);
  await input.setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 invalid bytes'),
  });
  await expect(page.getByRole('alert')).toContainText('Could not read this PDF');
  await expect(textarea).toHaveValue('Jordan Lee\n- Built 3 tools for a student team.');
  const revised = pdfFile('BT /F1 12 Tf 72 720 Td (Jordan Lee revised resume) Tj ET');
  await input.setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await revised.arrayBuffer()),
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(textarea).toHaveValue('Jordan Lee revised resume');
  const origin = new URL(page.url()).origin;
  expect(
    requests.every((request) => request.method === 'GET' && new URL(request.url).origin === origin)
  ).toBe(true);
  expect(requests.some((request) => request.url.includes('pdf.worker'))).toBe(true);
});

test('a PDF loads its Japanese character maps from the local build', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);
  const file = japanesePdfFile();
  await page.getByLabel('Upload resume file (PDF, DOCX, TXT, or Markdown)').setInputFiles({
    name: file.name,
    mimeType: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await expect(page.getByLabel('Paste resume text')).toHaveValue(
    'English resume heading\nこんにちは'
  );
});
