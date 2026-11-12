// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import {
  buildCrosswalk,
  buildTitleIndex,
  buildWageFile,
  parseDelimited,
  records,
  sourceValue,
  WAGE_COLUMNS,
} from '../scripts/pay-data/rows';
import { assertSizeBudgets, measureFile } from '../scripts/pay-data/sizes';
import { createTitleSearch, type Geography } from '../src/lib/pay';
import { parseTitleIndex, parseWageDataset } from '../src/lib/pay/validate';

const geography: Geography = {
  id: 'national',
  name: 'United States',
  level: 'national',
  areaType: 'national',
  stateIds: [],
};
function sourceRow() {
  const values = [
    '100',
    '30.00',
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
  return {
    OCC_CODE: '13-2051',
    OCC_TITLE: 'Financial and Investment Analysts',
    ...Object.fromEntries(WAGE_COLUMNS.map((column, i) => [column, values[i] ?? ''])),
  };
}

describe('source validation', () => {
  test('reads CSV quotes, embedded newlines, BOMs, and TSV without losing cells', () => {
    expect(
      parseDelimited('\uFEFFCode,Title\r\n1,"A, B"\r\n2,"A ""quote""\nand a newline"\r\n')
    ).toEqual([
      ['Code', 'Title'],
      ['1', 'A, B'],
      ['2', 'A "quote"\nand a newline'],
    ]);
    expect(parseDelimited('Code\tTitle\n1\tA\n', '\t')).toEqual([
      ['Code', 'Title'],
      ['1', 'A'],
    ]);
    expect(() => parseDelimited('"unclosed')).toThrow('Unclosed');
    expect(() => parseDelimited('"closed"junk')).toThrow('after quoted');
  });
  test('rejects missing and duplicate headers and ragged rows', () => {
    expect(() => records([['Title']], ['Code'])).toThrow('headers');
    expect(() => records([['Code', 'Code']], ['Code'])).toThrow('headers');
    expect(() => records([['Code', 'Title'], ['1']], ['Code'])).toThrow('Malformed');
  });
  test('rejects invalid amounts, units, duplicate records, and disordered percentiles', () => {
    for (const raw of ['0', '-1', 'NaN', '12,34', '1e5', '1.123', '$40'])
      expect(() => sourceValue(raw, 'H_MEAN')).toThrow();
    expect(() => sourceValue('12.25', 'A_MEAN')).toThrow('units');
    expect(() => sourceValue('12.25', 'TOT_EMP')).toThrow('units');
    expect(() => sourceValue('#', 'TOT_EMP')).toThrow('employment');
    expect(() => buildWageFile(geography, [sourceRow(), sourceRow()])).toThrow('Duplicate');
    expect(() => buildWageFile(geography, [{ ...sourceRow(), H_PCT10: '100' }])).toThrow('order');
    expect(() => buildWageFile(geography, [{ ...sourceRow(), A_MEAN: '1.25' }])).toThrow('units');
  });
  test('never emits zero for a not-published source marker and retains caps and empty cells', () => {
    for (const marker of ['*', '**', '-', 'N/A']) {
      const source = { ...sourceRow(), H_PCT10: marker, A_PCT90: '#', H_MEAN: '' };
      const generated = buildWageFile(geography, [source]);
      expect(generated.wages['13-2051']?.[3]).toEqual({ kind: 'not-published', marker });
      expect(generated.wages['13-2051']?.[3]).not.toBe(0);
      const loaded = parseWageDataset(JSON.parse(JSON.stringify(generated)));
      expect(loaded.wages['13-2051']?.hourly.percentiles[10]).toEqual({
        kind: 'not-published',
        marker,
      });
      expect(loaded.wages['13-2051']?.hourly.mean.kind).toBe('missing');
      expect(loaded.wages['13-2051']?.annual.percentiles[90]).toEqual({
        kind: 'at-or-above',
        value: 239200,
        marker: '#',
      });
    }
  });
  test('emits an explicit broader-group crosswalk and never guesses an all-other match', () => {
    const mapped = buildCrosswalk(['13-1021.00', '11-1011.03', '99-9999.00'], {
      '13-1020': 'Buyers and Purchasing Agents',
      '11-1011': 'Chief Executives',
    });
    expect(mapped['13-1021.00']).toMatchObject({ kind: 'broader', occupationCode: '13-1020' });
    expect(mapped['11-1011.03']).toMatchObject({ kind: 'broader', occupationCode: '11-1011' });
    expect(mapped['99-9999.00']).toMatchObject({ kind: 'unavailable', occupationCode: null });
  });
  test('retains official title text and all source categories when deduplicating', () => {
    const occupation = { 'O*NET-SOC Code': '13-2051.00', Title: 'Analysts' };
    const generated = buildTitleIndex(
      [occupation],
      [{ ...occupation, 'Job Title': 'analysts', 'Short Title': 'FA' }],
      [{ ...occupation, 'Reported Job Title': 'Analysts' }]
    );
    expect(generated.titles.find(([title]) => title === 'Analysts')?.[2]).toBe(7);
    expect(generated.titles.find(([title]) => title === 'FA')?.[2]).toBe(2);
    expect(() => buildTitleIndex([occupation, occupation], [], [])).toThrow('duplicate');
    expect(() =>
      buildTitleIndex([occupation], [{ ...occupation, 'O*NET-SOC Code': '99-9999.00' }], [])
    ).toThrow();
  });
});

test('size checks fail rather than truncate an oversized file', () => {
  const receipt = measureFile('oews-may-2025-national-v1.json', '{}');
  expect(receipt.gzipBudget).toBe(50 * 1024);
  expect(() => assertSizeBudgets([{ ...receipt, gzip: 51201 }])).toThrow(
    'Split by occupation-code prefix'
  );
});

test('committed O*NET data validates, fits the title budget, and returns ambiguous real titles', () => {
  const raw = readFileSync(
    new URL('../public/data/pay/onet-31.0-titles-v1.json', import.meta.url),
    'utf8'
  );
  const index = parseTitleIndex(JSON.parse(raw));
  expect(index.occupations.length).toBe(1016);
  expect(index.titles.length).toBeGreaterThan(59000);
  const search = createTitleSearch(index);
  expect(search('analyst').length).toBeGreaterThan(1);
  expect(search('associate').length).toBeGreaterThan(1);
  expect(search('Chief Executives')[0]?.match).toBe('official');
  expect(gzipSync(raw, { level: 9 }).length).toBeLessThanOrEqual(450 * 1024);
  const provenance = JSON.parse(
    readFileSync(new URL('../public/data/pay/provenance.json', import.meta.url), 'utf8')
  );
  expect(provenance.sources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(provenance.sources[0].release).toBe('O*NET 31.0');
  for (const file of readdirSync(new URL('../public/data/pay/', import.meta.url)).filter(
    (file) => file.startsWith('oews-') && !file.includes('geographies')
  )) {
    const wire = JSON.parse(
      readFileSync(new URL(`../public/data/pay/${file}`, import.meta.url), 'utf8')
    );
    parseWageDataset(wire);
    for (const cells of Object.values(wire.wages)) {
      expect(Array.isArray(cells) && cells.every((cell: unknown) => cell !== 0)).toBe(true);
    }
  }
});
