// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { expect, test } from 'vitest';
import { readBlsFlat, readBlsZips } from '../scripts/pay-data/bls';
import { WAGE_COLUMNS } from '../scripts/pay-data/rows';

// Invented values for parser tests only. These files never enter public/data/pay.
const values = [
  '100',
  '30',
  '60000',
  '10',
  '20',
  '30',
  '40',
  '50',
  '20000',
  '40000',
  '60000',
  '80000',
  '100000',
];
const states =
  '01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55'.split(
    ' '
  );
const codes = Array.from(
  { length: 700 },
  (_, i) => `11-${1000 + Math.floor(i / 9) * 10 + (i % 9) + 1}`
);

async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const xml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function column(index: number): string {
    return index < 26
      ? String.fromCharCode(65 + index)
      : `${column(Math.floor(index / 26) - 1)}${column(index % 26)}`;
  }
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  );
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fixture" sheetId="1" r:id="rId1"/></sheets></workbook>'
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  );
  const data = [headers, ...rows]
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row.map((cell, j) => `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')}</row>`
    )
    .join('');
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data}</sheetData></worksheet>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('reads synthetic BLS XLSX ZIPs, preserves flags, captures notes, and splits all geographies', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pay-xlsx-test-'));
  try {
    const headers = [
      'AREA',
      'AREA_TITLE',
      'AREA_TYPE',
      'NAICS',
      'OWN_CODE',
      'OCC_CODE',
      'OCC_TITLE',
      'O_GROUP',
      ...WAGE_COLUMNS,
    ];
    const row = (area: string, title: string, type: string, code: string) => [
      area,
      title,
      type,
      '000000',
      '1235',
      code,
      `Fixture ${code}`,
      'detailed',
      ...values,
    ];
    const nationalRows = codes.map((code) => row('0000000', 'National', '1', code));
    const note = headers.map(() => '');
    note[0] = '* Not published';
    nationalRows.push(note);
    const fixtures = [
      ['oesm25nat.zip', nationalRows],
      [
        'oesm25st.zip',
        states.map((state) =>
          row(state, state === '06' ? 'California' : `Fixture state ${state}`, '2', codes[0] ?? '')
        ),
      ],
      [
        'oesm25ma.zip',
        Array.from({ length: 500 }, (_, i) =>
          row(String(10000 + i), `Fixture city ${i}, CA`, '4', codes[0] ?? '')
        ),
      ],
    ] as const;
    const files = [];
    for (const [name, rows] of fixtures) {
      const archive = new JSZip();
      archive.file('fixture_M2025.xlsx', await workbook(headers, [...rows]));
      const file = path.join(directory, name);
      await writeFile(file, await archive.generateAsync({ type: 'nodebuffer' }));
      files.push(file);
    }
    const result = await readBlsZips(files);
    expect(result.files).toHaveLength(551);
    expect(
      result.files.find((file) => file.geography.id === 'national')?.occupations
    ).toHaveProperty(codes[0] ?? '');
    expect(
      result.files.find((file) => file.geography.id === 'area-0010000')?.geography.stateIds
    ).toEqual(['state-06']);
    expect(result.sources[0]?.notes).toEqual(['* Not published']);
    expect(result.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
    const wrongRelease = new JSZip();
    wrongRelease.file('fixture_M2024.xlsx', await workbook(headers, nationalRows));
    const nationalFile = path.join(directory, 'oesm25nat.zip');
    await writeFile(nationalFile, await wrongRelease.generateAsync({ type: 'nodebuffer' }));
    await expect(readBlsZips([nationalFile])).rejects.toThrow('May 2025 workbook');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reads synthetic BLS flat files with missing series and explicit suppression footnotes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pay-flat-test-'));
  try {
    const areaRows = [
      '00\t0000000\tN\tNational',
      ...states.map((state) => `${state}\t${state}00000\tS\tFixture state ${state}`),
      ...Array.from(
        { length: 500 },
        (_, i) => `06\t${String(10000 + i).padStart(7, '0')}\tM\tFixture city ${i}, CA`
      ),
    ];
    await writeFile(
      path.join(directory, 'oe.area'),
      `state_code\tarea_code\tareatype_code\tarea_name\n${areaRows.join('\n')}\n`
    );
    await writeFile(
      path.join(directory, 'oe.occupation'),
      `occupation_code\toccupation_name\tdisplay_level\n${codes.map((code) => `${code.replace('-', '')}\tFixture ${code}\t3`).join('\n')}\n`
    );
    const datatypes = [
      '01',
      '03',
      '04',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ];
    await writeFile(
      path.join(directory, 'oe.datatype'),
      `datatype_code\tdatatype_name\n${datatypes.map((code, i) => `${code}\t${i === 0 ? 'Employment' : i === 1 || (i >= 3 && i <= 7) ? 'Hourly wage' : 'Annual wage'}`).join('\n')}\n`
    );
    await writeFile(
      path.join(directory, 'oe.footnote'),
      'footnote_code\tfootnote_text\n1\tNot published\n'
    );
    const dataRows: string[] = [];
    const add = (type: string, area: string, code: string, suppressed: boolean) => {
      datatypes.forEach((datatype, i) => {
        if (suppressed && i === 1) return;
        dataRows.push(
          `OEU${type}${area}000000${code.replace('-', '')}${datatype}\t2025\tA01\t${values[i]}\t${suppressed && i === 3 ? '1' : ''}`
        );
      });
    };
    for (const code of codes) add('N', '0000000', code, false);
    for (const state of states) add('S', `${state}00000`, codes[0] ?? '', false);
    for (let i = 0; i < 500; i++)
      add('M', String(10000 + i).padStart(7, '0'), codes[0] ?? '', true);
    const file = path.join(directory, 'oe.data.0.Current');
    await writeFile(
      file,
      `series_id\tyear\tperiod\tvalue\tfootnote_codes\n${dataRows.join('\n')}\n`
    );
    const result = await readBlsFlat(directory, file);
    expect(result.files).toHaveLength(551);
    const local = result.files.find((file) => file.geography.id === 'area-0010000');
    expect(local?.wages[codes[0] ?? '']?.[1]).toEqual({ kind: 'missing' });
    expect(local?.wages[codes[0] ?? '']?.[3]).toEqual({
      kind: 'not-published',
      marker: '10; footnotes 1',
    });
    expect(result.sources).toHaveLength(5);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
