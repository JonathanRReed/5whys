/**
 * The machine view's clean copy of a two-column Word resume with contact
 * details in the page header (career changer review, finding 10).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkExport,
  extractDocx,
  linearize,
  moveContactToTop,
  toDocx,
  toPrintModel,
} from '../src/lib/resume-doc';

const CONTACT =
  'Columbus, OH 43215 | (614) 555-0187 | dana.kowalczyk@example.com | linkedin.com/in/danakowalczyk';

async function readFixture() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/changer-docx/two-column-skills.docx'));
  return extractDocx(bytes, 'Dana_Kowalczyk_Resume_2015.docx');
}

const detectors = (doc: Awaited<ReturnType<typeof readFixture>>) =>
  doc.findings.map((finding) => finding.detector).sort();

describe('moving the contact details', () => {
  it('fixes only the contact finding; the table is still there to put in one column', async () => {
    const doc = await readFixture();
    expect(detectors(doc)).toEqual(expect.arrayContaining(['contact-placement', 'tables']));
    const moved = moveContactToTop(doc);
    expect(detectors(moved)).not.toContain('contact-placement');
    expect(detectors(moved)).toContain('tables');
    expect(moved.findings.find((f) => f.detector === 'tables')?.repairId).toBe('linearize');
  });

  it('puts the details under the name once, with no Contact heading left behind', async () => {
    const moved = moveContactToTop(await readFixture());
    const texts = moved.lines.map((line) => line.text);
    expect(texts.slice(0, 2)).toEqual(['Dana Kowalczyk', CONTACT]);
    expect(texts).not.toContain('CONTACT');
    expect(texts).not.toContain('Columbus, OH 43215');
    expect(texts.filter((text) => text.includes('555-0187'))).toHaveLength(1);
    expect(texts.at(-1)).toBe('References available upon request.');
  });

  it('keeps every word of the details it merges', async () => {
    const doc = await readFixture();
    const moved = moveContactToTop(doc);
    for (const detail of [
      'Columbus, OH 43215',
      '(614) 555-0187',
      'dana.kowalczyk@example.com',
      'linkedin.com/in/danakowalczyk',
    ]) {
      expect(moved.plainText).toContain(detail);
    }
  });
});

describe('putting it in one column', () => {
  it('reads the main column before the sidebar', async () => {
    const one = linearize(moveContactToTop(await readFixture()));
    const headings = one.sections.map((section) => section.kind);
    expect(headings).toEqual(['summary', 'experience', 'skills', 'education', 'certifications']);
    expect(one.findings.filter((f) => f.severity === 'fix')).toEqual([]);
    expect(detectors(one)).not.toContain('tables');
  });

  it('gives the same order whichever repair is pressed first', async () => {
    const doc = await readFixture();
    const a = linearize(moveContactToTop(doc)).lines.map((line) => line.text);
    const b = moveContactToTop(linearize(doc)).lines.map((line) => line.text);
    expect(b).toEqual(a);
  });
});

describe('the clean .docx', () => {
  it('opens with the name and one contact line and sets job titles in bold', async () => {
    const doc = await readFixture();
    const model = toPrintModel(doc);
    expect(model.paragraphs.slice(0, 3).map((p) => [p.kind, p.text])).toEqual([
      ['name', 'Dana Kowalczyk'],
      ['contact', CONTACT],
      ['text', 'Operations Manager  •  Team Leader  •  Results-Driven Professional'],
    ]);
    const titles = model.paragraphs.filter((p) => p.kind === 'title').map((p) => p.text);
    expect(titles).toEqual([
      'Operations Manager, Midwest Fulfillment Partners, Groveport, OH    Apr 2018 - Aug 2026',
      'Shift Supervisor, Midwest Fulfillment Partners    Mar 2017 - Apr 2018',
      'General Manager, Brickhouse Grill (2 locations), Columbus, OH    2008 - 2015',
      'Assistant Manager, Brickhouse Grill    2005 - 2008',
    ]);
    const bytes = await toDocx(doc);
    const check = await checkExport(bytes);
    expect(check.ok).toBe(true);
    const texts = check.doc.lines.map((line) => line.text);
    expect(texts.filter((text) => text.includes('555-0187'))).toHaveLength(1);
    expect(texts.indexOf('EXPERIENCE')).toBeLessThan(texts.indexOf('CORE SKILLS'));
    const { default: JSZip } = await import('jszip');
    const xml =
      (await (await JSZip.loadAsync(bytes)).file('word/document.xml')?.async('string')) ?? '';
    expect(xml).toMatch(/<w:b\/><\/w:rPr><w:t xml:space="preserve">Shift Supervisor/);
  });
});
