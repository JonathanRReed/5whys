import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import JSZip from 'jszip';
import readXlsxFile from 'read-excel-file/node';
import type { Geography } from '../../src/lib/pay/types';
import { buildWageFile, parseDelimited, records, WAGE_COLUMNS, type WireWages } from './rows';
import { BLS_ROOT, sourceReceipt } from './sources';

type Row = Record<string, string>;
const NATIONAL: Geography = {
  id: 'national',
  name: 'United States',
  level: 'national',
  areaType: 'national',
  stateIds: [],
};
// FIPS and USPS identifiers, including the jurisdictions in OEWS state tables.
const STATES =
  '01 AL|02 AK|04 AZ|05 AR|06 CA|08 CO|09 CT|10 DE|11 DC|12 FL|13 GA|15 HI|16 ID|17 IL|18 IN|19 IA|20 KS|21 KY|22 LA|23 ME|24 MD|25 MA|26 MI|27 MN|28 MS|29 MO|30 MT|31 NE|32 NV|33 NH|34 NJ|35 NM|36 NY|37 NC|38 ND|39 OH|40 OK|41 OR|42 PA|44 RI|45 SC|46 SD|47 TN|48 TX|49 UT|50 VT|51 VA|53 WA|54 WV|55 WI|56 WY|66 GU|72 PR|78 VI';
const fipsByAbbreviation = new Map(
  STATES.split('|').map((pair) => {
    const [fips, abbreviation] = pair.split(' ');
    return [abbreviation ?? '', fips ?? ''];
  })
);

function stateId(raw: string): string {
  if (/^\d{2}00000$/.test(raw)) raw = raw.slice(0, 2);
  if (
    !/^\d{1,2}$/.test(raw) ||
    !STATES.split('|').some((pair) => pair.startsWith(`${raw.padStart(2, '0')} `))
  )
    throw new Error(`Invalid state FIPS: ${raw}`);
  return `state-${raw.padStart(2, '0')}`;
}

function validateCoverage(files: WireWages[]): WireWages[] {
  const national = files.find((file) => file.geography.id === 'national');
  if (!national || Object.keys(national.wages).length < 700)
    throw new Error('National occupation coverage is incomplete');
  if (
    files.filter((file) => file.geography.level === 'state').length < 50 ||
    files.filter((file) => file.geography.level === 'area').length < 500
  )
    throw new Error('State or area coverage is incomplete');
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.geography.id)) throw new Error('Duplicate geography file');
    seen.add(file.geography.id);
    for (const [code, title] of Object.entries(file.occupations)) {
      if (!national.occupations[code] || national.occupations[code] !== title)
        throw new Error(`Inconsistent occupation: ${file.geography.id}/${code}`);
    }
  }
  return files;
}

