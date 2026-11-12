import type {
  CrosswalkEntry,
  Geography,
  NationalDataset,
  OccupationCrosswalk,
  PayValue,
  TitleIndex,
  WageDataset,
  WageRecord,
  WageSeries,
} from './types';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected nonempty text');
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected an array');
  return value;
}
function version(value: unknown) {
  if (value !== 1) throw new Error('Unsupported pay schema version');
}
function code(value: string) {
  if (!/^\d{2}-\d{4}$/.test(value)) throw new Error(`Invalid occupation code: ${value}`);
  return value;
}

export function parsePayValue(input: unknown): PayValue {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0)
    return { kind: 'published', value: input };
  const value = object(input);
  if (value.kind === 'missing') return { kind: 'missing' };
  if (value.kind === 'not-published') return { kind: 'not-published', marker: text(value.marker) };
  if (
    value.kind === 'at-or-above' &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value > 0
  ) {
    return { kind: 'at-or-above', value: value.value, marker: text(value.marker) };
  }
  throw new Error('Invalid wage value');
}

export function parseGeography(input: unknown): Geography {
  const value = object(input);
  const id = text(value.id);
  const name = text(value.name);
  const stateIds = list(value.stateIds).map(text);
  if (
    stateIds.some((id) => !/^state-\d{2}$/.test(id)) ||
    new Set(stateIds).size !== stateIds.length
  )
    throw new Error('Invalid parent states');
  const { level, areaType } = value;
  if (level === 'national' && id === 'national' && areaType === 'national' && !stateIds.length)
    return { id, name, level, areaType, stateIds };
  if (level === 'state' && /^state-\d{2}$/.test(id) && areaType === 'state' && !stateIds.length)
    return { id, name, level, areaType, stateIds };
  if (
    level === 'area' &&
    /^area-\d{7}$/.test(id) &&
    (areaType === 'metropolitan' || areaType === 'nonmetropolitan') &&
    stateIds.length
  )
    return { id, name, level, areaType, stateIds };
  throw new Error('Invalid geography');
}

export function parseGeographies(input: unknown): Geography[] {
  const value = object(input);
  version(value.schemaVersion);
  const geographies = list(value.geographies).map(parseGeography);
  if (new Set(geographies.map(({ id }) => id)).size !== geographies.length)
    throw new Error('Duplicate geography');
  const ids = new Set(geographies.map(({ id }) => id));
  if (!ids.has('national') || geographies.some((geo) => geo.stateIds.some((id) => !ids.has(id))))
    throw new Error('Missing parent geography');
  return geographies;
}

function series(values: PayValue[], offset: number): WageSeries {
  const [p10, p25, p50, p75, p90] = values.slice(offset, offset + 5);
  if (!p10 || !p25 || !p50 || !p75 || !p90) throw new Error('Missing percentiles');
  const published = [p10, p25, p50, p75, p90];
  if (published.every((item) => item.kind === 'published')) {
    for (let i = 1; i < published.length; i++) {
      const before = published[i - 1];
      const after = published[i];
      if (before?.kind === 'published' && after?.kind === 'published' && before.value > after.value)
        throw new Error('Percentiles out of order');
    }
  }
  const mean = values[offset === 3 ? 1 : 2];
  if (!mean) throw new Error('Missing mean');
  return { mean, percentiles: { 10: p10, 25: p25, 50: p50, 75: p75, 90: p90 } };
}

