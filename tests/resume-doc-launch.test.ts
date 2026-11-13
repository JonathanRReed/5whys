/**
 * Regressions from the launch review of the Resume Game's document engine:
 * a clean copy built from a resume the visitor has replaced, one rewrite
 * changing equal lines under two employers, deleted text boxes read as
 * current content, a date repair that damages an email address, a hyperlink
 * target dropped from the clean copy, and a fallback reader that ignored the
 * structured reader's text limit.
 */
import { File as NodeFile } from 'node:buffer';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  bulletRewrites,
  countRewrites,
  docMatchesText,
  extractDocx,
  isResumeLimitError,
  normalizeDates,
  rewriteText,
  toDocx,
  toEditorText,
  toPrintModel,
} from '../src/lib/resume-doc';
import { formatDates } from '../src/lib/resume-doc/dates';
import { extractTextFromFile } from '../src/lib/resume-game/extractors';
import { docxBytes, wordNamespace, xmlParagraph } from './fixtures/resume-doc';

beforeAll(() => {
  vi.stubGlobal('File', NodeFile);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const relNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function plainDocx(lines: string[]): Promise<Uint8Array> {
  return docxBytes(lines.map((line) => xmlParagraph(line)).join(''));
}

describe('1. the clean copy follows the text the visitor accepted', () => {
  it('reports a structured copy as out of date once the paste field is replaced', async () => {
    const doc = await extractDocx(
      await plainDocx([
        'Jordan Lee',
        'jordan@example.edu',
        'EXPERIENCE',
        'Developer, Acme | Jan 2024 - Dec 2025',
        '• Built forms for 10 campus clubs.',
      ])
    );
    const read = toEditorText(doc);
    const kept = { ...doc, sourceText: read };
    expect(docMatchesText(kept, read)).toBe(true);
    // Spacing and trailing blank lines are not edits.
    expect(docMatchesText(kept, `${read.replace(/\n/g, '\n\n')}  \n`)).toBe(true);
    const avery =
      'Avery Chen\navery@example.edu\nEXPERIENCE\n• Rebuilt the campus library sign-up form, so more students could reserve rooms.';
    expect(docMatchesText(kept, avery)).toBe(false);
    expect(docMatchesText(kept, '')).toBe(false);
  });

  it('still matches after a repair the visitor made, because the text read at upload is kept', async () => {
    const doc = await extractDocx(
      await plainDocx([
        'Jordan Lee',
        'jordan@example.edu',
        'EXPERIENCE',
        'Developer, Acme | Jan 2024 - 06/2025',
        '• Built forms for 10 campus clubs.',
      ])
    );
    const read = toEditorText(doc);
    const repaired = normalizeDates({ ...doc, sourceText: read });
    expect(toEditorText(repaired)).not.toBe(read);
    expect(docMatchesText(repaired, read)).toBe(true);
  });

  it('falls back to comparing the editor text for a copy saved before the text was kept', async () => {
    const doc = await extractDocx(await plainDocx(['Jordan Lee', 'jordan@example.edu']));
    expect(docMatchesText(doc, toEditorText(doc))).toBe(true);
    expect(docMatchesText(doc, 'Avery Chen')).toBe(false);
  });
});

describe('2. a rewrite changes one line, not every equal line', () => {
  const lines = [
    'Jordan Lee',
    'jordan@example.edu',
    'EXPERIENCE',
    'Employer Alpha',
    '• Prepared weekly reports.',
    'Employer Beta',
    '• Prepared weekly reports.',
  ];
  const bullets = [
    {
      original: 'Prepared weekly reports.',
      improved: 'Prepared weekly reports in Python for Alpha.',
      edited: true,
    },
    { original: 'Prepared weekly reports.', improved: 'Prepared weekly reports.', edited: false },
  ];

  it('binds the first bullet to the Alpha line only', async () => {
    const doc = await extractDocx(await plainDocx(lines));
    const rewrites = bulletRewrites(bullets);
    expect(rewrites).toEqual([
      {
        original: 'Prepared weekly reports.',
        improved: 'Prepared weekly reports in Python for Alpha.',
        occurrence: 0,
      },
    ]);
    expect(countRewrites(doc, rewrites)).toBe(1);
    const texts = toPrintModel(doc, { rewrites }).paragraphs.map((p) => p.text);
    expect(texts).toEqual([
      'Jordan Lee',
      'jordan@example.edu',
      'EXPERIENCE',
      'Employer Alpha',
      'Prepared weekly reports in Python for Alpha.',
      'Employer Beta',
      'Prepared weekly reports.',
    ]);
    const exported = await extractDocx(await toDocx(doc, { rewrites }));
    expect(
      exported.lines.filter((line) => line.text === 'Prepared weekly reports in Python for Alpha.')
    ).toHaveLength(1);
  });

  it('binds the second bullet to the Beta line only', async () => {
    const doc = await extractDocx(await plainDocx(lines));
    const rewrites = bulletRewrites([
      { ...bullets[1] },
      { ...bullets[0], improved: 'Prepared weekly reports for Beta.' },
    ]);
    expect(rewrites[0].occurrence).toBe(1);
    const texts = toPrintModel(doc, { rewrites }).paragraphs.map((p) => p.text);
    expect(texts[4]).toBe('Prepared weekly reports.');
    expect(texts[6]).toBe('Prepared weekly reports for Beta.');
  });

  it('rewrites the matching occurrence in plain text for the posting match', () => {
    const text = lines.join('\n');
    const rewrites = bulletRewrites([
      { ...bullets[1] },
      { ...bullets[0], improved: 'Prepared weekly reports for Beta.' },
    ]);
    expect(rewriteText(text, rewrites).split('\n')).toEqual([
      ...lines.slice(0, 4),
      '• Prepared weekly reports.',
      'Employer Beta',
      '• Prepared weekly reports for Beta.',
    ]);
  });
});

describe('3. text boxes inside deleted revisions are not current content', () => {
  it('skips a VML text box wrapped in a tracked deletion', async () => {
    const body = `<w:p><w:r><w:t>Jordan Lee</w:t></w:r></w:p><w:p><w:r><w:t>jordan@example.edu</w:t></w:r></w:p><w:p><w:del w:id="1" w:author="QA"><w:r><w:pict><v:shape id="Box1" style="width:180pt;height:70pt"><v:textbox><w:txbxContent><w:p><w:r><w:t>Deleted employer Falsely Claimed Corp</w:t></w:r></w:p><w:p><w:r><w:t>• Managed 999 staff.</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:del><w:r><w:t>Current honest work.</w:t></w:r></w:p>`;
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<w:document xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="${wordNamespace}"><w:body>${body}</w:body></w:document>`
    );
    const doc = await extractDocx(await zip.generateAsync({ type: 'uint8array' }));
    const texts = doc.lines.map((line) => line.text);
    expect(texts).toEqual(['Jordan Lee', 'jordan@example.edu', 'Current honest work.']);
    const clean = toPrintModel(doc)
      .paragraphs.map((p) => p.text)
      .join('\n');
    expect(clean).not.toContain('Falsely Claimed');
    expect(clean).not.toContain('999');
  });

  it('skips a text box moved away by a tracked move', async () => {
    const body = `<w:p><w:r><w:t>Jordan Lee</w:t></w:r></w:p><w:p><w:moveFrom w:id="3" w:author="QA"><w:r><w:drawing><w:txbxContent><w:p><w:r><w:t>Moved away claim</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r></w:moveFrom></w:p>`;
    const doc = await extractDocx(await docxBytes(body));
    expect(doc.lines.map((line) => line.text)).toEqual(['Jordan Lee']);
  });
});

describe('4. the date repair leaves contact details alone', () => {
  it('does not read a date inside an email address', () => {
    expect(formatDates('jordan.05.2024@example.edu', 'short-month')).toBe(
      'jordan.05.2024@example.edu'
    );
    expect(formatDates('Jan 2024 - 06/2025', 'short-month')).toBe('Jan 2024 - Jun 2025');
  });

  it('normalizes the job dates and keeps the address intact', async () => {
    const doc = await extractDocx(
      await plainDocx([
        'Jordan Lee',
        'jordan.05.2024@example.edu',
        'EXPERIENCE',
        'Developer, Acme | Jan 2024 - 06/2025',
        '• Built forms for 10 campus clubs.',
      ])
    );
    const repaired = normalizeDates(doc);
    const texts = repaired.lines.map((line) => line.text);
    expect(texts).toContain('jordan.05.2024@example.edu');
    expect(texts).toContain('Developer, Acme | Jan 2024 - Jun 2025');
    expect(repaired.contact.email?.value).toBe('jordan.05.2024@example.edu');
  });
});

describe('10. a labeled hyperlink keeps its address in the clean copy', () => {
  async function linkedDocx(target: string, mode = ' TargetMode="External"') {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<w:document xmlns:r="${officeRel}" xmlns:w="${wordNamespace}"><w:body>${xmlParagraph('Zoe Martinez')}${xmlParagraph('zoe@example.edu')}<w:p><w:hyperlink r:id="rLink"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p></w:body></w:document>`
    );
    zip.file(
      'word/_rels/document.xml.rels',
      `<Relationships xmlns="${relNamespace}"><Relationship Id="rLink" Type="${officeRel}/hyperlink" Target="${target}"${mode}/></Relationships>`
    );
    return zip.generateAsync({ type: 'uint8array' });
  }

  it('reads the target beside the visible label and keeps it through export and re-import', async () => {
    const doc = await extractDocx(await linkedDocx('https://portfolio.example.org/zoe'));
    expect(doc.lines.map((line) => line.text)).toContain(
      'Portfolio (https://portfolio.example.org/zoe)'
    );
    expect(doc.contact.links.map((link) => link.value)).toContain(
      'https://portfolio.example.org/zoe'
    );
    const exported = await extractDocx(await toDocx(doc));
    expect(exported.contact.links.map((link) => link.value)).toContain(
      'https://portfolio.example.org/zoe'
    );
  });

  it('does not repeat an address the label already shows, and ignores unsafe targets', async () => {
    const shown = await extractDocx(
      await (async () => {
        const zip = new JSZip();
        zip.file(
          'word/document.xml',
          `<w:document xmlns:r="${officeRel}" xmlns:w="${wordNamespace}"><w:body><w:p><w:hyperlink r:id="rLink"><w:r><w:t>portfolio.example.org/zoe</w:t></w:r></w:hyperlink></w:p></w:body></w:document>`
        );
        zip.file(
          'word/_rels/document.xml.rels',
          `<Relationships xmlns="${relNamespace}"><Relationship Id="rLink" Type="${officeRel}/hyperlink" Target="https://portfolio.example.org/zoe" TargetMode="External"/></Relationships>`
        );
        return zip.generateAsync({ type: 'uint8array' });
      })()
    );
    expect(shown.lines.map((line) => line.text)).toEqual(['portfolio.example.org/zoe']);
    const unsafe = await extractDocx(await linkedDocx('javascript:alert(1)'));
    expect(unsafe.lines.map((line) => line.text)).toContain('Portfolio');
    expect(unsafe.plainText).not.toContain('javascript');
  });

  it('shows the address of a mailto link without the scheme', async () => {
    const doc = await extractDocx(await linkedDocx('mailto:zoe.work@example.org'));
    expect(doc.lines.map((line) => line.text)).toContain('Portfolio (zoe.work@example.org)');
  });
});

describe('26. the text limit holds in every reader', () => {
  it('marks a structured-reader limit rejection as final', async () => {
    const bytes = await plainDocx(['Jordan Lee', 'jordan@example.edu', 'A'.repeat(200_001)]);
    const error = await extractDocx(bytes).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(isResumeLimitError(error)).toBe(true);
    expect(isResumeLimitError(new Error('This DOCX contains invalid XML.'))).toBe(false);
  });

  it('rejects the same file in the fallback reader', async () => {
    const bytes = await plainDocx(['Jordan Lee', 'jordan@example.edu', 'A'.repeat(200_001)]);
    const file = new NodeFile([bytes], 'over-text-limit.docx') as unknown as File;
    await expect(extractTextFromFile(file)).rejects.toThrow('too much text');
  });

  it('bounds the fallback reader when a directory understates the inflated size', async () => {
    const bytes = await docxBytes(xmlParagraph('A'.repeat(21 * 1024 * 1024)));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 10, true);
    }
    const file = new NodeFile([bytes], 'bomb.docx') as unknown as File;
    await expect(extractTextFromFile(file)).rejects.toThrow('too much data');
  });
});
