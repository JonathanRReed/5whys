import { loadFeature } from '../lazy-feature';
import { extractDocx } from './docx';
import { toEditorText } from './editor-text';
import { logicalLines } from './layout';
import { contactLineIds, linearize, moveContactToTop, normalizeDates } from './repairs';
import type { ExportCheck, ExportOptions, PrintModel, PrintParagraph, ResumeDoc } from './types';

const MARKER = /^\s*[-–•*◦○●▪·o]\s+/;
/** A bullet glyph at the start of a line, with or without a space after it. */
const LEADING_MARKER = /^\s*(?:[-–•*◦○●▪·]\s*|o\s+)/;
/** A line reduced to its words, for matching a rewrite to the line it replaces. */
function lineKey(text: string): string {
  return text.replace(LEADING_MARKER, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
type Rewrite = NonNullable<ExportOptions['rewrites']>[number];

/**
 * The rewrites from the game's bullets, in resume order, each bound to the
 * occurrence of its line it came from. Two equal lines under two employers
 * stay two lines: rewriting the first never changes the second.
 */
export function bulletRewrites(
  bullets: readonly { original: string; improved: string; edited?: boolean }[]
): Rewrite[] {
  const seen = new Map<string, number>();
  return bullets.flatMap((bullet) => {
    const key = lineKey(bullet.original);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return bullet.edited && bullet.improved.trim() && key
      ? [{ original: bullet.original, improved: bullet.improved, occurrence }]
      : [];
  });
}

/**
 * Which line each rewrite replaces, given the lines in reading order: the
 * rewrite's occurrence of a line with the same words (the first when no
 * occurrence is given).
 */
function rewriteTargets<T>(
  items: readonly T[],
  text: (item: T) => string,
  rewrites: ExportOptions['rewrites']
): Map<T, string> {
  const wanted = new Map<string, string>();
  for (const entry of rewrites ?? []) {
    const improved = entry.improved.replace(MARKER, '').trim();
    if (!improved) continue;
    wanted.set(`${lineKey(entry.original)}\u0000${entry.occurrence ?? 0}`, improved);
  }
  const targets = new Map<T, string>();
  if (wanted.size === 0) return targets;
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = lineKey(text(item));
    if (!key) continue;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    const improved = wanted.get(`${key}\u0000${occurrence}`);
    if (improved !== undefined) targets.set(item, improved);
  }
  return targets;
}

/** How many of the resume's lines the given rewrites would replace. */
export function countRewrites(doc: ResumeDoc, rewrites: ExportOptions['rewrites']): number {
  const targets = rewriteTargets(logicalLines(doc.lines), (line) => line.text, rewrites);
  return [...targets].filter(([line, improved]) => lineKey(improved) !== lineKey(line.text)).length;
}

/**
 * Plain resume text with each rewrite in place of the line it came from,
 * keeping that line's bullet mark. Used to compare a posting with the resume
 * as it will be exported.
 */
export function rewriteText(text: string, rewrites: ExportOptions['rewrites']): string {
  const lines = text.split('\n');
  const indexes = lines.map((_, index) => index);
  const targets = rewriteTargets(indexes, (index) => lines[index], rewrites);
  if (targets.size === 0) return text;
  return lines
    .map((line, index) => {
      const improved = targets.get(index);
      if (improved === undefined) return line;
      const mark = line.match(LEADING_MARKER)?.[0] ?? '';
      return `${mark}${improved}`;
    })
    .join('\n');
}

function comparable(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * True while the paste field still holds the text this structured copy was
 * read as. Once the visitor replaces or edits that text, the clean copy built
 * from the file would carry a resume they no longer accept.
 */
export function docMatchesText(doc: ResumeDoc, text: string): boolean {
  const accepted = comparable(text);
  return accepted !== '' && comparable(doc.sourceText ?? toEditorText(doc)) === accepted;
}
function cleanCopy(doc: ResumeDoc, options: ExportOptions): ResumeDoc {
  const copy = moveContactToTop(linearize(doc));
  return options.dateStyle ? normalizeDates(copy, options.dateStyle) : copy;
}
export function toPrintModel(doc: ResumeDoc, options: ExportOptions = {}): PrintModel {
  const copy = cleanCopy(doc, options);
  const contactIds = contactLineIds(copy);
  const headings = new Set(copy.sections.map((section) => section.headingLineId));
  const kept = (line: { id: string; bullet: boolean }) =>
    !line.bullet || !options.bulletLineIds || options.bulletLineIds.has(line.id);
  const ordered = logicalLines(copy.lines);
  const rewritten = rewriteTargets(ordered, (line) => line.text, options.rewrites);
  // Each addition follows its line. If that line is left out of this copy the
  // addition stays in its place, under the same job, and never moves to another.
  const additions = new Map<string, PrintParagraph[]>();
  const loose: PrintParagraph[] = [];
  (options.addedBullets ?? []).forEach((added, index) => {
    const text = added.text.replace(MARKER, '').trim();
    if (!text) return;
    const paragraph: PrintParagraph = { lineId: `added-${index}`, kind: 'bullet', text };
    if (ordered.some((line) => line.id === added.afterLineId)) {
      additions.set(added.afterLineId, [...(additions.get(added.afterLineId) ?? []), paragraph]);
    } else {
      loose.push(paragraph);
    }
  });
  const paragraphs: PrintParagraph[] = ordered.flatMap((line, index) => [
    ...(kept(line)
      ? [
          {
            lineId: line.id,
            kind: headings.has(line.id)
              ? 'heading'
              : contactIds.has(line.id)
                ? 'contact'
                : line.bullet
                  ? 'bullet'
                  : index === 0
                    ? 'name'
                    : 'text',
            text: rewritten.get(line) ?? (line.bullet ? line.text.replace(MARKER, '') : line.text),
          } satisfies PrintParagraph,
        ]
      : []),
    ...(additions.get(line.id) ?? []),
  ]);
  // A line that no longer exists in the resume at all: after the last bullet.
  if (loose.length > 0) {
    const at = paragraphs.findLastIndex((paragraph) => paragraph.kind === 'bullet');
    paragraphs.splice(at === -1 ? paragraphs.length : at + 1, 0, ...loose);
  }
  return {
    fontFamily: 'Arial',
    fontSizePt: 11,
    page: { widthPt: 612, heightPt: 792, marginPt: 54 },
    paragraphs,
  };
}
function escapeXml(text: string): string {
  // XML 1.0 disallows these characters. Preserve a visible replacement for rechecking.
  return [...text]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code) ? '\uFFFD' : character;
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
export async function toDocx(doc: ResumeDoc, options: ExportOptions = {}): Promise<Uint8Array> {
  const model = toPrintModel(doc, options);
  // Loaded when a file is written, so pages that only show the resume do not carry it.
  const JSZip = (await loadFeature(import('jszip'))).default;
  const zip = new JSZip();
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  zip.file(
    '[Content_Types].xml',
    `${prefix}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`
  );
  zip.file(
    '_rels/.rels',
    `${prefix}<Relationships xmlns="${rel}"><Relationship Id="rDoc" Type="${officeRel}/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `${prefix}<Relationships xmlns="${rel}"><Relationship Id="rStyles" Type="${officeRel}/styles" Target="styles.xml"/><Relationship Id="rNumbers" Type="${officeRel}/numbering" Target="numbering.xml"/></Relationships>`
  );
  zip.file(
    'word/styles.xml',
    `${prefix}<w:styles xmlns:w="${word}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="100"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`
  );
  zip.file(
    'word/numbering.xml',
    `${prefix}<w:numbering xmlns:w="${word}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="240"/></w:tabs><w:ind w:left="240" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`
  );
  const paragraphs = model.paragraphs
    .map((paragraph) => {
      const properties =
        paragraph.kind === 'bullet'
          ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
          : paragraph.kind === 'heading'
            ? '<w:pStyle w:val="Heading1"/>'
            : '';
      const run = paragraph.kind === 'name' ? '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr>' : '';
      return `<w:p><w:pPr>${properties}</w:pPr><w:r>${run}<w:t xml:space="preserve">${escapeXml(paragraph.text)}</w:t></w:r></w:p>`;
    })
    .join('');
  zip.file(
    'word/document.xml',
    `${prefix}<w:document xmlns:w="${word}"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export async function checkExport(bytes: Uint8Array): Promise<ExportCheck> {
  const doc = await extractDocx(bytes);
  const contentChecks = new Set(['contact-missing', 'heading', 'dates']);
  const contentFindings = doc.findings.filter((finding) => contentChecks.has(finding.detector));
  const exportFindings = doc.findings.filter((finding) => !contentChecks.has(finding.detector));
  return {
    doc,
    findings: doc.findings,
    exportFindings,
    contentFindings,
    ok: exportFindings.length === 0,
  };
}
export function fixList(doc: ResumeDoc): { text: string; markdown: string } {
  const text = doc.findings.map(
    (finding) =>
      `${finding.severity === 'fix' ? 'Fix' : 'Check'}: ${finding.claim}\n${finding.explanation}${finding.citation ? `\n${finding.citation.label}: ${finding.citation.url}` : ''}`
  );
  const escapeMarkdown = (value: string) => value.replace(/([\\`*_[\]<>])/g, '\\$1');
  return {
    text: text.join('\n\n'),
    markdown: doc.findings
      .map(
        (finding) =>
          `- ${finding.severity === 'fix' ? 'Fix' : 'Check'}: ${escapeMarkdown(finding.claim)} ${escapeMarkdown(finding.explanation)}${finding.citation ? ` [${escapeMarkdown(finding.citation.label)}](${finding.citation.url})` : ''}`
      )
      .join('\n'),
  };
}
