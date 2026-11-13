import { File as NodeFile } from 'node:buffer';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ResumeDoc } from '../src/lib/resume-doc';
import {
  checkExport,
  detectColumns,
  detectContactPlacement,
  detectFileSize,
  detectFindings,
  detectGarbageCharacters,
  detectHeadings,
  detectMissingContact,
  detectMixedDates,
  detectPageCount,
  detectReadingOrder,
  detectSpacedLetters,
  detectTables,
  detectTextBoxes,
  detectUnreadablePages,
  documentDetectors,
  extractDocx,
  extractPdf,
  fixList,
  fromText,
  linearize,
  moveContactToTop,
  normalizeDates,
  recomputeDoc,
  renameHeading,
  reorderSections,
  replaceLineText,
  toDocx,
  toPrintModel,
} from '../src/lib/resume-doc';
import { normalizePdfLines } from '../src/lib/resume-doc/pdf-lines';
import { readPdfText } from '../src/lib/resume-game/pdf-extractor';
import {
  columnPdf,
  docxBytes,
  headerContactPdf,
  headerDocx,
  imagePagePdf,
  indentedBulletPdf,
  positionedText,
  separateBulletPdf,
  singleColumnPdf,
  studentLines,
  studentText,
  tableDocx,
  textBoxDocx,
  wordNamespace,
  wrappedResumePdf,
  xmlParagraph,
} from './fixtures/resume-doc';
import { japanesePdfFile, pdfFile } from './fixtures/resume-pdfs';

