export type PayValue =
  | { kind: 'published'; value: number }
  | { kind: 'not-published'; marker: string }
  | { kind: 'at-or-above'; value: number; marker: string }
  | { kind: 'missing' };

export type PayUnit = 'hourly' | 'annual';
export type Percentile = 10 | 25 | 50 | 75 | 90;
export type GeographyLevel = 'national' | 'state' | 'area';

export interface PayPeriod {
  referencePeriod: string;
  publicationDate: string;
}

export interface Geography {
  id: string;
  name: string;
  level: GeographyLevel;
  areaType: 'national' | 'state' | 'metropolitan' | 'nonmetropolitan';
  stateIds: string[];
}

export interface WageSeries {
  mean: PayValue;
  percentiles: Record<Percentile, PayValue>;
}

export interface WageRecord {
  employment: PayValue;
  hourly: WageSeries;
  annual: WageSeries;
}

export interface WageDataset extends PayPeriod {
  schemaVersion: 1;
  geography: Geography;
  occupations: Record<string, string>;
  wages: Record<string, WageRecord>;
}

export type CrosswalkEntry =
  | { kind: 'same-soc' | 'broader'; occupationCode: string; note: string }
  | { kind: 'unavailable'; occupationCode: null; note: string };
export type OccupationCrosswalk = Record<string, CrosswalkEntry>;

export interface NationalDataset extends WageDataset {
  crosswalk: OccupationCrosswalk;
}

export interface TitleOccupation {
  onetCode: string;
  title: string;
}

// Bit mask: official = 1, alternate = 2, reported = 4. A title can have several sources.
export type TitleRow = [title: string, occupationIndex: number, sources: number];
export interface TitleIndex {
  schemaVersion: 1;
  release: '31.0';
  occupations: TitleOccupation[];
  titles: TitleRow[];
}

export type TitleMatchKind = 'official' | 'alternate' | 'reported' | 'token' | 'fuzzy';
export interface TitleCandidate extends TitleOccupation {
  occupationCode: string | null;
  matchedTitle: string;
  match: TitleMatchKind;
  label: string;
  mapping: CrosswalkEntry | null;
}

export interface PayFigure extends PayPeriod {
  percentile: Percentile;
  label: string;
  explanation: string;
  value: PayValue;
  unit: PayUnit;
  occupationCode: string;
  occupationTitle: string;
  place: Geography;
  requestedPlace: Geography;
  isFallback: boolean;
}

export interface PayLookup {
  occupationCode: string;
  occupationTitle: string;
  figures: PayFigure[];
  means: Record<PayUnit, Omit<PayFigure, 'percentile' | 'explanation'>>;
  employment: Omit<PayFigure, 'percentile' | 'explanation' | 'unit'>;
}

export type PayFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface PayLoaders {
  loadNational(): Promise<NationalDataset>;
  loadTitles(): Promise<TitleIndex>;
  loadGeographies(): Promise<Geography[]>;
  loadGeography(id: string): Promise<WageDataset>;
}
