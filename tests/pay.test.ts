import { describe, expect, test, vi } from 'vitest';
import {
  createPayLoaders,
  createTitleSearch,
  formatPayValue,
  type Geography,
  lookupPay,
  normalizeTitle,
  PAY_FILES,
  type PayFetch,
  payAttributions,
  percentileExplanation,
} from '../src/lib/pay';
import {
  parseGeographies,
  parseNationalDataset,
  parseTitleIndex,
  parseWageDataset,
} from '../src/lib/pay/validate';

const national: Geography = {
  id: 'national',
  name: 'United States',
  level: 'national',
  areaType: 'national',
  stateIds: [],
};
const state: Geography = {
  id: 'state-06',
  name: 'California',
  level: 'state',
  areaType: 'state',
  stateIds: [],
};
const area: Geography = {
  id: 'area-0041860',
  name: 'San Francisco-Oakland-Fremont, CA',
  level: 'area',
  areaType: 'metropolitan',
  stateIds: ['state-06'],
};
const code = '13-2051';
const crosswalk = {
  '13-2051.00': { kind: 'same-soc', occupationCode: code, note: 'Same SOC occupation.' },
};
function wire(
  geography = national,
  cells: unknown[] = [100, 30, 60000, 10, 20, 30, 40, 50, 20000, 40000, 60000, 80000, 100000]
) {
  return {
    schemaVersion: 1,
    referencePeriod: 'May 2025',
    publicationDate: '2026-05-15',
    geography,
    occupations: { [code]: 'Financial and investment analysts' },
    wages: { [code]: cells },
    crosswalk,
  };
}
const titleWire = {
  schemaVersion: 1,
  release: '31.0',
  occupations: [
    ['13-2051.00', 'Financial analyst'],
    ['15-1211.00', 'Systems analyst'],
    ['13-1111.00', 'Management analyst'],
    ['41-2031.00', 'Retail salespersons'],
  ],
  titles: [
    ['Financial analyst', 0, 1],
    ['Analyst', 0, 2],
    ['Analyst', 1, 4],
    ['Financial analyst', 1, 2],
    ['Systems analyst', 1, 1],
    ['Management analyst', 2, 1],
    ['Associate', 3, 2],
    ['Associate', 0, 4],
  ],
};

describe('title search', () => {
  const index = parseTitleIndex(titleWire);
  const search = createTitleSearch(index, parseNationalDataset(wire()).crosswalk);
  test('normalizes Unicode and punctuation while keeping language qualifiers distinct', () => {
    expect(normalizeTitle('  RÉSUMÉ & Data-Analyst ')).toBe('resume and data analyst');
    expect(normalizeTitle('C++ developer')).not.toBe(normalizeTitle('C# developer'));
    expect(normalizeTitle('senior analyst')).not.toBe(normalizeTitle('analyst'));
  });
  test('ranks exact official, alternate, and reported matches ahead of tokens', () => {
    expect(
      search('Financial analyst')
        .map((candidate) => candidate.match)
        .slice(0, 2)
    ).toEqual(['official', 'alternate']);
    expect(
      search('Analyst')
        .map((candidate) => candidate.match)
        .slice(0, 3)
    ).toEqual(['alternate', 'reported', 'token']);
  });
  test('returns distinct labeled occupations for ambiguous titles without inventing a mapping', () => {
    expect(search('analyst')).toHaveLength(3);
    expect(search('associate')).toHaveLength(2);
    expect(new Set(search('analyst').map((candidate) => candidate.label)).size).toBe(3);
    expect(search('analyst')[0]?.occupationCode).toBe(code);
    expect(
      search('analyst').find((candidate) => candidate.onetCode === '15-1211.00')?.occupationCode
    ).toBeNull();
  });
  test('finds a transposed token, supports bounded results, and rejects empty input', () => {
    expect(search('financail analyst')[0]?.match).toBe('fuzzy');
    expect(search('analyst', 1)).toHaveLength(1);
    expect(search('!')).toEqual([]);
    expect(search('analyst', Number.NaN)).toEqual([]);
  });
});

