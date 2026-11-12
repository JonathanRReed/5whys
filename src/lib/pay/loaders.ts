import type { PayFetch, PayLoaders, WageDataset } from './types';
import {
  parseGeographies,
  parseNationalDataset,
  parseTitleIndex,
  parseWageDataset,
} from './validate';

export const PAY_FILES = {
  national: 'oews-may-2025-national-v1.json',
  titles: 'onet-31.0-titles-v1.json',
  geographies: 'oews-may-2025-geographies-v1.json',
} as const;

export function createPayLoaders(fetcher: PayFetch, basePath = '/data/pay'): PayLoaders {
  if (!/^\/(?!\/)[a-zA-Z0-9_/-]*$/.test(basePath) || basePath.includes('//')) {
    throw new Error('Pay data requires a same-origin absolute path');
  }
  const base = basePath.replace(/\/$/, '');
  async function read<T>(file: string, parse: (input: unknown) => T): Promise<T> {
    const response = await fetcher(`${base}/${file}`);
    if (!response.ok) throw new Error(`Pay data unavailable (${response.status}): ${file}`);
    return parse(await response.json());
  }
  function lazy<T>(file: string, parse: (input: unknown) => T) {
    let pending: Promise<T> | undefined;
    return () => {
      pending ??= read(file, parse).catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
      return pending;
    };
  }
  const loadNational = lazy(PAY_FILES.national, parseNationalDataset);
  const loadGeographies = lazy(PAY_FILES.geographies, parseGeographies);
  const geographyCache = new Map<string, Promise<WageDataset>>();
  return {
    loadNational,
    loadTitles: lazy(PAY_FILES.titles, parseTitleIndex),
    loadGeographies,
    async loadGeography(id) {
      if (id === 'national') return loadNational();
      if (!/^(state-\d{2}|area-\d{7})$/.test(id))
        throw new Error('Invalid pay geography selection');
      const geographies = await loadGeographies();
      const geography = geographies.find((item) => item.id === id);
      if (!geography) throw new Error('Unknown pay geography');
      let pending = geographyCache.get(id);
      if (!pending) {
        pending = read(`oews-may-2025-${id}-v1.json`, (input) => {
          const dataset = parseWageDataset(input);
          if (JSON.stringify(dataset.geography) !== JSON.stringify(geography))
            throw new Error('Geography file does not match selection');
          return dataset;
        }).catch((error: unknown) => {
          geographyCache.delete(id);
          throw error;
        });
        geographyCache.set(id, pending);
      }
      return pending;
    },
  };
}
