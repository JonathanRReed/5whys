import { describe, expect, it } from 'vitest';
import { extractDocx, toPrintModel } from '../src/lib/resume-doc';
import { docxBytes, xmlParagraph } from './fixtures/resume-doc';

const softBreakBullet =
  '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' +
  '<w:r><w:t>Organized student workshops</w:t><w:br/><w:t>so new members could participate</w:t></w:r></w:p>';

describe('a Word list item with a soft line break', () => {
  it('is one bullet, not two', async () => {
    const doc = await extractDocx(
      await docxBytes(
        [
          xmlParagraph('Maya Torres'),
          xmlParagraph('Experience'),
          softBreakBullet,
          xmlParagraph('Posted three times a week', true),
        ].join('')
      )
    );
    const [first, second] = doc.lines.filter(
      (line) => line.text.includes('workshops') || line.text.includes('new members')
    );
    expect(second.continuationOf).toBe(first.id);
    const bullets = toPrintModel(doc).paragraphs.filter((p) => p.kind === 'bullet');
    expect(bullets.map((b) => b.text)).toEqual([
      'Organized student workshops so new members could participate',
      'Posted three times a week',
    ]);
  });

  it('leaves a soft break outside a list as separate lines', async () => {
    const doc = await extractDocx(
      await docxBytes(
        '<w:p><w:r><w:t>Maya Torres</w:t><w:br/><w:t>maya@example.edu</w:t></w:r></w:p>'
      )
    );
    expect(doc.lines.every((line) => line.continuationOf === undefined)).toBe(true);
    expect(doc.lines).toHaveLength(2);
  });
});
