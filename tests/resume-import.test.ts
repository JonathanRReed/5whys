// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractTextFromFile } from '../src/lib/resume-game/extractors';
import { japanesePdfFile, pdfFile } from './fixtures/resume-pdfs';

describe('resume file import', () => {
  it.each([true, false])(
    'reads actual PDF text and preserves lines (compressed=%s)',
    async (compressed) => {
      const file = pdfFile(
        'BT /F1 12 Tf 72 720 Td (Jordan Lee) Tj 0 -24 Td (EXPERIENCE) Tj 0 -24 Td (- Built 3 tools for a student team.) Tj 0 -24 Td (- Trained 12 classmates on safe AI use.) Tj ET',
        compressed
      );
      const text = await extractTextFromFile(file);
      expect(text.split('\n').filter(Boolean)).toEqual([
        'Jordan Lee',
        'EXPERIENCE',
        '- Built 3 tools for a student team.',
        '- Trained 12 classmates on safe AI use.',
      ]);
      expect(text).not.toMatch(/endstream|BaseFont|FlateDecode|\/F1|720 Td/);
    }
  );

  it('does not mistake a PDF without a text layer for resume content', async () => {
    await expect(extractTextFromFile(pdfFile('0 0 0 rg 0 0 100 100 re f'))).rejects.toThrow(
      /selectable text|text layer/i
    );
  });

  it('rejects corrupt PDF bytes instead of scoring file syntax', async () => {
    await expect(
      extractTextFromFile(
        new File(['%PDF-1.7\n' + 'not a valid document '.repeat(40)], 'broken.pdf')
      )
    ).rejects.toThrow(/PDF/i);
  });

  it('rejects unsupported formats without reading binary bytes as text', async () => {
    await expect(extractTextFromFile(new File(['binary document'], 'resume.doc'))).rejects.toThrow(
      /supported|PDF, DOCX/i
    );
  });

  it('preserves plain text and Unicode', async () => {
    const text = 'José Lee\n• Built an accessibility tool\n• Taught résumé writing';
    expect(await extractTextFromFile(new File([text], 'resume.txt'))).toBe(text);
  });
});

it('reads mixed Latin and named-CMap Japanese PDF text without dropping a line', async () => {
  const text = await extractTextFromFile(japanesePdfFile());
  expect(text.split('\n').filter(Boolean)).toEqual(['English resume heading', 'こんにちは']);
});