export async function readBlsZips(files: string[]) {
  const buckets = new Map<string, { geography: Geography; rows: Row[] }>();
  const sources = [];
  const pendingAreas: Row[] = [];
  for (const file of files) {
    const archive = await JSZip.loadAsync(await readFile(file));
    const schemas: Record<string, string[]> = {};
    const notes: string[] = [];
    let sheetsFound = 0;
    for (const entry of Object.values(archive.files).filter(
      (entry) => /\.xlsx$/i.test(entry.name) && !entry.name.startsWith('__MACOSX/')
    )) {
      if (!/(?:^|\D)2025(?:\D|$)/.test(entry.name))
        throw new Error(`Expected a May 2025 workbook filename: ${entry.name}`);
      const sheets = await readXlsxFile(await entry.async('nodebuffer'));
      for (const sheet of sheets) {
        const headerIndex = sheet.data.findIndex(
          (row) => row.includes('OCC_CODE') && row.includes('TOT_EMP')
        );
        if (headerIndex < 0) continue;
        const headers = sheet.data[headerIndex]?.map((cell) => String(cell ?? '').trim()) ?? [];
        schemas[`${entry.name}/${sheet.sheet}`] = headers;
        const data = sheet.data
          .slice(headerIndex + 1)
          .filter((row) => row.some((cell) => cell !== null))
          .map((row) => {
            if (row.slice(headers.length).some((cell) => cell !== null && cell !== ''))
              throw new Error('Unexpected extra workbook cells');
            return headers.map((_, i) => String(row[i] ?? ''));
          });
        const codeColumn = headers.indexOf('OCC_CODE');
        const footer = data.findIndex(
          (row) =>
            !row[codeColumn] &&
            /^(?:\(\d+\)|\*|#|Footnotes?:|Notes?:|Source:)/i.test(
              row.find((cell) => cell.trim()) ?? ''
            )
        );
        if (footer >= 0) {
          if (
            data
              .slice(footer)
              .some((row) => row[codeColumn] && /^\d{2}-\d{4}$/.test(row[codeColumn] ?? ''))
          )
            throw new Error('Data after workbook footnotes');
          notes.push(...data.splice(footer).map((row) => row.filter(Boolean).join(' ')));
        }
        const rows = records(
          [headers, ...data],
          ['OCC_CODE', 'OCC_TITLE', 'O_GROUP', ...WAGE_COLUMNS]
        );
        sheetsFound++;
        for (const row of rows) {
          if (!['total', 'major', 'minor', 'broad', 'detailed'].includes(row.O_GROUP ?? ''))
            throw new Error(`Unknown occupation group: ${row.O_GROUP}`);
          if (row.O_GROUP !== 'detailed') continue;
          if ('NAICS' in row && row.NAICS !== '000000') continue;
          if ('OWN_CODE' in row && row.OWN_CODE !== '1235') continue;
          if (path.basename(file) === 'oesm25ma.zip') {
            pendingAreas.push(row);
            continue;
          }
          const geography: Geography =
            path.basename(file) === 'oesm25nat.zip'
              ? NATIONAL
              : {
                  id: stateId(row.AREA ?? ''),
                  name: row.AREA_TITLE ?? '',
                  level: 'state',
                  areaType: 'state',
                  stateIds: [],
                };
          const bucket = buckets.get(geography.id);
          if (bucket && bucket.geography.name !== geography.name)
            throw new Error('Inconsistent geography name');
          if (bucket) bucket.rows.push(row);
          else buckets.set(geography.id, { geography, rows: [row] });
        }
      }
    }
    if (!sheetsFound) throw new Error(`No OEWS data sheet in ${file}`);
    sources.push(
      await sourceReceipt(
        file,
        `https://www.bls.gov/oes/special-requests/${path.basename(file)}`,
        schemas,
        'bls',
        notes
      )
    );
  }
  for (const row of pendingAreas) {
    if (!/^\d{1,7}$/.test(row.AREA ?? '') || !row.AREA_TITLE)
      throw new Error('Invalid area code or name');
    if (!['4', '6'].includes(row.AREA_TYPE ?? ''))
      throw new Error(`Unknown area type: ${row.AREA_TYPE}`);
    const nonmetro = row.AREA_TYPE === '6';
    const names = row.AREA_TITLE.split(', ').at(-1)?.split('-') ?? [];
    const parentStates = nonmetro
      ? [...buckets.values()]
          .filter(
            ({ geography }) =>
              geography.level === 'state' && row.AREA_TITLE?.includes(geography.name)
          )
          .map(({ geography }) => geography.id)
      : names.map((name) => {
          const fips = fipsByAbbreviation.get(name);
          if (!fips) throw new Error(`Unknown state abbreviation in ${row.AREA_TITLE}`);
          return stateId(fips);
        });
    if (!parentStates.length || parentStates.some((id) => !buckets.has(id)))
      throw new Error(`Missing state for ${row.AREA_TITLE}`);
    const geography: Geography = {
      id: `area-${row.AREA?.padStart(7, '0')}`,
      name: row.AREA_TITLE,
      level: 'area',
      areaType: nonmetro ? 'nonmetropolitan' : 'metropolitan',
      stateIds: [...new Set(parentStates)].sort(),
    };
    const bucket = buckets.get(geography.id);
    if (bucket && JSON.stringify(bucket.geography) !== JSON.stringify(geography))
      throw new Error('Conflicting area identity');
    if (bucket) bucket.rows.push(row);
    else buckets.set(geography.id, { geography, rows: [row] });
  }
  return {
    files: validateCoverage(
      [...buckets.values()].map(({ geography, rows }) => buildWageFile(geography, rows))
    ),
    sources,
  };
}

