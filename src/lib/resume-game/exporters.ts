import { loadFeature } from '../lazy-feature';

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const PROLOG = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES_XML = `${PROLOG}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;

const RELS_XML = `${PROLOG}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="R1" Type="${OFFICE_REL}/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOCUMENT_RELS_XML = `${PROLOG}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rStyles" Type="${OFFICE_REL}/styles" Target="styles.xml"/><Relationship Id="rNumbers" Type="${OFFICE_REL}/numbering" Target="numbering.xml"/></Relationships>`;

const heading = (level: number, size: number, before: number) =>
  `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="80"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;

const STYLES_XML = `${PROLOG}<w:styles xmlns:w="${WORD}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="100"/></w:pPr></w:style>${heading(1, 32, 0)}${heading(2, 26, 240)}${heading(3, 22, 200)}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style></w:styles>`;

const NUMBERING_XML = `${PROLOG}<w:numbering xmlns:w="${WORD}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const paragraph = (text: string, properties = '') =>
  `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

/**
 * The review's plain Markdown as Word paragraphs: "#" lines become headings,
 * "- " lines become real list items, and blank lines are left to paragraph
 * spacing. No Markdown marks reach the document.
 */
function documentXml(content: string) {
  const paragraphs = content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => {
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) return paragraph(heading[2], `<w:pStyle w:val="Heading${heading[1].length}"/>`);
      const item = line.match(/^[-*]\s+(.*)$/);
      if (item) {
        return paragraph(
          item[1],
          '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        );
      }
      return paragraph(line);
    })
    .join('');
  return `${PROLOG}<w:document xmlns:w="${WORD}"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
}

/** A Word file of `content`, written from the review's plain Markdown. */
export async function reviewDocx(content: string): Promise<Uint8Array> {
  const JSZip = (await loadFeature(import('jszip'))).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS_XML);
  zip.file('word/styles.xml', STYLES_XML);
  zip.file('word/numbering.xml', NUMBERING_XML);
  zip.file('word/document.xml', documentXml(content));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function exportDocx(filename: string, content: string) {
  const bytes = await reviewDocx(content);
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
