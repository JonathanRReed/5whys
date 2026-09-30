// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractTextFromFile } from '../src/lib/resume-game/extractors';

function pdfFile(stream: string, compressed = true): File {
  const data = compressed ? deflateSync(Buffer.from(stream)) : Buffer.from(stream);
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([Buffer.from('<< /Length ' + data.length + (compressed ? ' /Filter /FlateDecode' : '') + ' >>\nstream\n'), data, Buffer.from('\nendstream')]),
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(Buffer.from(index + 1 + ' 0 obj\n'), object, Buffer.from('\nendobj\n'));
  }
  const xref = parts.reduce((sum, part) => sum + part.length, 0);
  parts.push(Buffer.from('xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'));
  return new File(parts, 'resume.pdf', { type: 'application/pdf' });
}

describe('resume file import', () => {
  it.each([true, false])('reads actual PDF text and preserves lines (compressed=%s)', async (compressed) => {
    const file = pdfFile('BT /F1 12 Tf 72 720 Td (Jordan Lee) Tj 0 -24 Td (EXPERIENCE) Tj 0 -24 Td (- Built 3 tools for a student team.) Tj 0 -24 Td (- Trained 12 classmates on safe AI use.) Tj ET', compressed);
    const text = await extractTextFromFile(file);
    expect(text.split('\n').filter(Boolean)).toEqual([
      'Jordan Lee', 'EXPERIENCE', '- Built 3 tools for a student team.', '- Trained 12 classmates on safe AI use.',
    ]);
    expect(text).not.toMatch(/endstream|BaseFont|FlateDecode|\/F1|720 Td/);
  });

  it('does not mistake a PDF without a text layer for resume content', async () => {
    await expect(extractTextFromFile(pdfFile('0 0 0 rg 0 0 100 100 re f'))).rejects.toThrow(/selectable text|text layer/i);
  });

  it('rejects corrupt PDF bytes instead of scoring file syntax', async () => {
    await expect(extractTextFromFile(new File(['%PDF-1.7\n' + 'not a valid document '.repeat(40)], 'broken.pdf')))).rejects.toThrow(/PDF/i);
  });

  it('rejects unsupported formats without reading binary bytes as text', async () => {
    await expect(extractTextFromFile(new File(['binary document'], 'resume.doc'))).rejects.toThrow(/supported|PDF, DOCX/i);
  });

  it('preserves plain text and Unicode', async () => {
    const text = 'José Lee\n• Built an accessibility tool\n• Taught résumé writing';
    expect(await extractTextFromFile(new File([text], 'resume.txt'))).toBe(text);
  });
});