export async function readBlsFlat(input: string, dataFile: string) {
  const sources = [];
  const tables: Record<string, Row[]> = {};
  const required: Record<string, string[]> = {
    'oe.area': ['state_code', 'area_code', 'areatype_code', 'area_name'],
    'oe.occupation': ['occupation_code', 'occupation_name', 'display_level'],
    'oe.datatype': ['datatype_code', 'datatype_name'],
    'oe.footnote': ['footnote_code', 'footnote_text'],
  };
  for (const [name, headers] of Object.entries(required)) {
    const file = path.join(input, name);
    const data = parseDelimited(await readFile(file, 'utf8'), '\t');
    tables[name] = records(data, headers);
    sources.push(
      await sourceReceipt(
        file,
        BLS_ROOT + name,
        { table: data[0] ?? [] },
        'bls',
        name === 'oe.footnote'
          ? (tables[name] ?? []).map((row) => `${row.footnote_code}: ${row.footnote_text}`)
          : []
      )
    );
  }
  const geographies = new Map<string, Geography>();
  const areaKeys = new Set<string>();
  for (const row of tables['oe.area'] ?? []) {
    const key = `${row.areatype_code}${row.area_code}`;
    if (!/^\d{7}$/.test(row.area_code ?? '') || !row.area_name)
      throw new Error('Invalid flat-file geography');
    if (row.areatype_code === 'N') {
      if (geographies.has(key)) throw new Error('Duplicate national geography');
      geographies.set(key, NATIONAL);
      continue;
    }
    if (!['S', 'M'].includes(row.areatype_code ?? ''))
      throw new Error('Unknown flat-file area type');
    const parent = stateId(row.state_code ?? '');
    const unique = `${key}/${parent}`;
    if (areaKeys.has(unique)) throw new Error('Duplicate source area key');
    areaKeys.add(unique);
    const previous = geographies.get(key);
    if (previous && previous.name !== row.area_name)
      throw new Error('Conflicting flat-file area name');
    geographies.set(
      key,
      row.areatype_code === 'S'
        ? { id: parent, name: row.area_name, level: 'state', areaType: 'state', stateIds: [] }
        : {
            id: `area-${row.area_code}`,
            name: row.area_name,
            level: 'area',
            areaType: row.area_name.toLowerCase().includes('nonmetropolitan')
              ? 'nonmetropolitan'
              : 'metropolitan',
            stateIds: [...new Set([...(previous?.stateIds ?? []), parent])].sort(),
          }
    );
  }
  const occupations = new Map<string, string>();
  for (const row of tables['oe.occupation'] ?? []) {
    if (
      !/^\d{6}$/.test(row.occupation_code ?? '') ||
      !row.occupation_name ||
      occupations.has(row.occupation_code ?? '')
    )
      throw new Error('Invalid occupation dictionary');
    occupations.set(row.occupation_code ?? '', row.occupation_name);
  }
  const datatypeColumns: Record<string, string> = {
    '01': 'TOT_EMP',
    '03': 'H_MEAN',
    '04': 'A_MEAN',
    '06': 'H_PCT10',
    '07': 'H_PCT25',
    '08': 'H_MEDIAN',
    '09': 'H_PCT75',
    '10': 'H_PCT90',
    '11': 'A_PCT10',
    '12': 'A_PCT25',
    '13': 'A_MEDIAN',
    '14': 'A_PCT75',
    '15': 'A_PCT90',
  };
  for (const [datatype, column] of Object.entries(datatypeColumns)) {
    const entry = tables['oe.datatype']?.find((row) => row.datatype_code === datatype);
    const expected =
      column === 'TOT_EMP' ? /employment/i : column.startsWith('H_') ? /hourly/i : /annual/i;
    if (!entry || !expected.test(entry.datatype_name ?? ''))
      throw new Error(`Unexpected units for ${datatype}`);
  }
  const footnotes = new Map(
    (tables['oe.footnote'] ?? []).map((row) => [row.footnote_code, row.footnote_text])
  );
  const buckets = new Map<string, Map<string, Row>>();
  const seen = new Set<string>();
  const lines = createInterface({
    input: createReadStream(dataFile),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  let headers: string[] | undefined;
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = line.split('\t').map((cell) => cell.trim());
      records([headers], ['series_id', 'year', 'period', 'value', 'footnote_codes']);
      continue;
    }
    const row = records([headers, line.split('\t')], headers)[0];
    if (row?.year !== '2025') continue;
    if (row.period !== 'A01') throw new Error('Unexpected OEWS reference period');
    const match = /^OEU([NSM])(\d{7})(\d{6})(\d{6})(\d{2})$/.exec(row.series_id ?? '');
    if (!match) throw new Error('Unexpected OEWS series identifier');
    const [, type, area, industry, occupation, datatype] = match;
    if (industry !== '000000' || !datatype || !datatypeColumns[datatype] || !occupation) continue;
    const key = `${type}${area}`;
    if (!geographies.has(key) || !occupations.has(occupation))
      throw new Error('Unknown series geography or occupation');
    const unique = `${key}/${occupation}/${datatype}`;
    if (seen.has(unique)) throw new Error('Duplicate OEWS observation');
    seen.add(unique);
    let value = row.value ?? '';
    if (row.footnote_codes) {
      for (const footnote of row.footnote_codes
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)) {
        const note = footnotes.get(footnote);
        if (!note) throw new Error(`Unknown source footnote ${footnote}`);
        if (/equal to or greater than|at or above/i.test(note)) {
          if (!/115\.00/.test(note) || !/239,?200/.test(note))
            throw new Error('Unrecognized top-coding threshold');
          value = '#';
        } else if (
          /not (available|published)|suppressed|does not (meet|calculate)|not (release|estimate)/i.test(
            note
          )
        )
          value = '*';
        else throw new Error(`Unclassified source footnote ${footnote}: ${note}`);
      }
    }
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = new Map();
      buckets.set(key, bucket);
    }
    let target = bucket.get(occupation);
    if (!target) {
      target = Object.fromEntries(WAGE_COLUMNS.map((column) => [column, '']));
      target.OCC_CODE = `${occupation.slice(0, 2)}-${occupation.slice(2)}`;
      target.OCC_TITLE = occupations.get(occupation) ?? '';
      bucket.set(occupation, target);
    }
    target[datatypeColumns[datatype] ?? ''] = value;
    if (row.footnote_codes)
      target[`${datatypeColumns[datatype]}_SOURCE_MARKER`] =
        `${row.value}; footnotes ${row.footnote_codes}`;
  }
  const nationalCodes = [...(buckets.get('N0000000')?.keys() ?? [])];
  const leaves = new Set(
    nationalCodes.filter((code) => {
      if (code.endsWith('00') || code === '000000') return false;
      return (
        !code.endsWith('0') ||
        !nationalCodes.some((child) => child !== code && child.startsWith(code.slice(0, -1)))
      );
    })
  );
  const files = [...buckets.entries()].map(([key, rows]) => {
    const geography = geographies.get(key);
    if (!geography) throw new Error('Missing geography');
    return buildWageFile(
      geography,
      [...rows.entries()].filter(([code]) => leaves.has(code)).map(([, row]) => row)
    );
  });
  sources.push(
    await sourceReceipt(
      dataFile,
      BLS_ROOT + path.basename(dataFile),
      { table: headers ?? [] },
      'bls'
    )
  );
  return { files: validateCoverage(files), sources };
}