beforeAll(() => {
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('window', undefined);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function codes(doc: ResumeDoc): string[] {
  return doc.findings.map((finding) => finding.id);
}
const fixtureLoaders: Record<string, () => Promise<ResumeDoc>> = {
  single: () => extractPdf(singleColumnPdf()),
  equalColumns: () => extractPdf(columnPdf()),
  sidebar: () => extractPdf(columnPdf(true)),
  table: async () => extractDocx(await tableDocx()),
  imagePage: () => extractPdf(imagePagePdf(1)),
  headerContact: () => extractPdf(headerContactPdf()),
  docxHeader: async () => extractDocx(await headerDocx()),
  spacedLetters: async () => fromText(studentText.replace('Experience', 'E X P E R I E N C E')),
  mixedDates: async () => fromText(studentText.replace('May 2027', '05/2027')),
  cleanStudent: async () => fromText(studentText),
  textBox: async () => extractDocx(await textBoxDocx()),
  garbage: async () => fromText(studentText.replace('Writing, Excel', 'Writing\uFFFD, Excel')),
  missingContact: async () => fromText(studentLines.filter((_, index) => index !== 1).join('\n')),
  missingHeadings: async () =>
    fromText(
      studentText
        .replace('Experience', 'My work')
        .replace('Education', 'My studies')
        .replace('Skills', 'My tools')
    ),
  largeFile: async () =>
    recomputeDoc({
      ...fromText(studentText),
      file: { name: 'large.txt', sizeBytes: 2_500_001, pageCount: null },
    }),
  manyPages: () => extractPdf(imagePagePdf(3, false)),
  imageOnly: () => extractPdf(imagePagePdf()),
};
const expectedDetectors: Record<string, string[]> = {
  single: [],
  equalColumns: ['columns', 'reading-order'],
  sidebar: ['columns', 'reading-order'],
  table: ['tables'],
  imagePage: ['no-text'],
  headerContact: ['reading-order', 'contact-placement'],
  docxHeader: ['contact-placement'],
  spacedLetters: ['heading', 'spaced-letters'],
  mixedDates: ['dates'],
  cleanStudent: [],
  textBox: ['text-boxes'],
  garbage: ['characters'],
  missingContact: ['contact-missing'],
  missingHeadings: ['heading'],
  largeFile: ['file-size'],
  manyPages: ['page-count'],
  imageOnly: ['no-text', 'heading', 'contact-missing'],
};

/** Every detector is checked on every fixture, including its negative cases. */
describe('document-reading detector matrix', () => {
  it.each(Object.keys(fixtureLoaders))('%s has exactly the expected findings', async (name) => {
    const doc = await fixtureLoaders[name]();
    expect([...new Set(doc.findings.map((finding) => finding.detector))]).toEqual(
      expectedDetectors[name]
    );
    expect(documentDetectors.flatMap((detector) => detector(doc))).toEqual(doc.findings);
    if (name === 'equalColumns' || name === 'sidebar') {
      expect(doc.findings.filter((f) => f.repairId === 'linearize')).toHaveLength(1);
      const order = detectReadingOrder(doc)[0];
      expect(order.repairId).toBeUndefined();
      expect(order.explanation).toContain('columns');
    }
    expect(new Set(codes(doc)).size).toBe(doc.findings.length);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    expect(doc.findings.every((finding) => finding.group === 'document-reading')).toBe(true);
  });
});

describe('PDF geometry and local reading', () => {
  it('retains stable ids, fonts, coordinates, page dimensions and legacy text', async () => {
    const file = singleColumnPdf();
    const doc = await extractPdf(file);
    expect(doc.file).toEqual({ name: file.name, sizeBytes: file.size, pageCount: 1 });
    expect(doc.pages[0]).toMatchObject({ width: 612, height: 792, hasImages: false });
    expect(doc.lines[0]).toMatchObject({
      text: 'Jordan Lee',
      pageIndex: 0,
      box: { x: 60, y: 62 },
      fontSize: 10,
    });
    expect(doc.lines[0].fontName).toBeTruthy();
    expect(doc.lines[0].items).toHaveLength(1);
    expect(doc.plainText).toBe((await readPdfText(file)).replace(/^- /gm, ''));
    expect((await extractPdf(file)).lines.map((line) => line.id)).toEqual(
      doc.lines.map((line) => line.id)
    );
    expect(doc.sections.map((section) => section.kind)).toEqual([
      'education',
      'experience',
      'skills',
    ]);
  });
  it('keeps nearby text fragments together without joining distant columns', async () => {
    const file = pdfFile(
      'BT /F1 10 Tf 60 720 Td (Jordan) Tj /F1 12 Tf 34 0 Td (Lee) Tj 230 0 Td (Right column) Tj ET'
    );
    const doc = await extractPdf(file);
    expect(doc.lines.map((line) => line.text)).toEqual(['Jordan Lee', 'Right column']);
    expect(doc.lines[0].items.filter((item) => item.text.trim())).toHaveLength(2);
  });
  it('groups wrapped bullets and prose without losing their visual boxes', async () => {
    const doc = await extractPdf(wrappedResumePdf());
    const model = toPrintModel(doc);
    expect(model.paragraphs.map((p) => p.text)).toContain(
      'Grew the station Instagram from 400 to 2,100 followers by posting three times a week'
    );
    expect(model.paragraphs.map((p) => p.text)).toContain(
      'Communications student building accessible campus events with classmates at university.'
    );
    expect(model.paragraphs.slice(0, 3).map((p) => p.text)).toEqual([
      'Jordan Lee',
      'jordan.lee@example.edu',
      '(555) 201-4477',
    ]);
    expect(doc.lines.filter((line) => line.continuationOf)).toHaveLength(3);
    expect(doc.lines.every((line) => line.box && line.items.length)).toBe(true);
    expect(doc.plainText).toContain('posting three times a week');
    expect(doc.plainText).toContain('Jordan Lee\njordan.lee@example.edu\n(555) 201-4477');
    expect(toPrintModel(linearize(doc))).toEqual(model);
    const root = doc.lines.find((line) => line.text.startsWith('Grew'));
    if (!root) throw new Error('Fixture bullet missing');
    expect(
      toPrintModel(doc, { bulletLineIds: new Set([root.id]) })
        .paragraphs.filter((p) => p.kind === 'bullet')
        .map((p) => p.text)
    ).toEqual([
      'Grew the station Instagram from 400 to 2,100 followers by posting three times a week',
    ]);
    const withoutBullets = toPrintModel(doc, { bulletLineIds: new Set() });
    expect(withoutBullets.paragraphs.some((p) => p.text.includes('three times'))).toBe(false);
    expect((await extractDocx(await toDocx(doc))).lines.filter((line) => line.bullet)).toHaveLength(
      3
    );
  });
  it.each([separateBulletPdf, indentedBulletPdf])(
    'detects PDF bullets and writes real DOCX lists',
    async (fixture) => {
      const doc = await extractPdf(fixture());
      const bullets = doc.lines.filter((line) => line.bullet);
      expect(bullets.map((line) => line.text)).toEqual(
        fixture === separateBulletPdf
          ? ['Built accessible event guides.', 'Trained classmates.']
          : [
              'Built accessible event guides.',
              'Trained classmates.',
              'Edited stories for the student paper.',
              'Published weekly campus updates.',
            ]
      );
      const model = toPrintModel(doc);
      expect(model.paragraphs.filter((p) => p.kind === 'bullet')).toHaveLength(bullets.length);
      const bytes = await toDocx(doc);
      const zip = await JSZip.loadAsync(bytes);
      expect(
        (await zip.file('word/document.xml')?.async('text'))?.match(/<w:numPr>/g)
      ).toHaveLength(bullets.length);
      expect(
        (await extractDocx(bytes)).lines.filter((line) => line.bullet).map((line) => line.text)
      ).toEqual(bullets.map((line) => line.text));
    }
  );
  it('round trips a real browser-printed Letter resume with CSS columns and vector bullets', async () => {
    const file = new File(
      [new Uint8Array(readFileSync('tests/fixtures/browser-resume.pdf'))],
      'browser-resume.pdf',
      { type: 'application/pdf' }
    );
    const doc = await extractPdf(file);
    expect(doc.pages[0]).toMatchObject({ width: 612, height: 792 });
    const model = toPrintModel(doc);
    expect(model.paragraphs.filter((p) => p.kind === 'bullet').map((p) => p.text)).toEqual([
      'Grew the station Instagram from 400 to 2,100 followers by posting three times a week',
      'Built accessible event guides.',
      'Edited stories for the student paper.',
      'Published weekly campus updates.',
    ]);
    expect(model.paragraphs.map((p) => p.text)).toContain(
      'Communications student building accessible campus events with classmates across the university.'
    );
    const checked = await checkExport(await toDocx(doc));
    expect(checked.ok).toBe(true);
    expect(checked.exportFindings).toEqual([]);
    expect(checked.doc.lines.filter((line) => line.bullet)).toHaveLength(4);
  });
  it.each([
    [
      'sentence ending',
      'Organized campus events with classmates.',
      'and shared the results',
      60,
      14,
    ],
    ['short line', 'Campus radio assistant with friends', 'and student volunteers', 60, 14],
    ['new bullet', 'Organized campus events with classmates', '- and shared the results', 60, 14],
    ['heading', 'Organized campus events with classmates', 'Education', 60, 14],
    ['date', 'Organized campus events with classmates', 'Sep 2025 - Present', 60, 14],
    ['email', 'Organized campus events with classmates', 'jordan.lee@example.edu', 60, 14],
    ['phone', 'Organized campus events with classmates', '(555) 201-4477', 60, 14],
    ['new entry', 'Organized campus events with classmates', 'Campus newsletter editor', 60, 14],
    ['large gap', 'Organized campus events with classmates', 'and shared the results', 60, 28],
    [
      'different indent',
      'Organized campus events with classmates',
      'and shared the results',
      100,
      14,
    ],
  ] as const)('does not join an ambiguous %s', async (_label, first, second, x, gap) => {
    const doc = await extractPdf(
      pdfFile(
        [
          positionedText('Summary', 60, 720),
          positionedText(first, 60, 700),
          positionedText(second, x, 700 - gap),
          ...(_label === 'short line'
            ? [positionedText('Communications student building accessible campus events', 60, 640)]
            : []),
        ].join('\n')
      )
    );
    expect(doc.lines.every((line) => !line.continuationOf)).toBe(true);
  });
  it.each(['•', '◦', '▪', '-', '–', '*', '·', 'o'])(
    'detects and strips the leading %s glyph',
    async (glyph) => {
      const doc = await extractPdf(singleColumnPdf());
      const bullet = doc.lines.find((line) => line.bullet);
      if (!bullet) throw new Error('Fixture bullet missing');
      const text = bullet.text;
      bullet.text = `${glyph} ${text}`;
      bullet.bullet = false;
      const normalized = normalizePdfLines(doc);
      expect(normalized.lines.find((line) => line.id === bullet.id)).toMatchObject({
        text,
        bullet: true,
      });
      expect(
        toPrintModel(recomputeDoc(normalized)).paragraphs.find((p) => p.lineId === bullet.id)
      ).toMatchObject({ text, kind: 'bullet' });
    }
  );
  it('keeps Japanese text with the same bundled CMap data as the existing reader', async () => {
    const file = japanesePdfFile();
    expect((await extractPdf(file)).plainText.split('\n').filter(Boolean)).toEqual(
      (await readPdfText(file)).split('\n').filter(Boolean)
    );
  });
  it('rejects corrupt bytes and the existing page limit', async () => {
    await expect(extractPdf(new File(['broken'], 'bad.pdf'))).rejects.toThrow(
      'Could not read this PDF'
    );
    await expect(extractPdf(imagePagePdf(51, false))).rejects.toThrow('more than 50 pages');
  });
  it('uses image operators as evidence and keeps an unreadable page', async () => {
    const doc = await fixtureLoaders.imagePage();
    expect(doc.pages[1].hasImages).toBe(true);
    expect(doc.file.pageCount).toBe(2);
    expect(doc.findings[0].claim).toBe('We could not read text on page 2.');
  });
});

describe('DOCX XML reading and ZIP limits', () => {
  it('reads runs, entities, tabs, breaks, lists, row-ordered cells, boxes and peripheral parts once', async () => {
    const body =
      '<w:p><w:r><w:t>Jos&#233; &amp; </w:t></w:r><w:r><w:t>Lee</w:t><w:tab/><w:t>student</w:t><w:br/><w:t>Next line</w:t></w:r></w:p>' +
      xmlParagraph('A real list item', true) +
      '<w:tbl><w:tr><w:tc>' +
      xmlParagraph('Cell A') +
      '</w:tc><w:tc>' +
      xmlParagraph('Cell B') +
      '</w:tc></w:tr></w:tbl><w:p><w:r><w:t>Body anchor</w:t><w:drawing><w:txbxContent>' +
      xmlParagraph('Box text') +
      '</w:txbxContent></w:drawing></w:r></w:p>';
    const doc = await extractDocx(
      await docxBytes(body, {
        'word/footer1.xml': `<w:ftr xmlns:w="${wordNamespace}">${xmlParagraph('Footer text')}</w:ftr>`,
      })
    );
    expect(doc.lines.map((line) => line.text)).toEqual([
      'José & Lee\tstudent',
      'Next line',
      'A real list item',
      'Cell A',
      'Cell B',
      'Body anchor',
      'Box text',
      'Footer text',
    ]);
    expect(doc.lines[2].bullet).toBe(true);
    expect(doc.lines[3].origin).toEqual({
      kind: 'table',
      part: 'word/document.xml',
      table: 0,
      row: 0,
      cell: 0,
    });
    expect(doc.lines[4].origin).toMatchObject({ cell: 1 });
    expect(doc.lines[6].origin.kind).toBe('text-box');
    expect(doc.lines[7].origin.kind).toBe('footer');
    expect(doc.file.pageCount).toBeNull();
    expect(doc.lines.every((line) => line.box === null)).toBe(true);
  });
  it('uses namespace URIs rather than assuming a w prefix', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<q:document xmlns:q="${wordNamespace}"><q:body><q:p><q:r><q:t>Alternative prefix</q:t></q:r></q:p></q:body></q:document>`
    );
    expect((await extractDocx(await zip.generateAsync({ type: 'uint8array' }))).plainText).toBe(
      'Alternative prefix'
    );
  });
  it('rejects malformed XML, DTDs, missing body and corrupt ZIP bytes', async () => {
    await expect(extractDocx(await docxBytes('<w:p>'))).rejects.toThrow('invalid XML');
    const zip = new JSZip();
    zip.file('word/document.xml', '<!DOCTYPE w:document [<!ENTITY a "unsafe">]><w:document/>');
    await expect(extractDocx(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(
      'XML declarations'
    );
    await expect(
      extractDocx(await new JSZip().generateAsync({ type: 'uint8array' }))
    ).rejects.toThrow('no document body');
    await expect(extractDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow('ZIP directory');
  });
  it('reads UTF-16 XML and only one text-box representation in AlternateContent', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      Buffer.from(
        `\uFEFF<?xml version="1.0" encoding="UTF-16"?><w:document xmlns:w="${wordNamespace}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body><w:p><w:r><mc:AlternateContent><mc:Choice Requires="w">${'<w:txbxContent>' + xmlParagraph('Box once') + '</w:txbxContent>'}</mc:Choice><mc:Fallback>${'<w:txbxContent>' + xmlParagraph('Box once') + '</w:txbxContent>'}</mc:Fallback></mc:AlternateContent></w:r></w:p></w:body></w:document>`,
        'utf16le'
      )
    );
    const doc = await extractDocx(await zip.generateAsync({ type: 'uint8array' }));
    expect(doc.lines.map((line) => line.text)).toEqual(['Box once']);
    expect(doc.lines[0].origin.kind).toBe('text-box');
  });
  it('bounds actual inflated XML even when the directory lies about its size', async () => {
    const bytes = await docxBytes(xmlParagraph('A'.repeat(21 * 1024 * 1024)));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 10, true);
    }
    await expect(extractDocx(bytes)).rejects.toThrow('expands to too much data');
  });
  it('rejects too much extracted text from either text or DOCX', async () => {
    expect(() => fromText('A'.repeat(200_001))).toThrow('too much text');
    await expect(extractDocx(await docxBytes(xmlParagraph('A'.repeat(200_001))))).rejects.toThrow(
      'too much text'
    );
  });
  it('bounds entry count and declared expanded bytes before extraction', async () => {
    const zip = new JSZip();
    for (let index = 0; index < 513; index += 1) zip.file(`entry${index}`, '');
    await expect(extractDocx(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(
      'too many ZIP entries'
    );
    const bytes = await docxBytes(xmlParagraph('Small'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 21 * 1024 * 1024, true);
        break;
      }
    }
    await expect(extractDocx(bytes)).rejects.toThrow('expands to too much data');
  });
});

