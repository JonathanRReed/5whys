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

describe('a Word list that gets its numbering from a paragraph style', () => {
  const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:style w:type="paragraph" w:styleId="ListBullet"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="MyBullet"><w:basedOn w:val="ListBullet"/></w:style>
    <w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  </w:styles>`;
  const styled = (style: string, text: string) =>
    `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

  it('reads list-styled paragraphs as bullets, and numbered headings as headings', async () => {
    const doc = await extractDocx(
      await docxBytes(
        [
          xmlParagraph('Maya Torres'),
          styled('Heading1', 'Experience'),
          styled('ListBullet', 'Posted three times a week'),
          styled('MyBullet', 'Scheduled 12 volunteer DJs each week'),
        ].join(''),
        { 'word/styles.xml': styles }
      )
    );
    const flags = Object.fromEntries(doc.lines.map((line) => [line.text, line.bullet]));
    expect(flags['Posted three times a week']).toBe(true);
    expect(flags['Scheduled 12 volunteer DJs each week']).toBe(true);
    expect(flags.Experience).toBe(false);
    expect(flags['Maya Torres']).toBe(false);
  });
});
