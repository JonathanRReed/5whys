import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { loadFeature } from '../lazy-feature';
import { createPdfDataFactory } from '../resume-game/pdf-data';
import { recomputeDoc } from './model';
import { normalizePdfLines } from './pdf-lines';
import type { BoundingBox, ResumeDoc, ResumeLine, ResumePage, ResumeTextItem } from './types';

function union(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export async function extractPdf(file: File): Promise<ResumeDoc> {
  const pdfjs = await loadFeature(import('pdfjs-dist/legacy/build/pdf.mjs'));
  if (typeof window !== 'undefined') {
    const worker = await loadFeature(import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'));
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
  let canceled = false;
  try {
    const extract = async () => {
      const pdf = await loading.promise;
      if (pdf.numPages > 50)
        throw new Error(
          'This PDF has more than 50 pages. Upload only your resume pages or paste the text.'
        );
      const lines: ResumeLine[] = [];
      const pages: ResumePage[] = [];
      let length = 0;
      for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
        if (canceled) throw new Error('Reading this PDF took too long.');
        const page = await pdf.getPage(pageIndex + 1);
        try {
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const assetError = getAssetError();
          if (assetError)
            throw new Error('This PDF could not load the font data needed to read all its text.', {
              cause: assetError,
            });
          const operators = await page.getOperatorList();
          const imageOps = new Set([
            pdfjs.OPS.paintImageXObject,
            pdfjs.OPS.paintInlineImageXObject,
            pdfjs.OPS.paintImageMaskXObject,
          ]);
          pages.push({
            index: pageIndex,
            width: viewport.width,
            height: viewport.height,
            hasImages: operators.fnArray.some((op) => imageOps.has(op)),
          });
          let previous: ResumeLine | undefined;
          let endOfLine = false;
          for (const entry of content.items) {
            if (!('str' in entry)) continue;
            const item: TextItem = entry;
            length += item.str.length;
            if (length > 200_000)
              throw new Error(
                'This PDF contains too much text. Upload only your resume pages or paste the text.'
              );
            const transform = pdfjs.Util.transform(viewport.transform, item.transform);
            const fontSize = Math.hypot(transform[2], transform[3]);
            const axis = Math.hypot(transform[0], transform[1]) || 1;
            const dx = (transform[0] / axis) * item.width;
            const dy = (transform[1] / axis) * item.width;
            const corners = [
              [transform[4], transform[5]],
              [transform[4] + dx, transform[5] + dy],
              [transform[4] + transform[2], transform[5] + transform[3]],
              [transform[4] + dx + transform[2], transform[5] + dy + transform[3]],
            ];
            const x = Math.min(...corners.map((point) => point[0]));
            const y = Math.min(...corners.map((point) => point[1]));
            const box = {
              x,
              y,
              width: Math.max(...corners.map((point) => point[0])) - x,
              height: Math.max(...corners.map((point) => point[1])) - y,
            };
            const fragment: ResumeTextItem = {
              text: item.str,
              box,
              fontName: item.fontName,
              fontSize,
            };
            // pdf.js emits a synthetic space spanning the gutter between columns.
            // Keep its item metadata without letting it widen a text line's box.
            if (!item.str.trim()) {
              if (previous) previous.items.push(fragment);
              endOfLine ||= item.hasEOL;
              continue;
            }
            const oldBox = previous?.box;
            const gap = oldBox ? box.x - (oldBox.x + oldBox.width) : 0;
            const sameLine =
              previous &&
              oldBox &&
              !endOfLine &&
              Math.abs(box.y - oldBox.y) <= Math.max(2, fontSize / 2) &&
              gap >= -2 &&
              gap <= Math.max(12, fontSize * 2);
            if (sameLine && previous && oldBox) {
              const space =
                gap > Math.max(1, fontSize / 10) &&
                !/\s$/.test(previous.text) &&
                !/^\s/.test(item.str)
                  ? ' '
                  : '';
              previous.text += space + item.str;
              previous.box = union(oldBox, box);
              previous.items.push(fragment);
            } else if (item.str.trim()) {
              previous = {
                id: `pdf:${pageIndex}:${lines.length}`,
                text: item.str,
                pageIndex,
                box,
                fontName: item.fontName,
                fontSize,
                origin: { kind: 'body', part: `page:${pageIndex}` },
                bullet: false,
                items: [fragment],
              };
              lines.push(previous);
            }
            endOfLine = item.hasEOL;
          }
        } finally {
          page.cleanup();
        }
      }
      for (const line of lines) {
        line.text = line.text.trimEnd();
        line.bullet = /^\s*[-•*◦○●▪]\s+/.test(line.text);
      }
      return recomputeDoc(
        normalizePdfLines({
          source: 'pdf',
          file: { name: file.name, sizeBytes: file.size, pageCount: pdf.numPages },
          pages,
          lines,
          extractionOrder: [],
          geometricOrder: [],
          sections: [],
          contact: { email: null, phone: null, links: [] },
          plainText: '',
          findings: [],
        })
      );
    };
    return await Promise.race([
      extract(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          canceled = true;
          reject(
            new Error('Reading this PDF took too long. Try a smaller PDF, DOCX, or paste the text.')
          );
        }, 20_000);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error(
        'This PDF is password-protected. Save an unlocked copy or paste the resume text.'
      );
    if (error instanceof Error && /^(This PDF|Reading this PDF)/.test(error.message)) throw error;
    throw new Error('Could not read this PDF. It may be damaged or unsupported.', { cause: error });
  } finally {
    canceled = true;
    if (timer) clearTimeout(timer);
    await loading.destroy();
  }
}