function assertRepair(before: ResumeDoc, after: ResumeDoc, addressed: string[]) {
  expect(after).not.toBe(before);
  const old = new Set(codes(before));
  expect(codes(after).filter((id) => !old.has(id))).toEqual([]);
  expect(after.findings.filter((finding) => addressed.includes(finding.detector))).toEqual([]);
  expect(after.findings).toEqual(detectFindings(after));
  expect(after.lines.map((line) => line.id).sort()).toEqual(
    before.lines.map((line) => line.id).sort()
  );
}
describe('pure repairs', () => {
  it.each(['equalColumns', 'sidebar', 'table', 'textBox'])(
    'linearizes %s without adding findings',
    async (fixture) => {
      const before = await fixtureLoaders[fixture]();
      const snapshot = JSON.stringify(before);
      const after = linearize(before);
      assertRepair(before, after, ['columns', 'reading-order', 'tables', 'text-boxes']);
      expect(after.extractionOrder).toEqual(before.geometricOrder);
      expect(after.file).toEqual(before.file);
      expect(JSON.stringify(before)).toBe(snapshot);
    }
  );
  it.each(['headerContact', 'docxHeader'])(
    'moves %s contact into the body without adding findings',
    async (fixture) => {
      const before = await fixtureLoaders[fixture]();
      const after = moveContactToTop(before);
      assertRepair(before, after, ['contact-placement']);
      expect(after.lines[0].text).toBe('Jordan Lee');
      expect(after.lines[1].text).toContain('jordan.lee@example.edu');
    }
  );
  it('renames an unrecognized heading and preserves membership', async () => {
    const before = await fixtureLoaders.spacedLetters();
    const heading = before.lines.find((line) => line.text.startsWith('E X'));
    if (!heading) throw new Error('Fixture heading missing');
    const after = renameHeading(before, heading.id, 'experience');
    assertRepair(before, after, ['heading', 'spaced-letters']);
    expect(after.sections.find((section) => section.kind === 'experience')?.lineIds).toHaveLength(
      3
    );
  });
  it.each(['short-month', 'long-month', 'numeric'] as const)(
    'normalizes dates to %s without adding findings',
    async (style) => {
      const before = await fixtureLoaders.mixedDates();
      const after = normalizeDates(before, style);
      assertRepair(before, after, ['dates']);
      expect(normalizeDates(after, style)).toEqual(after);
      expect(before.plainText).toContain('05/2027');
    }
  );
  it('replaces a damaged line and updates contact and derived text', async () => {
    const before = await fixtureLoaders.garbage();
    const line = before.lines.find((item) => item.text.includes('\uFFFD'));
    if (!line) throw new Error('Fixture damaged line missing');
    assertRepair(before, replaceLineText(before, line.id, 'Writing, Excel, Spanish'), [
      'characters',
    ]);
    const after = replaceLineText(
      fromText(studentText),
      'text:1',
      'new@example.edu | (555) 201-4477 | github.com/jordan'
    );
    expect(after.contact.email?.value).toBe('new@example.edu');
    expect(after.plainText).toContain('new@example.edu');
    expect(() => replaceLineText(before, 'absent', 'text')).toThrow('not found');
    expect(() => replaceLineText(before, line.id, 'two\nlines')).toThrow('one nonempty line');
  });
  it('rejects repairs that add a finding or leave the targeted character problem', async () => {
    const clean = fromText(studentText);
    expect(() => replaceLineText(clean, 'text:1', 'Contact me')).toThrow(
      'adds a document-reading finding'
    );
    expect(() => renameHeading(clean, 'text:2', 'experience')).toThrow(
      'adds a document-reading finding'
    );
    const damaged = await fixtureLoaders.garbage();
    const line = damaged.lines.find((item) => item.text.includes('\uFFFD'));
    if (!line) throw new Error('Fixture damaged line missing');
    expect(() => replaceLineText(damaged, line.id, line.text)).toThrow('still contains');
  });
  it('reorders whole sections, keeping name and contact before them', () => {
    const before = fromText(studentText);
    const after = reorderSections(before, before.sections.map((section) => section.id).reverse());
    assertRepair(before, after, []);
    expect(after.sections.map((section) => section.kind)).toEqual([
      'skills',
      'experience',
      'education',
    ]);
    expect(after.lines.slice(0, 2).map((line) => line.text)).toEqual(studentLines.slice(0, 2));
    expect(() => reorderSections(before, [])).toThrow('every section');
  });
});