describe('wage lookup', () => {
  const us = parseNationalDataset(wire());
  const ca = parseWageDataset(wire(state));
  const local = parseWageDataset(
    wire(area, [
      100,
      35,
      70000,
      { kind: 'not-published', marker: '*' },
      25,
      35,
      45,
      55,
      25000,
      45000,
      70000,
      90000,
      { kind: 'at-or-above', marker: '#', value: 239200 },
    ])
  );
  test('keeps suppression by default and labels every figure with source and dates', () => {
    const result = lookupPay({
      occupationCode: code,
      national: us,
      geography: local,
      states: [ca],
    });
    expect(result.figures).toHaveLength(10);
    for (const figure of result.figures) {
      expect(figure.place).toEqual(area);
      expect(figure.isFallback).toBe(false);
      expect(figure.referencePeriod).toBe('May 2025');
      expect(figure.publicationDate).toBe('2026-05-15');
      expect(figure.occupationTitle).toBe('Financial and investment analysts');
    }
    expect(result.figures[0]?.value.kind).toBe('not-published');
  });
  test('uses state then national only on request, independently for each figure', () => {
    const result = lookupPay({
      occupationCode: code,
      national: us,
      geography: local,
      states: [ca],
      fallback: true,
    });
    expect(result.figures[0]?.place.level).toBe('state');
    expect(result.figures[0]?.isFallback).toBe(true);
    expect(result.figures[0]?.requestedPlace.id).toBe(area.id);
    expect(result.figures[1]?.place.level).toBe('area');
    const noState = lookupPay({
      occupationCode: code,
      national: us,
      geography: local,
      fallback: true,
    });
    expect(noState.figures[0]?.place.level).toBe('national');
    expect(noState.figures.at(-1)?.value.kind).toBe('at-or-above');
  });
  test('returns explicit missing values for absent occupations', () => {
    expect(
      lookupPay({ occupationCode: '99-9999', national: us }).figures.every(
        (figure) => figure.value.kind === 'missing'
      )
    ).toBe(true);
  });
  test('rejects mixed releases and ambiguous parent state selection', () => {
    expect(() =>
      lookupPay({
        occupationCode: code,
        national: us,
        geography: { ...local, publicationDate: '2024-01-01' },
      })
    ).toThrow('releases');
    const ny = { ...ca, geography: { ...state, id: 'state-36', name: 'New York' } };
    const crossState = { ...local, geography: { ...area, stateIds: [state.id, ny.geography.id] } };
    expect(() =>
      lookupPay({
        occupationCode: code,
        national: us,
        geography: crossState,
        states: [ca, ny],
        fallback: true,
      })
    ).toThrow('Select one state');
  });
});

describe('lazy loaders', () => {
  test('fetches fixed same-origin paths only when requested and caches successes', async () => {
    const responses: Record<string, unknown> = {
      [PAY_FILES.national]: wire(),
      [PAY_FILES.titles]: titleWire,
      [PAY_FILES.geographies]: { schemaVersion: 1, geographies: [national, state, area] },
      'oews-may-2025-area-0041860-v1.json': wire(area),
    };
    const fetcher = vi.fn<PayFetch>(async (url) => ({
      ok: true,
      status: 200,
      json: async () => responses[url.split('/').at(-1) ?? ''],
    }));
    const loaders = createPayLoaders(fetcher, '/assets/pay/');
    expect(fetcher).not.toHaveBeenCalled();
    await Promise.all([loaders.loadTitles(), loaders.loadTitles()]);
    expect(fetcher.mock.calls).toEqual([[`/assets/pay/${PAY_FILES.titles}`]]);
    await loaders.loadGeography(area.id);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `/assets/pay/${PAY_FILES.titles}`,
      `/assets/pay/${PAY_FILES.geographies}`,
      '/assets/pay/oews-may-2025-area-0041860-v1.json',
    ]);
    await loaders.loadGeography(area.id);
    expect(fetcher).toHaveBeenCalledTimes(3);
    await expect(loaders.loadGeography('a typed job title')).rejects.toThrow('Invalid');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  test('rejects external paths, retries failures, and validates response schemas', async () => {
    for (const base of [
      'https://elsewhere.test/pay',
      '//elsewhere.test/pay',
      '/pay?title=secret',
      '/pay/../other',
    ])
      expect(() => createPayLoaders(vi.fn(), base)).toThrow('same-origin');
    const fetcher = vi
      .fn<PayFetch>()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => null })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => titleWire });
    const loaders = createPayLoaders(fetcher);
    await expect(loaders.loadTitles()).rejects.toThrow('404');
    await expect(loaders.loadTitles()).resolves.toHaveProperty('release', '31.0');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(
      createPayLoaders(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ schemaVersion: 999 }),
      })).loadNational()
    ).rejects.toThrow('schema');
  });
});

test('formats missing and capped values honestly and includes required credits', () => {
  expect(formatPayValue({ kind: 'not-published', marker: '*' })).toBe('Not published');
  expect(formatPayValue({ kind: 'missing' })).toBe('Not available');
  expect(formatPayValue({ kind: 'at-or-above', value: 115, marker: '#' }, 'hourly')).toBe(
    'At or above $115.00'
  );
  expect(formatPayValue({ kind: 'published', value: 60000 })).toBe('$60,000');
  for (const p of [10, 25, 50, 75, 90] as const) {
    expect(percentileExplanation(p)).toContain(`${p}%`);
    expect(percentileExplanation(p)).toContain('not experience');
  }
  const credits = payAttributions();
  expect(credits.bls).toContain('Public domain');
  expect(credits.onet).toContain('not approved, endorsed, or tested');
  expect(
    credits.links.some((link) => link.href === 'https://creativecommons.org/licenses/by/4.0/')
  ).toBe(true);
});

test('rejects malformed wage payloads, unsupported years, and duplicate geography keys', () => {
  expect(() => parseWageDataset(wire(national, [1]))).toThrow('13 wage columns');
  expect(() => parseWageDataset({ ...wire(), referencePeriod: 'May 2024' })).toThrow('release');
  expect(() =>
    parseGeographies({ schemaVersion: 1, geographies: [national, state, state] })
  ).toThrow('Duplicate');
});
