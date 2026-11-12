import { PAY_PERCENTILES, percentileExplanation, percentileLabel } from './format';
import type {
  Geography,
  NationalDataset,
  PayLookup,
  PayUnit,
  PayValue,
  WageDataset,
  WageRecord,
} from './types';

export function lookupPay({
  occupationCode,
  national,
  geography,
  states = [],
  fallback = false,
}: {
  occupationCode: string;
  national: NationalDataset;
  geography?: WageDataset;
  states?: WageDataset[];
  fallback?: boolean;
}): PayLookup {
  const requested = geography ?? national;
  const chain: WageDataset[] = [requested];
  if (fallback && requested.geography.level === 'area') {
    // A cross-state metro has no single parent. The caller must select one state explicitly.
    const parents = states.filter(
      (state) =>
        state.geography.level === 'state' &&
        requested.geography.stateIds.includes(state.geography.id)
    );
    if (parents.length > 1) throw new Error('Select one state for cross-state area fallback');
    chain.push(...parents);
  }
  if (fallback && requested.geography.level !== 'national') chain.push(national);
  for (const dataset of chain) {
    if (
      dataset.referencePeriod !== national.referencePeriod ||
      dataset.publicationDate !== national.publicationDate
    ) {
      throw new Error('Cannot combine wage releases');
    }
  }
  const occupationTitle =
    national.occupations[occupationCode] ?? requested.occupations[occupationCode] ?? occupationCode;
  function resolve(read: (record: WageRecord) => PayValue) {
    let first:
      | { value: PayValue; place: Geography; referencePeriod: string; publicationDate: string }
      | undefined;
    for (const dataset of chain) {
      const record = dataset.wages[occupationCode];
      const value = record ? read(record) : { kind: 'missing' as const };
      const result = {
        value,
        place: dataset.geography,
        referencePeriod: dataset.referencePeriod,
        publicationDate: dataset.publicationDate,
      };
      first ??= result;
      if (value.kind === 'published' || value.kind === 'at-or-above') return result;
    }
    return (
      first ?? {
        value: { kind: 'missing' as const },
        place: requested.geography,
        referencePeriod: requested.referencePeriod,
        publicationDate: requested.publicationDate,
      }
    );
  }
  function figure(read: (record: WageRecord) => PayValue) {
    const result = resolve(read);
    return {
      ...result,
      occupationCode,
      occupationTitle,
      requestedPlace: requested.geography,
      isFallback: result.place.id !== requested.geography.id,
    };
  }
  const units: PayUnit[] = ['hourly', 'annual'];
  return {
    occupationCode,
    occupationTitle,
    figures: units.flatMap((unit) =>
      PAY_PERCENTILES.map((percentile) => ({
        ...figure((record) => record[unit].percentiles[percentile]),
        unit,
        percentile,
        label: percentileLabel(percentile),
        explanation: percentileExplanation(percentile),
      }))
    ),
    means: {
      hourly: { ...figure((record) => record.hourly.mean), unit: 'hourly', label: 'Hourly mean' },
      annual: { ...figure((record) => record.annual.mean), unit: 'annual', label: 'Annual mean' },
    },
    employment: { ...figure((record) => record.employment), label: 'Employment' },
  };
}
