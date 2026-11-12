import type JSZip from 'jszip';
import { loadFeature } from '../lazy-feature';
import { recomputeDoc } from './model';
import type { LineOrigin, ResumeDoc, ResumeLine } from './types';

const MAX_ENTRIES = 512;
const MAX_EXPANDED = 20 * 1024 * 1024;
const WORD_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);

/** Check central-directory bounds before JSZip can inflate any entry. ZIP64 is not needed here. */
function checkZip(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  const floor = Math.max(0, bytes.length - 22 - 65535);
  for (; end >= floor; end -= 1) {
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.length
    )
      break;
  }
  if (end < floor || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0)
    throw new Error('This DOCX has an unsupported ZIP directory.');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const centralSize = view.getUint32(end + 12, true);
  if (count > MAX_ENTRIES || count !== view.getUint16(end + 8, true))
    throw new Error('This DOCX has too many ZIP entries.');
  if (offset + centralSize !== end) throw new Error('This DOCX has an invalid ZIP directory.');
  let expanded = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('This DOCX has an invalid ZIP entry.');
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const next =
      offset +
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    if (
      next > end ||
      size === 0xffffffff ||
      view.getUint32(offset + 20, true) === 0xffffffff ||
      view.getUint32(offset + 42, true) === 0xffffffff
    )
      throw new Error('This DOCX has an unsupported ZIP entry.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (
      names.has(name) ||
      name.split('/').includes('..') ||
      name.startsWith('/') ||
      name.includes('\\')
    )
      throw new Error('This DOCX has an invalid ZIP path.');
    names.add(name);
    expanded += size;
    if (expanded > MAX_EXPANDED) throw new Error('This DOCX expands to too much data.');
    offset = next;
  }
  if (offset !== end) throw new Error('This DOCX has an invalid ZIP directory.');
}

type StreamingEntry = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
};
function hasStream(entry: JSZip.JSZipObject): entry is StreamingEntry {
  return 'internalStream' in entry && typeof entry.internalStream === 'function';
}
async function readBounded(entry: JSZip.JSZipObject, remaining: number): Promise<Uint8Array> {
  // JSZip exposes this at runtime but omits it from JSZipObject's bundled types.
  if (!hasStream(entry)) throw new Error('This DOCX reader cannot limit expanded data.');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let stopped = false;
    const stream = entry.internalStream('uint8array');
    stream.on('data', (chunk: Uint8Array) => {
      if (stopped) return;
      size += chunk.length;
      if (size > remaining) {
        stopped = true;
        stream.pause();
        reject(new Error('This DOCX expands to too much data.'));
      } else chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      if (stopped) return;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    });
    stream.resume();
  });
}
function isWord(element: Element, name: string): boolean {
  return element.localName === name && WORD_NAMESPACES.has(element.namespaceURI ?? '');
}
function effectiveChildren(element: Element): Element[] {
  const children = Array.from(element.children);
  if (
    element.localName === 'AlternateContent' &&
    element.namespaceURI === 'http://schemas.openxmlformats.org/markup-compatibility/2006'
  ) {
    const selected =
      children.find((child) => child.localName === 'Choice') ??
      children.find((child) => child.localName === 'Fallback');
    return selected ? Array.from(selected.children) : [];
  }
  return children;
}
function descendants(element: Element, name: string): Element[] {
  return effectiveChildren(element).flatMap((child) => [
    ...(isWord(child, name) ? [child] : []),
    ...descendants(child, name),
  ]);
}
function parseXml(xml: string): XMLDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('This DOCX contains unsupported XML declarations.');
  if (typeof DOMParser === 'undefined') throw new Error('This DOCX reader needs an XML DOMParser.');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    parsed.getElementsByTagNameNS('*', 'parsererror').length ||
    parsed.documentElement.localName === 'parsererror'
  )
    throw new Error('This DOCX contains invalid XML.');
  return parsed;
}
function paragraphText(element: Element): string {
  if (isWord(element, 'txbxContent') || isWord(element, 'del')) return '';
  if (isWord(element, 't')) return element.textContent ?? '';
  if (isWord(element, 'tab')) return '\t';
  if (isWord(element, 'br') || isWord(element, 'cr')) return '\n';
  if (isWord(element, 'noBreakHyphen')) return '-';
  return effectiveChildren(element).map(paragraphText).join('');
}