describe('clean export and round trip', () => {
  const repairable = [
    'single',
    'equalColumns',
    'sidebar',
    'table',
    'imagePage',
    'headerContact',
    'docxHeader',
    'cleanStudent',
    'textBox',
    'largeFile',
    'manyPages',
  ];
  it.each(repairable)(
    'exports %s and reimports with zero document-reading findings',
    async (fixture) => {
      const before = await fixtureLoaders[fixture]();
      const snapshot = JSON.stringify(before);
      const bytes = await toDocx(before);
      const checked = await checkExport(bytes);
      expect(checked.findings).toEqual([]);
      expect(checked.ok).toBe(true);
      expect(JSON.stringify(before)).toBe(snapshot);
      const zip = await JSZip.loadAsync(bytes);
      const xml = await zip.file('word/document.xml')?.async('text');
      expect(xml).not.toMatch(/<w:(?:tbl|txbxContent|hdr|ftr)\b/);
      expect(Object.keys(zip.files).some((name) => /(?:header|footer)\d*\.xml$/.test(name))).toBe(
        false
      );
    }
  );
  it.each(['garbage', 'spacedLetters', 'imageOnly'])(
    'reports unrecoverable %s content rather than inventing it',
    async (fixture) => {
      const doc = await fixtureLoaders[fixture]();
      const checked = await checkExport(await toDocx(doc));
      expect(checked.ok).toBe(false);
      expect(checked.findings.length).toBeGreaterThan(0);
    }
  );
  it('keeps text and dates as written unless date formatting is requested', async () => {
    const doc = fromText(
      studentText.replace('Education', 'Academic background').replace('May 2027', '05/2027')
    );
    const model = toPrintModel(doc);
    expect(model.paragraphs.map((p) => p.text)).toContain('Academic background');
    expect(model.paragraphs.map((p) => p.text)).toContain(
      'State University, B.A. Communications, 05/2027'
    );
    const checked = await checkExport(await toDocx(doc));
    expect(checked.doc.lines.map((line) => line.text)).toEqual(model.paragraphs.map((p) => p.text));
    expect(checked.contentFindings.map((f) => f.detector)).toContain('dates');
    expect(checked.ok).toBe(true);
    expect(toPrintModel(doc, { dateStyle: 'short-month' }).paragraphs.map((p) => p.text)).toContain(
      'State University, B.A. Communications, May 2027'
    );
    expect((await checkExport(await toDocx(doc, { dateStyle: 'short-month' }))).findings).toEqual(
      []
    );
  });
  it('separates missing content from export failures without hiding findings', async () => {
    const checked = await checkExport(await toDocx(fromText('Jordan Lee')));
    expect(checked.ok).toBe(true);
    expect(checked.findings.length).toBeGreaterThan(0);
    expect(checked.contentFindings).toEqual(checked.findings);
    expect(checked.exportFindings).toEqual([]);
    const damaged = await checkExport(await toDocx(fromText(studentText + '\nUnreadable \uFFFD')));
    expect(damaged.ok).toBe(false);
    expect(damaged.exportFindings.map((f) => f.detector)).toContain('characters');
  });
  it('exports real list paragraphs, selected bullets, escaped Unicode and the same print content', async () => {
    const doc = fromText(studentText.replace('Jordan Lee', 'José & <Lee>'));
    const bullet = doc.lines.find((line) => line.bullet);
    if (!bullet) throw new Error('Fixture bullet missing');
    const options = { bulletLineIds: new Set([bullet.id]) };
    const model = toPrintModel(doc, options);
    expect(model.paragraphs.filter((paragraph) => paragraph.kind === 'bullet')).toHaveLength(1);
    expect(model.fontFamily).toBe('Arial');
    const bytes = await toDocx(doc, options);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file('word/document.xml')?.async('text');
    expect(xml?.match(/<w:numPr>/g)).toHaveLength(1);
    expect(xml).toContain('José &amp; &lt;Lee&gt;');
    expect(await zip.file('word/numbering.xml')?.async('text')).toContain(
      'w:numFmt w:val="bullet"'
    );
    const checked = await checkExport(bytes);
    expect(checked.doc.lines.map((line) => line.text)).toEqual(
      model.paragraphs.map((paragraph) => paragraph.text)
    );
    expect(checked.doc.lines.filter((line) => line.bullet)).toHaveLength(1);
    expect(checked.findings).toEqual([]);
    expect(
      toPrintModel(doc, { bulletLineIds: new Set() }).paragraphs.every(
        (paragraph) => paragraph.kind !== 'bullet'
      )
    ).toBe(true);
  });
  it('includes severity, explanation and citations in both fix-list formats', async () => {
    const list = fixList(await fixtureLoaders.largeFile());
    expect(list.text).toContain('Check: This file is 2.50 MB.');
    expect(list.markdown).toContain('- Check:');
    expect(list.text).toContain('https://support.greenhouse.io/');
    expect(list.markdown).toContain('[Greenhouse: unsuccessful resume parse]');
    expect(fixList(fromText(studentText))).toEqual({ text: '', markdown: '' });
  });
});

