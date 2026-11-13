/**
 * The assembled letter as a Word file: one real paragraph per part, the
 * greeting and the sign-off included, with a line break (not a new
 * paragraph) between "Sincerely," and the name. Built in the browser; nothing
 * is sent anywhere.
 */
import { loadFeature } from './lazy-feature';

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PREFIX = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** One `<w:p>` per paragraph; a single line break inside a paragraph stays a break. */
export function letterParagraphsXml(letter: string): string {
  return letter
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const runs = paragraph
        .split('\n')
        .map((line) => `<w:t xml:space="preserve">${escapeXml(line.trim())}</w:t>`)
        .join('<w:br/>');
      return `<w:p><w:r>${runs}</w:r></w:p>`;
    })
    .join('');
}

/** The letter as the bytes of a .docx file. */
export async function letterDocx(letter: string): Promise<Uint8Array> {
  const JSZip = (await loadFeature(import('jszip'))).default;
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `${PREFIX}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
  );
  zip.file(
    '_rels/.rels',
    `${PREFIX}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `${PREFIX}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );
  zip.file(
    'word/styles.xml',
    `${PREFIX}<w:styles xmlns:w="${WORD}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="200" w:line="276" w:lineRule="auto"/></w:pPr></w:style></w:styles>`
  );
  zip.file(
    'word/document.xml',
    `${PREFIX}<w:document xmlns:w="${WORD}"><w:body>${letterParagraphsXml(letter)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Save the letter as a .docx through the browser's download. */
export async function downloadLetter(letter: string, filename: string): Promise<void> {
  const bytes = await letterDocx(letter);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