export async function extractDocx(bytes: Uint8Array, name = 'resume.docx'): Promise<ResumeDoc> {
  if (bytes.length > 5 * 1024 * 1024) throw new Error('This DOCX file is too large.');
  checkZip(bytes);
  const { default: Zip } = await loadFeature(import('jszip'));
  const zip = await Zip.loadAsync(bytes);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('This DOCX has no document body.');
  const lines: ResumeLine[] = [];
  let expanded = 0;
  let textLength = 0;
  let table = 0;
  const append = (paragraph: Element, origin: LineOrigin, index: number) => {
    const bullet = descendants(paragraph, 'numPr').length > 0;
    const font = descendants(paragraph, 'rFonts')[0];
    const size = descendants(paragraph, 'sz')[0];
    const attr = (element: Element | undefined, key: string) =>
      element
        ? Array.from(element.attributes).find(
            (attribute) =>
              attribute.localName === key && WORD_NAMESPACES.has(attribute.namespaceURI ?? '')
          )?.value
        : undefined;
    const fontSize = Number(attr(size, 'val')) / 2;
    // Shift+Enter inside a list item is still one bullet: later segments
    // continue the first instead of becoming bullets of their own.
    let first: string | null = null;
    paragraphText(paragraph)
      .split('\n')
      .forEach((text, segment) => {
        if (!text.trim()) return;
        const id = `docx:${origin.part}:${index}:${segment}`;
        const continues = bullet && first !== null ? first : undefined;
        first ??= id;
        textLength += text.length;
        if (textLength > 200_000) throw new Error('This DOCX contains too much text.');
        lines.push({
          id,
          text: text.trimEnd(),
          pageIndex: 0,
          box: null,
          fontName: attr(font, 'ascii') ?? null,
          fontSize: fontSize > 0 ? fontSize : null,
          origin,
          bullet: bullet || /^\s*[-•*◦○●▪]\s+/.test(text),
          ...(continues ? { continuationOf: continues } : {}),
          items: [],
        });
      });
  };
  const parts = [
    documentEntry,
    ...Object.values(zip.files)
      .filter((entry) => /^word\/(?:header|footer)[^/]*\.xml$/.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  for (const entry of parts) {
    const data = await readBounded(entry, MAX_EXPANDED - expanded);
    expanded += data.length;
    const encoding =
      (data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0x3c && data[1] === 0)
        ? 'utf-16le'
        : (data[0] === 0xfe && data[1] === 0xff) || (data[0] === 0 && data[1] === 0x3c)
          ? 'utf-16be'
          : 'utf-8';
    const xml = parseXml(new TextDecoder(encoding).decode(data));
    const root = xml.documentElement;
    const kind =
      entry.name === 'word/document.xml'
        ? 'body'
        : /\/header/.test(entry.name)
          ? 'header'
          : 'footer';
    if (!isWord(root, kind === 'body' ? 'document' : kind === 'header' ? 'hdr' : 'ftr'))
      throw new Error('This DOCX has an unsupported XML part.');
    if (kind === 'body' && descendants(root, 'body').length !== 1)
      throw new Error('This DOCX has no document body.');
    let paragraph = 0;
    const walk = (element: Element, origin: LineOrigin) => {
      if (isWord(element, 'p')) {
        append(element, origin, paragraph++);
        for (const box of descendants(element, 'txbxContent')) {
          // Nested boxes are visited by their containing box.
          let parent = box.parentElement;
          let nested = false;
          while (parent && parent !== element) {
            if (isWord(parent, 'txbxContent')) nested = true;
            parent = parent.parentElement;
          }
          if (!nested) walk(box, { kind: 'text-box', part: entry.name });
        }
        return;
      }
      if (isWord(element, 'tbl')) {
        const tableIndex = table++;
        Array.from(element.children)
          .filter((child) => isWord(child, 'tr'))
          .forEach((row, rowIndex) => {
            Array.from(row.children)
              .filter((child) => isWord(child, 'tc'))
              .forEach((cell, cellIndex) => {
                walk(
                  cell,
                  origin.kind === 'body'
                    ? {
                        kind: 'table',
                        part: entry.name,
                        table: tableIndex,
                        row: rowIndex,
                        cell: cellIndex,
                      }
                    : origin
                );
              });
          });
        return;
      }
      if (isWord(element, 'del')) return;
      for (const child of effectiveChildren(element)) walk(child, origin);
    };
    walk(root, { kind, part: entry.name });
  }
  return recomputeDoc({
    source: 'docx',
    file: { name, sizeBytes: bytes.length, pageCount: null },
    pages: [{ index: 0, width: null, height: null, hasImages: null }],
    lines,
    extractionOrder: [],
    geometricOrder: [],
    sections: [],
    contact: { email: null, phone: null, links: [] },
    plainText: '',
    findings: [],
  });
}
