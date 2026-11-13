/**
 * The Resume Game's Word review is a Word document, not Markdown inside one
 * (career changer review, finding 5).
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { extractDocx } from '../src/lib/resume-doc';
import { buildReviewReport, createBulletRecord } from '../src/lib/resume-game';
import { reviewDocx } from '../src/lib/resume-game/exporters';

const bullets = [
  'Ran a $3.2M restaurant with 60 staff',
  'Led rollout of Manhattan WMS cycle counting, cutting inventory variance from 2.1% to 0.4% in 9 months',
].map(createBulletRecord);
const report = buildReviewReport(bullets, '2026-11-13');

describe('the Word review', () => {
  it('writes headings and list items, with no Markdown marks', async () => {
    const bytes = await reviewDocx(report);
    const zip = await JSZip.loadAsync(bytes);
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(xml).not.toMatch(/<w:t[^>]*>(?:#|- )/);
    expect(xml.match(/<w:pStyle w:val="Heading1"\/>/g)).toHaveLength(1);
    expect(xml.match(/<w:pStyle w:val="Heading2"\/>/g)).toHaveLength(2);
    expect(xml.match(/<w:pStyle w:val="Heading3"\/>/g)).toHaveLength(2);
    const listLines = report.split('\n').filter((line) => line.startsWith('- '));
    expect(xml.match(/<w:numPr>/g)).toHaveLength(listLines.length);
    expect(zip.file('word/styles.xml')).not.toBeNull();
    expect(zip.file('word/numbering.xml')).not.toBeNull();
  });

  it('reads back as headings and bullets', async () => {
    const doc = await extractDocx(await reviewDocx(report), 'resume-game-review.docx');
    const texts = doc.lines.map((line) => line.text);
    expect(texts[0]).toBe('Resume Game review');
    expect(texts).toContain('Where the lines stand');
    expect(texts).toContain('Line 1');
    for (const text of texts) expect(text).not.toMatch(/^(?:#|- )/);
    const listed = doc.lines.filter((line) => line.bullet).map((line) => line.text);
    expect(listed.some((text) => text.startsWith('What you did: '))).toBe(true);
    expect(listed.some((text) => / of 2 lines /.test(text))).toBe(true);
    expect(listed.length).toBe(report.split('\n').filter((line) => line.startsWith('- ')).length);
  });

  it('keeps special characters as text', async () => {
    const bytes = await reviewDocx('# A & B\n- <tag> & "quotes"');
    const doc = await extractDocx(bytes);
    expect(doc.lines.map((line) => line.text)).toEqual(['A & B', '<tag> & "quotes"']);
  });
});
