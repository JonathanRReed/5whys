import * as React from 'react';
import {
  type ApplicationDeskData,
  createDefaultDeskData,
  createEmptyDesk,
  loadApplicationDesks,
  type OfferWorksheet,
  offerEquivalents,
  PAY_PERIODS,
  type PayPeriod,
  saveApplicationDesks,
  updateOfferWorksheet,
} from '../../lib/application-desk';
import { loadApplications, type TrackedApplication } from '../../lib/applications';
import {
  createPayLoaders,
  createTitleSearch,
  formatPayValue,
  type Geography,
  lookupPay,
  type NationalDataset,
  type PayLookup,
  payAttributions,
  type TitleCandidate,
  type WageDataset,
} from '../../lib/pay';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const PERIOD_LABEL: Record<PayPeriod, string> = {
  hour: 'per hour',
  week: 'per week',
  month: 'per month',
  year: 'per year',
};

const money = (value: number | null, unit: 'hour' | 'year') =>
  value === null
    ? 'Needs more detail'
    : `${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: unit === 'hour' ? 2 : 0,
      }).format(value)} ${unit === 'hour' ? 'an hour' : 'a year'}`;

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

type Search = (query: string, limit?: number) => TitleCandidate[];

export default function PayTool() {
  // --- Wage lookup -------------------------------------------------------
  const [query, setQuery] = React.useState('');
  const [search, setSearch] = React.useState<Search | null>(null);
  const [national, setNational] = React.useState<NationalDataset | null>(null);
  const [geographies, setGeographies] = React.useState<Geography[]>([]);
  const [dataState, setDataState] = React.useState<'idle' | 'loading' | 'ready' | 'titles-only'>(
    'idle'
  );
  const [picked, setPicked] = React.useState<TitleCandidate | null>(null);
  const [placeId, setPlaceId] = React.useState('');
  const [place, setPlace] = React.useState<WageDataset | null>(null);
  const loaders = React.useMemo(
    () => createPayLoaders((url) => fetch(url, { credentials: 'omit' })),
    []
  );

  // Data loads the first time the visitor types, never on page load, and the
  // typed title is only ever searched in memory.
  const ensureData = React.useCallback(async () => {
    if (dataState !== 'idle') return;
    setDataState('loading');
    const [wages, places] = await Promise.all([
      loaders.loadNational().catch(() => null),
      loaders.loadGeographies().catch(() => [] as Geography[]),
    ]);
    try {
      const titles = await loaders.loadTitles();
      setSearch(() => createTitleSearch(titles, wages?.crosswalk ?? {}));
      setNational(wages);
      setGeographies(places);
      setDataState(wages ? 'ready' : 'titles-only');
    } catch {
      setDataState('titles-only');
    }
  }, [dataState, loaders]);

  React.useEffect(() => {
    if (!placeId) {
      setPlace(null);
      return undefined;
    }
    let cancelled = false;
    loaders
      .loadGeography(placeId)
      .then((dataset) => !cancelled && setPlace(dataset))
      .catch(() => !cancelled && setPlace(null));
    return () => {
      cancelled = true;
    };
  }, [placeId, loaders]);

  // "Marketing intern, summer 2027" is not an occupation. Search on the work
  // itself, and say that intern pay is not measured separately.
  const occupationQuery = React.useMemo(
    () =>
      query
        .replace(
          /\b(intern(ship)?|co-?op|trainee|summer|fall|autumn|winter|spring|part[- ]time|full[- ]time|(19|20)\d{2})\b/gi,
          ' '
        )
        .replace(/[,()|-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    [query]
  );
  const isInternSearch = /\b(intern(ship)?|co-?op|trainee)\b/i.test(query);
  // A title carried over from an application loads the list without a tap.
  React.useEffect(() => {
    if (query && dataState === 'idle') void ensureData();
  }, [query, dataState, ensureData]);

  const candidates = React.useMemo(
    () => (search && occupationQuery.length >= 2 ? search(occupationQuery, 8) : []),
    [search, occupationQuery]
  );

  const lookup: PayLookup | null = React.useMemo(() => {
    if (!picked?.occupationCode || !national) return null;
    try {
      return lookupPay({
        occupationCode: picked.occupationCode,
        national,
        geography: place ?? undefined,
      });
    } catch {
      return null;
    }
  }, [picked, national, place]);

  // --- Offer worksheet ---------------------------------------------------
  const [applications, setApplications] = React.useState<TrackedApplication[]>([]);
  const [appId, setAppId] = React.useState('');
  const [desks, setDesks] = React.useState<ApplicationDeskData>(createDefaultDeskData);
  const [scratch, setScratch] = React.useState<OfferWorksheet>(() => createEmptyDesk().offer);

  React.useEffect(() => {
    const apps = loadApplications();
    setApplications(apps.applications);
    setDesks(loadApplicationDesks());
    const wanted = new URLSearchParams(window.location.search).get('id');
    const known = apps.applications.some((a) => a.id === wanted);
    setAppId(known && wanted ? wanted : (apps.activeId ?? ''));
    // Arriving from an application's desk: start from that role's title. The
    // title is read from this device's storage, never from the address.
    const from = apps.applications.find((a) => a.id === wanted);
    if (from?.title) setQuery(from.title);
  }, []);

  const offer = appId ? (desks.desks[appId]?.offer ?? createEmptyDesk().offer) : scratch;
  const changeOffer = (changes: Partial<OfferWorksheet>) => {
    if (!appId) {
      setScratch((current) => ({ ...current, ...changes }));
      return;
    }
    const next = updateOfferWorksheet(loadApplicationDesks(), appId, changes);
    saveApplicationDesks(next);
    setDesks(next);
  };
  const equivalents = offerEquivalents(offer);
  const credits = payAttributions();

  const numberField = (
    label: string,
    key: 'basePay' | 'guaranteedBonus' | 'variablePay' | 'hoursPerWeek' | 'weeksPerYear',
    hint?: string
  ) => (
    <label className="space-y-1">
      <span className="block text-sm text-muted-foreground">{label}</span>
      <Input
        inputMode="decimal"
        data-guide={`offer-${key}`}
        value={offer[key] ?? ''}
        onChange={(event) => changeOffer({ [key]: toNumber(event.target.value) })}
        className="text-base"
      />
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-14">
      <section aria-labelledby="wages-title" className="space-y-5">
        <div className="space-y-2">
          <h2 id="wages-title" className="text-2xl font-semibold">
            What the job tends to pay
          </h2>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Type a job title. The search runs on this device against a public list of job titles;
            what you type is not sent anywhere.
          </p>
        </div>
        <label className="block max-w-xl space-y-1">
          <span className="block text-sm text-muted-foreground">Job title</span>
          <Input
            value={query}
            onFocus={() => void ensureData()}
            data-guide="pay-title"
            onChange={(event) => {
              setQuery(event.target.value);
              setPicked(null);
              void ensureData();
            }}
            placeholder="Marketing assistant"
            className="text-base"
          />
        </label>

        {dataState === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading the title list.</p>
        )}

        {candidates.length > 0 && !picked && (
          <div className="max-w-xl space-y-2">
            <p className="text-sm text-muted-foreground">
              Titles mean different things at different employers. Pick the occupation that fits.
              {isInternSearch &&
                ' Intern pay is not measured separately: these are figures for the occupation as a whole, and interns usually earn less.'}
            </p>
            <ul
              className="divide-y divide-border/30 rounded-xl border border-border/40"
              data-guide="pay-candidates"
            >
              {candidates.map((candidate) => (
                <li key={`${candidate.onetCode}-${candidate.matchedTitle}`}>
                  <button
                    type="button"
                    onClick={() => setPicked(candidate)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-overlay/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-foreground">{candidate.title}</span>
                    <span className="text-xs text-muted-foreground">{candidate.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {search && occupationQuery.length >= 2 && candidates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No occupation matches that title. Try a plainer version of it.
          </p>
        )}

        {picked && (
          <div className="space-y-4">
            <p className="font-display text-xl font-semibold" data-testid="pay-occupation">
              {picked.title}
            </p>
            {dataState === 'titles-only' || !national ? (
              <p className="max-w-[68ch] rounded-lg bg-gold/12 px-3 py-2 text-sm">
                Wage figures are not included in this copy of the site yet, so there are no numbers
                to show for this occupation. The worksheet below still works.
              </p>
            ) : !lookup ? (
              <p className="max-w-[68ch] text-sm text-muted-foreground">
                The wage survey does not publish figures for this exact occupation.
              </p>
            ) : (
              <>
                {geographies.length > 0 && (
                  <label className="flex max-w-xl flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Place</span>
                    <select
                      value={placeId}
                      onChange={(event) => setPlaceId(event.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">United States</option>
                      {geographies.map((geography) => (
                        <option key={geography.id} value={geography.id}>
                          {geography.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full max-w-2xl text-sm">
                    <caption className="pb-2 text-left text-xs text-muted-foreground">
                      {lookup.occupationTitle}, {lookup.figures[0]?.place.name}.{' '}
                      {lookup.figures[0]?.referencePeriod}.
                    </caption>
                    <thead>
                      <tr className="border-b border-border/40 text-left text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Where in the range
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          A year
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          An hour
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[10, 25, 50, 75, 90].map((percentile) => {
                        const annual = lookup.figures.find(
                          (f) => f.percentile === percentile && f.unit === 'annual'
                        );
                        const hourly = lookup.figures.find(
                          (f) => f.percentile === percentile && f.unit === 'hourly'
                        );
                        const any = annual ?? hourly;
                        if (!any) return null;
                        return (
                          <tr key={percentile} className="border-b border-border/25 align-top">
                            <th scope="row" className="py-2 pr-4 text-left font-normal">
                              <span className="text-foreground">{any.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {any.explanation}
                              </span>
                            </th>
                            <td className="py-2 pr-4 font-mono tabular-nums">
                              {annual ? formatPayValue(annual.value, 'annual') : 'Not published'}
                            </td>
                            <td className="py-2 font-mono tabular-nums">
                              {hourly ? formatPayValue(hourly.value, 'hourly') : 'Not published'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
                  These are percentiles across everyone in the occupation, at every level of
                  experience. The survey does not measure starting pay, so a lower percentile is not
                  an entry-level salary.
                </p>
              </>
            )}
          </div>
        )}

        <details className="max-w-[68ch] text-xs text-muted-foreground">
          <summary className="cursor-pointer">Where this data comes from</summary>
          <p className="mt-2 leading-relaxed">{credits.bls}</p>
          <p className="mt-2 leading-relaxed">{credits.onet}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {credits.links.map((link) => (
              <li key={link.href}>
                <a className="underline underline-offset-2" href={link.href} rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="offer-title" className="space-y-5 border-t border-border/40 pt-10">
        <div className="space-y-2">
          <h2 id="offer-title" className="text-2xl font-semibold">
            Offer worksheet
          </h2>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Put an offer or a posted rate into one set of terms. Nothing is assumed: if hours or
            weeks are blank, the figure that needs them stays blank.
          </p>
          {applications.length > 0 ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Save with</span>
              <select
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
                className="h-9 max-w-[18rem] rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No application (not saved)</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.title}
                    {application.company ? `, ${application.company}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              This worksheet is not saved. Start an application on the{' '}
              <a className="underline underline-offset-2" href="/application/">
                Application Desk
              </a>{' '}
              to keep it.
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            {numberField('Base pay', 'basePay')}
            <label className="space-y-1">
              <span className="block text-sm text-muted-foreground">Paid</span>
              <select
                value={offer.payPeriod ?? ''}
                data-guide="offer-period"
                onChange={(event) =>
                  changeOffer({ payPeriod: (event.target.value || null) as PayPeriod | null })
                }
                className="h-9 w-full rounded-md border border-border/50 bg-transparent px-2 text-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose</option>
                {PAY_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {PERIOD_LABEL[period]}
                  </option>
                ))}
              </select>
            </label>
            {numberField('Hours a week', 'hoursPerWeek')}
            {numberField('Weeks a year', 'weeksPerYear', 'An internship might be 10 or 12.')}
            {numberField('Guaranteed bonus, a year', 'guaranteedBonus', 'A signing bonus counts.')}
            {numberField(
              'Variable pay, a year',
              'variablePay',
              'Commission or tips: not promised.'
            )}
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-sm text-muted-foreground">Notes</span>
              <Textarea
                rows={3}
                value={offer.notes}
                onChange={(event) => changeOffer({ notes: event.target.value })}
                placeholder="Housing stipend, transit pass, start date..."
                className="text-base"
              />
            </label>
          </div>

          <dl
            className="content-start space-y-3 rounded-xl border border-border/40 p-5"
            data-guide="offer-results"
          >
            {(
              [
                ['Works out to', money(equivalents.hourly, 'hour')],
                ['Base pay over the period', money(equivalents.annualBase, 'year')],
                ['With the guaranteed bonus', money(equivalents.annualGuaranteed, 'year')],
                [
                  'If the variable pay comes through',
                  money(equivalents.annualWithVariable, 'year'),
                ],
              ] as const
            ).map(([term, value]) => (
              <div key={term} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <dt className="text-sm text-muted-foreground">{term}</dt>
                <dd
                  className={cn(
                    'font-mono text-base tabular-nums',
                    value === 'Needs more detail' ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
            {equivalents.missing.length > 0 && offer.basePay !== null && (
              <p className="pt-1 text-xs text-muted-foreground">
                Fill in hours and weeks to complete the blank figures.
              </p>
            )}
          </dl>
        </div>
      </section>
    </div>
  );
}
