import { deflateSync } from 'node:zlib';

export function pdfFile(stream: string, compressed = true): File {
  const data = compressed ? deflateSync(Buffer.from(stream)) : Buffer.from(stream);
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'
    ),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([
      Buffer.from(
        '<< /Length ' + data.length + (compressed ? ' /Filter /FlateDecode' : '') + ' >>\nstream\n'
      ),
      data,
      Buffer.from('\nendstream'),
    ]),
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(Buffer.from(index + 1 + ' 0 obj\n'), object, Buffer.from('\nendobj\n'));
  }
  const xref = parts.reduce((sum, part) => sum + part.length, 0);
  parts.push(
    Buffer.from(
      'xref\n0 6\n0000000000 65535 f \n' +
        offsets
          .slice(1)
          .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
          .join('') +
        'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
        xref +
        '\n%%EOF'
    )
  );
  return new File(parts, 'resume.pdf', { type: 'application/pdf' });
}

export function japanesePdfFile(): File {
  const stream =
    'BT /F1 12 Tf 72 720 Td (English resume heading) Tj /F2 12 Tf 0 -24 Td <82b182f182c982bf82cd> Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /90ms-RKSJ-H /DescendantFonts [7 0 R] >>',
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 2 >> /FontDescriptor 8 0 R /DW 1000 >>',
    '<< /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>',
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`));
  }
  const xref = parts.reduce((sum, part) => sum + part.length, 0);
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
        .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    )
  );
  return new File(parts, 'japanese-resume.pdf', { type: 'application/pdf' });
}
