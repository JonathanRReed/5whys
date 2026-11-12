import type { PayPeriod, PayValue, Percentile } from './types';

export const PAY_PERCENTILES = [10, 25, 50, 75, 90] as const;

export function percentileLabel(percentile: Percentile): string {
  return percentile === 50 ? 'Median (50th percentile)' : `${percentile}th percentile`;
}

export function percentileExplanation(percentile: Percentile): string {
  return `About ${percentile}% of workers in this occupation and place earned this amount or less, and about ${100 - percentile}% earned more. This describes the wage distribution, not experience or what you should be paid.`;
}

export function formatPayValue(value: PayValue, unit: 'hourly' | 'annual' = 'annual'): string {
  if (value.kind === 'not-published') return 'Not published';
  if (value.kind === 'missing') return 'Not available';
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: unit === 'hourly' ? 2 : 0,
    maximumFractionDigits: unit === 'hourly' ? 2 : 0,
  }).format(value.value);
  return value.kind === 'at-or-above' ? `At or above ${currency}` : currency;
}

export function payAttributions(
  period: PayPeriod = {
    referencePeriod: 'May 2025',
    publicationDate: '2026-05-15',
  }
): { bls: string; onet: string; links: { label: string; href: string }[] } {
  return {
    bls: `Source: U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, ${period.referencePeriod}. Published ${period.publicationDate}. Public domain.`,
    onet: 'Occupation titles adapted by 5 Whys Career Studio from the O*NET® 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), under CC BY 4.0. Changes: title normalization, deduplication, and occupation-code mapping. O*NET® is a trademark of USDOL/ETA. USDOL/ETA has not approved, endorsed, or tested these modifications.',
    links: [
      { label: 'BLS OEWS data', href: 'https://www.bls.gov/oes/tables.htm' },
      { label: 'O*NET® 31.0 Database', href: 'https://www.onetcenter.org/database.html' },
      { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
      { label: 'Data changes and provenance', href: '/data/pay/provenance.json' },
    ],
  };
}