describe('detector boundaries and known limits', () => {
  it('keeps the one-vendor file limit and actual page count separate from a universal verdict', () => {
    const doc = fromText(studentText);
    expect(detectFileSize({ ...doc, file: { ...doc.file, sizeBytes: 2_500_000 } })).toEqual([]);
    expect(detectPageCount({ ...doc, file: { ...doc.file, pageCount: 2 } })).toEqual([]);
    expect(detectPageCount(doc)).toEqual([]);
  });
  it('does not call prose, initials, Unicode names, consistent dates or a date rail broken', async () => {
    const doc = fromText(
      studentText + '\nA B C\nJosé 李\nWe used Excel to share experience with students.'
    );
    expect(detectSpacedLetters(doc)).toEqual([]);
    expect(detectGarbageCharacters(doc)).toEqual([]);
    expect(detectMixedDates(doc)).toEqual([]);
    const dateRail = await extractPdf(
      pdfFile(
        studentLines.map((text, index) => positionedText(text, 60, 720 - index * 24)).join('\n') +
          positionedText('2024', 530, 600) +
          positionedText('2025', 530, 576)
      )
    );
    expect(detectColumns(dateRail)).toEqual([]);
  });
  it('does not recognize section words buried inside prose as headings', () => {
    const doc = fromText('We gained experience and skills at university.');
    expect(detectHeadings(doc)).toHaveLength(3);
  });
  it('records known heuristic misses without calling the fixture set an accuracy estimate', () => {
    const international = fromText(studentText.replace('(555) 201-4477', '+44 20 7946 0958'));
    expect(
      detectMissingContact(international).some((finding) => finding.id === 'contact-missing:phone')
    ).toBe(true);
    const obfuscated = fromText(
      studentText.replace('jordan.lee@example.edu', 'jordan [at] example [dot] edu')
    );
    expect(
      detectMissingContact(obfuscated).some((finding) => finding.id === 'contact-missing:email')
    ).toBe(true);
    const customHeading = fromText(studentText.replace('Experience', 'Where I contributed'));
    expect(
      detectHeadings(customHeading).some((finding) => finding.id === 'heading:experience')
    ).toBe(true);
    const initials = fromText(studentText + '\nJ O R D A N');
    expect(detectSpacedLetters(initials)).toHaveLength(1); // Also flags deliberate letter spacing.
    expect(detectMixedDates(fromText(studentText.replace('Sep 2025', '2025-09')))).toEqual([]); // ISO dates are not inferred.
  });
  it('normalizes numeric separators and padding while preserving dates embedded in URLs', () => {
    const before = fromText(
      studentText.replace('May 2027', '5-2027').replace('Sep 2025', '09/2025')
    );
    expect(detectMixedDates(before)).toHaveLength(1);
    expect(detectMixedDates(normalizeDates(before, 'numeric'))).toEqual([]);
    const linked = fromText(
      studentText.replace('linkedin.com/in/jordanlee', 'https://example.edu/03/2025')
    );
    expect(normalizeDates(linked).contact.links[0].value).toBe('https://example.edu/03/2025');
  });
  it('each exported detector returns the same result independently', async () => {
    const doc = await fixtureLoaders.cleanStudent();
    for (const detector of [
      detectFileSize,
      detectPageCount,
      detectUnreadablePages,
      detectColumns,
      detectReadingOrder,
      detectContactPlacement,
      detectHeadings,
      detectMissingContact,
      detectSpacedLetters,
      detectGarbageCharacters,
      detectMixedDates,
      detectTables,
      detectTextBoxes,
    ])
      expect(detector(doc)).toEqual([]);
  });
});
