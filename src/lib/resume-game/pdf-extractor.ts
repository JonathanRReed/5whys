import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { createPdfDataFactory } from './pdf-data';

const MAX_PAGES = 50;
const MAX_TEXT_LENGTH = 200_000;
const TIMEOUT_MS = 20_000;

function pageText(items: Array<TextItem | { type: string }>): string {
  let text = '';
  let previousY: number | null = null;
  let previousEndX: number | null = null;

  for (const item of items) {
    if (!('str' in item)) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const changedLine =
      previousY !== null && Math.abs(y - previousY) > Math.max(2, item.height / 2);
    if (changedLine && text && !text.endsWith('\n')) text += '\n';
    const separated = previousEndX !== null && x - previousEndX > Math.max(1, item.height / 10);
    if (text && !/\s$/.test(text) && !/^\s/.test(item.str) && (separated || changedLine)) {
      if (!changedLine) text += ' ';
    }
    text += item.str;
    if (item.hasEOL) text += '\n';
    previousY = item.hasEOL ? null : y;
    previousEndX = item.hasEOL ? null : x + item.width;
  }
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') {
    // Ship the worker with the site. Resume bytes never go to a CDN or server.
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const { PdfDataFactory, getAssetError } = createPdfDataFactory();
  const loading = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: false,
    BinaryDataFactory: PdfDataFactory,
    useWorkerFetch: false,
    stopAtErrors: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const extract = async () => {
      const document = await loading.promise;
      if (document.numPages > MAX_PAGES) {
        throw new Error(
          'This PDF has more than 50 pages. Upload only your resume pages or paste the text.'
        );
      }
      const pages: string[] = [];
      let length = 0;
      for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        const assetError = getAssetError();
        if (assetError) {
          throw new Error(
            'This PDF could not load the font data needed to read all its text. Try exporting it again, using DOCX, or pasting the text.',
            { cause: assetError }
          );
        }
        const text = pageText(content.items);
        length += text.length;
        if (length > MAX_TEXT_LENGTH) {
          throw new Error(
            'This PDF contains too much text. Upload only your resume pages or paste the text.'
          );
        }
        pages.push(text);
        page.cleanup();
      }
      const text = pages.join('\n\n').trim();
      if (!text) {
        throw new Error(
          'This PDF has no selectable text. Export a text-based PDF, use DOCX, or paste your resume. Scanned pages need OCR first.'
        );
      }
      return text;
    };
    return await Promise.race([
      extract(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Reading this PDF took too long. Try a smaller PDF, DOCX, or paste the text.'
              )
            ),
          TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error(
        'This PDF is password-protected. Save an unlocked copy or paste the resume text.'
      );
    }
    if (error instanceof Error && /^(This PDF|Reading this PDF)/.test(error.message)) throw error;
    throw new Error(
      'Could not read this PDF. It may be damaged or unsupported. Try exporting it again, using DOCX, or pasting the text.',
      { cause: error }
    );
  } finally {
    if (timer) clearTimeout(timer);
    await loading.destroy();
  }
}
