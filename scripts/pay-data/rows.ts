import { normalizeTitle } from '../../src/lib/pay/search';
import type { Geography, OccupationCrosswalk, PayValue, TitleRow } from '../../src/lib/pay/types';
import { parseTitleIndex, parseWageDataset } from '../../src/lib/pay/validate';

export const WAGE_COLUMNS = [
  'TOT_EMP',
  'H_MEAN',
  'A_MEAN',
  'H_PCT10',
  'H_PCT25',
  'H_MEDIAN',
  'H_PCT75',
  'H_PCT90',
  'A_PCT10',
  'A_PCT25',
  'A_MEDIAN',
  'A_PCT75',
  'A_PCT90',
] as const;
export const PERIOD = { referencePeriod: 'May 2025', publicationDate: '2026-05-15' } as const;
type SourceRow = Record<string, string>;
export type WireValue = number | Exclude<PayValue, { kind: 'published' }>;
export interface WireWages {
  schemaVersion: 1;
  referencePeriod: string;
  publicationDate: string;
  geography: Geography;
  occupations: Record<string, string>;
  wages: Record<string, WireValue[]>;
}

export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === '"') {
      if (field || closed) throw new Error('Malformed quoted field');
      quoted = true;
    } else if (char === delimiter || char === '\n' || char === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (char !== delimiter) {
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        if (char === '\r' && input[i + 1] === '\n') i++;
      }
    } else {
      if (closed) throw new Error('Text after quoted field');
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed quoted field');
  if (field || row.length || closed) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function records(rows: string[][], required: readonly string[]): SourceRow[] {
  const [rawHeaders, ...data] = rows;
  const headers = rawHeaders?.map((header) => header.trim()) ?? [];
  if (
    new Set(headers).size !== headers.length ||
    required.some((header) => !headers.includes(header))
  )
    throw new Error(`Expected headers: ${required.join(', ')}`);
  return data.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error(
        `Malformed row ${index + 2}: ${row.length} cells, expected ${headers.length}`
      );
    return Object.fromEntries(headers.map((header, i) => [header, row[i]?.trim() ?? '']));
  });
}

export function sourceValue(raw: string, column: string, sourceMarker?: string): WireValue {
  const value = raw.trim();
  if (!value) return { kind: 'missing' };
  if (['*', '**', '-', 'N/A'].includes(value))
    return { kind: 'not-published', marker: sourceMarker ?? value };
  if (value === '#') {
    if (!column.startsWith('H_') && !column.startsWith('A_'))
      throw new Error('Top-coded employment is not a wage');
    return {
      kind: 'at-or-above',
      value: column.startsWith('H_') ? 115 : 239200,
      marker: sourceMarker ?? '#',
    };
  }
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))
    throw new Error(`Invalid ${column} value: ${raw}`);
  const numeric = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0)
    throw new Error(`Invalid ${column} amount: ${raw}`);
  if ((column === 'TOT_EMP' || column.startsWith('A_')) && !Number.isInteger(numeric))
    throw new Error(`Invalid ${column} units: ${raw}`);
  return numeric;
}

export function buildTitleIndex(
  occupationRows: SourceRow[],
  jobRows: SourceRow[],
  reportedRows: SourceRow[]
) {
  const occupations: [string, string][] = [];
  const byCode = new Map<string, number>();
  for (const row of occupationRows) {
    const code = row['O*NET-SOC Code'] ?? '';
    const title = row.Title ?? '';
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(code) || !title || byCode.has(code))
      throw new Error(`Invalid or duplicate O*NET occupation: ${code}`);
    byCode.set(code, occupations.length);
    occupations.push([code, title]);
  }
  const titles = new Map<string, TitleRow>();
  function add(code: string, title: string, source: number) {
    const index = byCode.get(code);
    if (index === undefined || !title.trim()) throw new Error(`Invalid title occupation: ${code}`);
    // Keep original text and all source bits. Normalize only the deduplication key.
    const key = `${index}\0${normalizeTitle(title)}`;
    const existing = titles.get(key);
    if (existing) existing[2] |= source;
    else titles.set(key, [title, index, source]);
  }
  for (const [code, title] of occupations) add(code, title, 1);
  for (const row of jobRows) {
    const code = row['O*NET-SOC Code'] ?? '';
    if (occupations[byCode.get(code) ?? -1]?.[1] !== row.Title)
      throw new Error('Job title has inconsistent occupation title');
    add(code, row['Job Title'] ?? '', 2);
    if (row['Short Title']) add(code, row['Short Title'], 2);
  }
  for (const row of reportedRows) {
    const code = row['O*NET-SOC Code'] ?? '';
    if (occupations[byCode.get(code) ?? -1]?.[1] !== row.Title)
      throw new Error('Reported title has inconsistent occupation title');
    add(code, row['Reported Job Title'] ?? '', 4);
  }
  const wire = {
    schemaVersion: 1,
    release: '31.0',
    occupations,
    titles: [...titles.values()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])),
  };
  parseTitleIndex(wire);
  return wire;
}

export function buildCrosswalk(
  onetCodes: string[],
  occupations: Record<string, string>
): OccupationCrosswalk {
  return Object.fromEntries(
    onetCodes.map((onetCode) => {
      const soc = onetCode.slice(0, 7);
      const broad = `${soc.slice(0, -1)}0`;
      if (occupations[soc])
        return [
          onetCode,
          {
            kind: onetCode.endsWith('.00') ? 'same-soc' : 'broader',
            occupationCode: soc,
            note: onetCode.endsWith('.00')
              ? 'OEWS publishes this SOC occupation.'
              : 'OEWS publishes the whole SOC occupation, including this O*NET specialty.',
          },
        ];
      if (occupations[broad])
        return [
          onetCode,
          {
            kind: 'broader',
            occupationCode: broad,
            note: `OEWS publishes the broader SOC group ${broad}, ${occupations[broad]}.`,
          },
        ];
      return [
        onetCode,
        {
          kind: 'unavailable',
          occupationCode: null,
          note: 'No direct SOC or published SOC broad-group match. No wage mapping was inferred.',
        },
      ];
    })
  );
}

export function buildWageFile(geography: Geography, rows: SourceRow[]): WireWages {
  const occupations: Record<string, string> = {};
  const wages: Record<string, WireValue[]> = {};
  for (const row of rows) {
    const code = row.OCC_CODE ?? '';
    if (!/^\d{2}-\d{4}$/.test(code) || !row.OCC_TITLE) throw new Error('Invalid OEWS occupation');
    if (wages[code]) throw new Error(`Duplicate occupation/geography: ${geography.id}/${code}`);
    occupations[code] = row.OCC_TITLE;
    wages[code] = WAGE_COLUMNS.map((column) => {
      if (!(column in row)) throw new Error(`Missing wage column ${column}`);
      return sourceValue(row[column] ?? '', column, row[`${column}_SOURCE_MARKER`]);
    });
  }
  if (!rows.length) throw new Error('Empty wage geography');
  const wire: WireWages = { schemaVersion: 1, ...PERIOD, geography, occupations, wages };
  parseWageDataset(wire);
  return wire;
}