export function parseWageDataset(input: unknown): WageDataset {
  const value = object(input);
  version(value.schemaVersion);
  if (value.referencePeriod !== 'May 2025' || value.publicationDate !== '2026-05-15')
    throw new Error('Unexpected wage release');
  const occupations: Record<string, string> = {};
  for (const [key, title] of Object.entries(object(value.occupations)))
    occupations[code(key)] = text(title);
  const wages: Record<string, WageRecord> = {};
  for (const [key, raw] of Object.entries(object(value.wages))) {
    if (!occupations[code(key)]) throw new Error('Wage without occupation title');
    const cells = list(raw);
    if (cells.length !== 13) throw new Error('Expected 13 wage columns');
    const cellsParsed = cells.map(parsePayValue);
    const employment = cellsParsed[0];
    if (!employment) throw new Error('Missing employment');
    if (employment.kind === 'published' && !Number.isInteger(employment.value))
      throw new Error('Employment must be workers');
    for (const i of [2, 8, 9, 10, 11, 12]) {
      const cell = cellsParsed[i];
      if (cell?.kind === 'published' && !Number.isInteger(cell.value))
        throw new Error('Annual wages must be whole dollars');
    }
    for (const i of [1, 3, 4, 5, 6, 7]) {
      const cell = cellsParsed[i];
      if (
        cell?.kind === 'published' &&
        Math.abs(cell.value * 100 - Math.round(cell.value * 100)) > 1e-7
      )
        throw new Error('Hourly wages must be dollars and cents');
    }
    wages[key] = { employment, hourly: series(cellsParsed, 3), annual: series(cellsParsed, 8) };
  }
  return {
    schemaVersion: 1,
    referencePeriod: value.referencePeriod,
    publicationDate: value.publicationDate,
    geography: parseGeography(value.geography),
    occupations,
    wages,
  };
}

export function parseNationalDataset(input: unknown): NationalDataset {
  const dataset = parseWageDataset(input);
  if (dataset.geography.level !== 'national') throw new Error('Expected national wages');
  const crosswalk: OccupationCrosswalk = {};
  for (const [onetCode, raw] of Object.entries(object(object(input).crosswalk))) {
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(onetCode)) throw new Error('Invalid O*NET-SOC code');
    const entry = object(raw);
    let mapped: CrosswalkEntry;
    const note = text(entry.note);
    if (entry.kind === 'unavailable' && entry.occupationCode === null)
      mapped = { kind: 'unavailable', occupationCode: null, note };
    else if (
      (entry.kind === 'same-soc' || entry.kind === 'broader') &&
      typeof entry.occupationCode === 'string' &&
      dataset.occupations[code(entry.occupationCode)]
    )
      mapped = { kind: entry.kind, occupationCode: entry.occupationCode, note };
    else throw new Error('Invalid occupation crosswalk');
    crosswalk[onetCode] = mapped;
  }
  return { ...dataset, crosswalk };
}

export function parseTitleIndex(input: unknown): TitleIndex {
  const value = object(input);
  version(value.schemaVersion);
  if (value.release !== '31.0') throw new Error('Unexpected title release');
  const occupations = list(value.occupations).map((raw) => {
    const row = list(raw);
    const onetCode = text(row[0]);
    if (row.length !== 2 || !/^\d{2}-\d{4}\.\d{2}$/.test(onetCode))
      throw new Error('Invalid O*NET occupation');
    return { onetCode, title: text(row[1]) };
  });
  if (new Set(occupations.map(({ onetCode }) => onetCode)).size !== occupations.length)
    throw new Error('Duplicate O*NET occupation');
  const seen = new Set<string>();
  const titles: TitleIndex['titles'] = list(value.titles).map((raw) => {
    const row = list(raw);
    const title = text(row[0]);
    const occupation = row[1];
    const sources = row[2];
    if (
      row.length !== 3 ||
      typeof occupation !== 'number' ||
      !Number.isInteger(occupation) ||
      occupation < 0 ||
      !occupations[occupation] ||
      typeof sources !== 'number' ||
      !Number.isInteger(sources) ||
      sources < 1 ||
      sources > 7
    )
      throw new Error('Invalid title row');
    const key = `${occupation}\0${title}`;
    if (seen.has(key)) throw new Error('Duplicate title');
    seen.add(key);
    return [title, occupation, sources];
  });
  if (!titles.length || !occupations.length) throw new Error('Empty title index');
  return { schemaVersion: 1, release: '31.0', occupations, titles };
}
