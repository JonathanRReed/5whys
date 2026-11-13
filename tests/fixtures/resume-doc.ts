import JSZip from 'jszip';
import { pdfFile } from './resume-pdfs';

export const studentLines = [
  'Jordan Lee',
  'jordan.lee@example.edu | (555) 201-4477 | linkedin.com/in/jordanlee',
  'Education',
  'State University, B.A. Communications, May 2027',
  'Experience',
  'Campus radio assistant, Sep 2025 - Present',
  '- Built accessible event guides for new students.',
  '- Trained classmates to publish the weekly newsletter.',
  'Skills',
  'Writing, Excel, Spanish',
];
export const studentText = studentLines.join('\n');
function pdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
export function positionedText(text: string, x: number, y: number): string {
  return `BT /F1 10 Tf ${x} ${y} Td (${pdfString(text)}) Tj ET`;
}
export function singleColumnPdf(): File {
  return pdfFile(
    studentLines.map((text, index) => positionedText(text, 60, 720 - index * 24)).join('\n')
  );
}
export function columnPdf(sidebar = false): File {
  const right = sidebar ? 240 : 320;
  const leftLines = ['Education', 'State University', 'May 2027', 'Skills', 'Excel, Spanish'];
  const rightLines = [
    'Experience',
    'Campus radio assistant',
    'Sep 2025 - Present',
    '- Built event guides.',
    '- Trained classmates.',
  ];
  const rows = leftLines.flatMap((text, index) => [
    positionedText(text, 60, 648 - index * 24),
    positionedText(rightLines[index], right, 648 - index * 24),
  ]);
  return pdfFile(
    [
      positionedText(studentLines[0], 60, 720),
      positionedText(studentLines[1], 60, 696),
      ...rows,
    ].join('\n')
  );
}
/** Browser-like line spacing, hanging indents, and interleaved CSS-grid columns. */
export function wrappedResumePdf(): File {
  const left = [
    ['Summary', 60, 648],
    ['Communications student building accessible', 60, 628],
    ['campus events with classmates at university.', 60, 614],
    ['Education', 60, 580],
    ['State University', 60, 560],
    ['May 2027', 60, 546],
    ['Skills', 60, 520],
    ['Writing, Excel, Spanish', 60, 500],
  ] as const;
  const right = [
    ['Experience', 360, 648],
    ['Campus radio assistant', 360, 628],
    ['Sep 2025 - Present', 360, 614],
    ['- Grew the station Instagram from 400 to', 360, 590],
    ['2,100 followers by posting three times', 368, 576],
    ['a week', 368, 562],
    ['- Built accessible event guides.', 360, 538],
    ['- Trained classmates.', 360, 514],
  ] as const;
  return pdfFile(
    [
      positionedText('Jordan Lee', 60, 740),
      positionedText('jordan.lee@example.edu', 60, 726),
      positionedText('(555) 201-4477', 60, 712),
      ...left.flatMap(([text, x, y], index) => [
        positionedText(text, x, y),
        positionedText(right[index][0], right[index][1], right[index][2]),
      ]),
    ].join('\n')
  );
}

export function separateBulletPdf(): File {
  return pdfFile(
    [
      positionedText('Jordan Lee', 60, 720),
      positionedText('Experience', 60, 690),
      positionedText('Campus radio assistant', 60, 670),
      // Standard-encoding bullet, with its own text object and font size.
      'BT /F1 8 Tf 66 650 Td (\\267) Tj ET',
      positionedText('Built accessible event guides.', 80, 650),
      // A glyph emitted after the text must still attach to its line.
      positionedText('Trained classmates.', 80, 630),
      positionedText('o', 66, 630),
    ].join('\n')
  );
}

export function indentedBulletPdf(): File {
  return pdfFile(
    [
      positionedText('Jordan Lee', 60, 720),
      positionedText('Experience', 60, 690),
      positionedText('Campus radio assistant, Sep 2025 - Present', 60, 670),
      positionedText('Built accessible event guides.', 78, 650),
      positionedText('Trained classmates.', 78, 630),
      positionedText('Projects', 60, 600),
      positionedText('Campus newsletter', 60, 580),
      positionedText('Edited stories for the student paper.', 78, 560),
      positionedText('Published weekly campus updates.', 78, 540),
      positionedText('Education', 60, 510),
      positionedText('State University', 60, 490),
      positionedText('B.A. Communications', 78, 470),
      positionedText('May 2027', 78, 450),
    ].join('\n')
  );
}

export function headerContactPdf(): File {
  return pdfFile(
    studentLines
      .map((text, index) => positionedText(text, 60, index === 1 ? 780 : 720 - index * 24))
      .join('\n')
  );
}

/** Small real image XObject, with optional readable pages ahead of it. */
export function imagePagePdf(readablePages = 0, image = true): File {
  const count = readablePages + (image ? 1 : 0);
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from(
      `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${count} >>`
    ),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([
      Buffer.from(
        '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n'
      ),
      Buffer.from([40, 70, 50]),
      Buffer.from('\nendstream'),
    ]),
  ];
  for (let index = 0; index < count; index += 1) {
    const stream =
      index < readablePages
        ? studentLines.map((text, line) => positionedText(text, 60, 720 - line * 24)).join('\n')
        : 'q 100 0 0 100 60 600 cm /Im1 Do Q';
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`
      ),
      Buffer.from(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    );
  }
  const parts = [Buffer.from('%PDF-1.4\n')];
  let length = parts[0].length;
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const part = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(part);
    length += part.length;
  }
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          ''
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`
    )
  );
  return new File(parts, 'image-page.pdf', { type: 'application/pdf' });
}
export const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export function xmlParagraph(text: string, bullet = false): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<w:p>${bullet ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : ''}<w:r><w:t>${escaped}</w:t></w:r></w:p>`;
}
export async function docxBytes(
  body: string,
  parts: Record<string, string> = {}
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<w:document xmlns:w="${wordNamespace}"><w:body>${body}</w:body></w:document>`
  );
  for (const [name, content] of Object.entries(parts)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export function tableDocx(): Promise<Uint8Array> {
  return docxBytes(
    `<w:tbl>${studentLines.map((text) => `<w:tr><w:tc>${xmlParagraph(text)}</w:tc></w:tr>`).join('')}</w:tbl>`
  );
}
export function headerDocx(): Promise<Uint8Array> {
  return docxBytes(
    studentLines
      .filter((_, index) => index !== 1)
      .map((text) => xmlParagraph(text))
      .join(''),
    {
      'word/header1.xml': `<w:hdr xmlns:w="${wordNamespace}">${xmlParagraph(studentLines[1])}</w:hdr>`,
    }
  );
}
export function textBoxDocx(): Promise<Uint8Array> {
  return docxBytes(
    studentLines
      .map((text, index) =>
        index === 6
          ? `<w:p><w:r><w:drawing><w:txbxContent>${xmlParagraph(text)}</w:txbxContent></w:drawing></w:r></w:p>`
          : xmlParagraph(text)
      )
      .join('')
  );
}
