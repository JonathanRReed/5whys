import * as React from 'react';
import {
  APPLICATION_DESK_KEY,
  type ApplicationDeskData,
  applyOfferChanges,
  createDefaultDeskData,
  createEmptyDesk,
  loadApplicationDesks,
  type OfferChanges,
  type OfferWorksheet,
  offerEquivalents,
  PAY_PERIODS,
  type PayPeriod,
  type PercentField,
  periodPhrase,
  saveApplicationDesks,
  updateOfferWorksheet,
} from '../../lib/application-desk';
import {
  APPLICATIONS_KEY,
  activeApplicationId,
  addApplication,
  loadApplications,
  saveApplications,
  type TrackedApplication,
} from '../../lib/applications';
import { onDeviceCleared } from '../../lib/device-events';
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
import { type ParsedAmount, parseAmount } from '../../lib/pay-input';
import { cn, focusWhenReady } from '../../lib/utils';
import Announcer, { useSettledAnnouncement } from '../shared/Announcer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const PERIOD_LABEL: Record<PayPeriod, string> = {
  hour: 'per hour',
  week: 'per week',
  month: 'per month',
  year: 'per year',
};

const NEEDS_MORE = 'Needs more detail';

/**
 * An amount in the currency typed with the base pay, followed by what it is
 * for: "an hour", "a week", "a year", or "over 10 weeks".
 */
export const money = (value: number | null, per: string, symbol = '$', cents = false) =>
  value === null
    ? NEEDS_MORE
    : `${symbol}${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
      }).format(value)} ${per}`;

/** Hours a week past which hourly work is usually paid as overtime in the United States. */
const OVERTIME_AFTER_HOURS = 40;

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
  // Read the count of matches once the visitor stops typing, not per keystroke.
  const [typed, setTyped] = React.useState(false);
  const searchMessage = useSettledAnnouncement(
    picked || !search || occupationQuery.length < 2
      ? ''
      : candidates.length === 0
        ? 'No occupation matches that title.'
        : `${candidates.length} ${candidates.length === 1 ? 'occupation matches' : 'occupations match'}. Pick the occupation that fits.`,
    typed
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
    setAppId(known && wanted ? wanted : (activeApplicationId(apps) ?? ''));
    // Arriving from an application's desk: start from that role's title. The
    // title is read from this device's storage, never from the address.
    const from = apps.applications.find((a) => a.id === wanted);
    if (from?.title) setQuery(from.title);
  }, []);

  // Whether the visitor has changed the worksheet on this visit, so a saved
  // offer loading is not read out.
  const [offerEdited, setOfferEdited] = React.useState(false);
  const heldDesks = React.useRef<ReturnType<typeof loadApplicationDesks> | null>(null);
  const [unsaved, setUnsaved] = React.useState(false);
  // Set when the application this worksheet was saved with went away in
  // another tab (removed, or the device cleared).
  const [gone, setGone] = React.useState(false);

  /**
   * Read applications and worksheets again. If the chosen application no
   * longer exists, the worksheet stops saving under it and empties, so an
   * open page cannot bring removed or cleared work back.
   */
  const shownAppId = React.useRef(appId);
  shownAppId.current = appId;
  const reread = React.useCallback(() => {
    const apps = loadApplications();
    setApplications(apps.applications);
    if (!heldDesks.current) setDesks(loadApplicationDesks());
    const current = shownAppId.current;
    if (!current || apps.applications.some((a) => a.id === current)) return;
    heldDesks.current = null;
    setUnsaved(false);
    setScratch(createEmptyDesk().offer);
    setGone(true);
    setAppId('');
  }, []);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === APPLICATIONS_KEY ||
        event.key === APPLICATION_DESK_KEY
      )
        reread();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') reread();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', reread);
    document.addEventListener('visibilitychange', onVisible);
    const stop = onDeviceCleared(reread);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', reread);
      document.removeEventListener('visibilitychange', onVisible);
      stop();
    };
  }, [reread]);

  const offer = appId ? (desks.desks[appId]?.offer ?? createEmptyDesk().offer) : scratch;
  const changeOffer = (changes: OfferChanges) => {
    setOfferEdited(true);
    if (!appId) {
      setScratch((current) => applyOfferChanges(current, changes));
      return;
    }
    if (!loadApplications().applications.some((a) => a.id === appId)) {
      reread();
      return;
    }
    // Build on the store as it is now, so work saved in another tab is kept.
    // If the browser will not save, build on what this page holds instead, so
    // the next field does not undo the last one.
    const next = updateOfferWorksheet(heldDesks.current ?? loadApplicationDesks(), appId, changes);
    const saved = saveApplicationDesks(next);
    heldDesks.current = saved ? null : next;
    setUnsaved(!saved);
    setDesks(next);
  };
  const equivalents = offerEquivalents(offer);
  const symbol = offer.currency ?? '$';
  const period = periodPhrase(offer);
  const shown = {
    hourly: money(equivalents.hourly, 'an hour', symbol, true),
    weekly: money(equivalents.weekly, 'a week', symbol),
    base: money(equivalents.annualBase, period, symbol),
  };
  const offerMessage = useSettledAnnouncement(
    shown.hourly === NEEDS_MORE && shown.base === NEEDS_MORE
      ? ''
      : `Works out to ${[shown.hourly, shown.weekly, shown.base]
          .filter((text) => text !== NEEDS_MORE)
          .join(', ')}, before taxes.`,
    offerEdited
  );
  const hasBonus =
    (offer.guaranteedBonus ?? 0) > 0 || (offer.percentOfBase?.guaranteedBonus ?? 0) > 0;
  const hasVariable = (offer.variablePay ?? 0) > 0 || (offer.percentOfBase?.variablePay ?? 0) > 0;
  const hasOvertime = equivalents.overtimeAnnual > 0;
  const longHours =
    offer.payPeriod === 'hour' &&
    (offer.hoursPerWeek ?? 0) > OVERTIME_AFTER_HOURS &&
    offer.overtimeHoursPerWeek === null;
  const notPromised =
    hasOvertime && hasVariable
      ? 'If the overtime and variable pay come through'
      : hasOvertime
        ? 'With the overtime'
        : 'If the variable pay comes through';

  // --- Another offer to compare ------------------------------------------
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newCompany, setNewCompany] = React.useState('');
  const [addFailed, setAddFailed] = React.useState(false);
  const addOffer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    const { data, application } = addApplication(loadApplications(), {
      title: newTitle,
      company: newCompany,
    });
    if (!saveApplications(data)) {
      setAddFailed(true);
      return;
    }
    // What was typed with no application to keep it goes with the new one.
    const kept = !appId && scratch.basePay !== null;
    if (kept) {
      const next = updateOfferWorksheet(loadApplicationDesks(), application.id, {
        ...scratch,
        percentOfBase: scratch.percentOfBase ?? {},
      });
      saveApplicationDesks(next);
      setDesks(next);
      setScratch(createEmptyDesk().offer);
    }
    setApplications(data.applications);
    setAddFailed(false);
    setGone(false);
    setAppId(application.id);
    setNewTitle('');
    setNewCompany('');
    setAdding(false);
    focusWhenReady('offer-title');
  };
  const credits = payAttributions();

  // Yearly base pay, when it can be worked out, is what a percentage refers to.
  const yearlyBase = offerEquivalents({ ...offer, overtimeHoursPerWeek: null }).annualBase;

  const field = (
    label: string,
    key: NumberKey,
    options: { hint?: string; min?: number; max?: number; percent?: boolean } = {}
  ) => (
    <AmountField
      key={`${appId}-${key}`}
      label={label}
      hint={options.hint}
      guide={`offer-${key}`}
      value={offer[key]}
      percent={isPercentField(key) ? (offer.percentOfBase?.[key] ?? null) : null}
      symbol={key === 'basePay' ? (offer.currency ?? null) : null}
      parse={(text) => {
        const parsed = parseAmount(text, {
          label,
          min: options.min,
          max: options.max,
          money: isMoneyField(key),
          ...(options.percent ? { percentOf: yearlyBase } : {}),
        });
        // One offer, one currency: the one typed with the base pay.
        const typed = parsed.ok ? (parsed.currency ?? (text.includes('$') ? '$' : null)) : null;
        if (key !== 'basePay' && typed && typed !== symbol) {
          return {
            ok: false,
            value: null,
            error: `${label} is in ${typed}, but the base pay is in ${symbol}. Use one currency for the offer.`,
          };
        }
        return parsed;
      }}
      percentOf={options.percent ? yearlyBase : undefined}
      onCommit={(value, percent, currency) =>
        changeOffer(
          isPercentField(key)
            ? { [key]: value, percentOfBase: { [key]: percent ?? null } }
            : key === 'basePay'
              ? { basePay: value, ...(currency !== undefined ? { currency } : {}) }
              : { [key]: value }
        )
      }
    />
  );

  // Every application with an offer started, for the side-by-side table.
  const compared = applications
    .map((application) => ({ application, offer: desks.desks[application.id]?.offer }))
    .filter(
      (entry): entry is { application: TrackedApplication; offer: OfferWorksheet } =>
        entry.offer !== undefined && entry.offer.basePay !== null
    )
    .map((entry) => ({ ...entry, figures: offerEquivalents(entry.offer) }));

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
              setTyped(true);
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

        <Announcer message={searchMessage} />
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
                    onClick={() => {
                      setPicked(candidate);
                      // The list goes away; the occupation that replaced it takes focus.
                      focusWhenReady('pay-occupation');
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-overlay/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-foreground">{candidate.title}</span>
                    {/* The title is already the first line: read it once. */}
                    <span className="text-xs text-muted-foreground">
                      <span aria-hidden="true">{candidate.title} </span>({candidate.onetCode})
                    </span>
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
            <h3
              id="pay-occupation"
              tabIndex={-1}
              className="font-display text-xl font-semibold focus-visible:outline-hidden"
              data-testid="pay-occupation"
            >
              {picked.title}
            </h3>
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
          <h2
            id="offer-title"
            tabIndex={-1}
            className="text-2xl font-semibold focus:outline-hidden"
          >
            Offer worksheet
          </h2>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Put an offer or a posted rate into one set of terms. Nothing is assumed: if hours or
            weeks are blank, the figure that needs them stays blank.
          </p>
          {gone && (
            <p role="alert" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
              The application this worksheet was saved with was removed in another tab, so the
              worksheet was emptied and is no longer saved.
            </p>
          )}
          {unsaved && (
            <p role="alert" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
              This browser would not save your last change. It is still on this page, but it will be
              gone when the page closes.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {applications.length > 0 ? (
              <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Save with</span>
                <select
                  value={appId}
                  onChange={(event) => {
                    setGone(false);
                    setAppId(event.target.value);
                  }}
                  className="h-10 w-full min-w-0 max-w-[18rem] rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                This worksheet is not saved until it belongs to an offer.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={adding}
              onClick={() => setAdding((open) => !open)}
            >
              {adding
                ? 'Cancel'
                : applications.length > 0
                  ? 'Add another offer'
                  : 'Save it as an offer'}
            </Button>
          </div>
          {adding && (
            <form
              onSubmit={addOffer}
              aria-label="Another offer to compare"
              className="grid max-w-2xl gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end"
            >
              <label className="space-y-1">
                <span className="block text-sm text-muted-foreground">Role</span>
                <Input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Summer camp counselor"
                  className="text-base"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm text-muted-foreground">
                  Company or organization (optional)
                </span>
                <Input
                  value={newCompany}
                  onChange={(event) => setNewCompany(event.target.value)}
                  placeholder="Lakeside YMCA"
                  className="text-base"
                />
              </label>
              <Button type="submit" disabled={!newTitle.trim()}>
                Add it
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-3">
                It is tracked like any application, so it also shows on the dashboard and the
                Application Desk.
                {!appId && scratch.basePay !== null ? ' What you typed below goes with it.' : ''}
              </p>
              {addFailed && (
                <p
                  role="alert"
                  className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground sm:col-span-3"
                >
                  This browser would not save it. Free some space in the storage panel on the
                  dashboard, then try again.
                </p>
              )}
            </form>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            {field('Base pay', 'basePay', { hint: 'Write it as offered: 26, 62000 or 62k.' })}
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
            {field('Hours a week', 'hoursPerWeek', {
              min: 1,
              max: 100,
              hint: 'The hours you expect to work, even on a salary.',
            })}
            {field('Weeks a year', 'weeksPerYear', {
              min: 1,
              max: 52,
              hint: 'A full year is 52. A summer role might be 10 or 12.',
            })}
            {offer.payPeriod === 'hour' &&
              field('Overtime each week, in hours', 'overtimeHoursPerWeek', {
                min: 0,
                max: 60,
                hint: 'Counted at time and a half. Leave blank if there is none.',
              })}
            {field('Guaranteed bonus, a year', 'guaranteedBonus', {
              percent: true,
              hint: 'An amount, or a percentage of base pay such as 5%.',
            })}
            {field('Variable pay, a year', 'variablePay', {
              percent: true,
              hint: 'Commission, tips or a bonus "up to" an amount: not promised.',
            })}
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-sm text-muted-foreground">Notes</span>
              <Textarea
                rows={3}
                value={offer.notes}
                onChange={(event) => changeOffer({ notes: event.target.value })}
                placeholder="Benefits, schedule, start date, anything else that matters to you."
                className="text-base"
              />
            </label>
          </div>

          <Announcer message={offerMessage} />
          <dl
            className="content-start space-y-3 rounded-xl border border-border/40 p-5"
            data-guide="offer-results"
          >
            {(
              [
                ['Works out to', shown.hourly, true],
                ['A week', shown.weekly, true],
                ['Base pay over the period', shown.base, true],
                [
                  'Overtime, if you work it',
                  money(equivalents.overtimeAnnual, period, symbol),
                  hasOvertime,
                ],
                [
                  'With the guaranteed bonus',
                  money(equivalents.annualGuaranteed, period, symbol),
                  hasBonus,
                ],
                [
                  notPromised,
                  money(equivalents.annualWithVariable, period, symbol),
                  hasOvertime || hasVariable,
                ],
              ] as const
            )
              .filter(([, , show]) => show)
              .map(([term, value]) => (
                <div key={term} className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <dt className="text-sm text-muted-foreground">{term}</dt>
                  <dd
                    className={cn(
                      // A long figure wraps inside the panel instead of widening the page.
                      'min-w-0 max-w-full font-mono text-base tabular-nums break-all',
                      value === NEEDS_MORE ? 'text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            <p className="pt-1 text-xs text-muted-foreground">
              All figures are before taxes and deductions.
            </p>
            {hasOvertime && (
              <p className="text-xs text-muted-foreground">
                Overtime depends on the hours you are given, so it is expected, not promised. It is
                kept out of the base and counted only in the last line.
              </p>
            )}
            {longHours && (
              <p className="text-xs text-foreground" data-testid="overtime-hint">
                In the United States, hours over {OVERTIME_AFTER_HOURS} a week are usually paid at
                time and a half for hourly workers. If some of these hours are overtime, put{' '}
                {OVERTIME_AFTER_HOURS} in "Hours a week" and the rest in "Overtime each week, in
                hours".
              </p>
            )}
            {offer.payPeriod !== null && offer.payPeriod !== 'hour' && offer.basePay !== null && (
              <p className="text-xs text-muted-foreground">
                A salary usually pays the same however many hours you work, so more hours a week
                means less an hour.
              </p>
            )}
            {equivalents.missing.length > 0 && offer.basePay !== null && (
              <p className="text-xs text-muted-foreground">
                Fill in hours and weeks to complete the blank figures.
              </p>
            )}
          </dl>
        </div>

        {compared.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Side by side</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm" data-testid="offer-compare">
                <thead>
                  <tr className="border-b border-border/40 text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Offer
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Hours a week
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      An hour
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Base, over the period
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      With guaranteed bonus
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      If overtime and variable pay come through
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compared.map(({ application, offer: row, figures }) => {
                    const sign = row.currency ?? '$';
                    const per = periodPhrase(row);
                    return (
                      <tr key={application.id} className="border-b border-border/25 align-top">
                        <th scope="row" className="py-2 pr-4 text-left font-normal text-foreground">
                          {application.title}
                          {application.company && (
                            <span className="block text-xs text-muted-foreground">
                              {application.company}
                            </span>
                          )}
                        </th>
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {row.hoursPerWeek ?? 'Not given'}
                          {row.overtimeHoursPerWeek ? (
                            <span className="block text-xs text-muted-foreground">
                              +{row.overtimeHoursPerWeek} overtime
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {money(figures.hourly, 'an hour', sign, true)}
                        </td>
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {money(figures.annualBase, per, sign)}
                        </td>
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {money(figures.annualGuaranteed, per, sign)}
                        </td>
                        <td className="py-2 font-mono tabular-nums">
                          {money(figures.annualWithVariable, per, sign)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              The hourly figure divides pay by the hours you entered, so a salary with long weeks
              shows what an hour of it is really worth. Overtime is never counted in the base. Every
              figure is before taxes.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const isPercentField = (key: NumberKey): key is PercentField =>
  key === 'guaranteedBonus' || key === 'variablePay';

/** Hours and weeks are counts, not money: a currency symbol there is refused. */
const isMoneyField = (key: NumberKey) =>
  key === 'basePay' || key === 'guaranteedBonus' || key === 'variablePay';

type NumberKey =
  | 'basePay'
  | 'guaranteedBonus'
  | 'variablePay'
  | 'hoursPerWeek'
  | 'weeksPerYear'
  | 'overtimeHoursPerWeek';

type AmountFieldProps = {
  label: string;
  hint?: string;
  guide: string;
  value: number | null;
  /** The percentage this amount was typed as, when it was: 5 for "5%". */
  percent?: number | null;
  parse: (text: string) => ParsedAmount;
  /** What a typed percentage is a share of. When it changes, a percentage is worked out again. */
  percentOf?: number | null;
  /** The currency symbol a stored amount was typed with, other than dollars. */
  symbol?: string | null;
  /** `currency` is the symbol typed, or undefined when none was. */
  onCommit: (value: number | null, percent: number | null, currency?: string) => void;
};

/** What the field shows for a stored amount: the percentage it was typed as, or the number. */
const shownText = (
  value: number | null,
  percent: number | null | undefined,
  symbol?: string | null
) =>
  typeof percent === 'number'
    ? `${percent}%`
    : value === null
      ? ''
      : `${symbol && symbol !== '$' ? symbol : ''}${value}`;

/**
 * A pay field that keeps what was typed. "62k" and "5%" are understood and
 * shown as understood; anything else is refused with a reason, never guessed.
 */
function AmountField({
  label,
  hint,
  guide,
  value,
  percent,
  parse,
  percentOf,
  symbol,
  onCommit,
}: AmountFieldProps) {
  const [text, setText] = React.useState(shownText(value, percent, symbol));
  const [error, setError] = React.useState<string | null>(null);
  const lastCommitted = React.useRef(value);
  const noteId = React.useId();

  // Follow changes that came from elsewhere (another application, a reload).
  // biome-ignore lint/correctness/useExhaustiveDependencies: the percentage is read with the value it belongs to
  React.useEffect(() => {
    if (value === lastCommitted.current) return;
    lastCommitted.current = value;
    setText(shownText(value, percent, symbol));
    setError(null);
  }, [value]);

  const change = (next: string) => {
    setText(next);
    const parsed = parse(next);
    setError(parsed.ok ? null : parsed.error);
    lastCommitted.current = parsed.value;
    onCommit(
      parsed.value,
      parsed.ok ? (parsed.percent ?? null) : null,
      // A dollar sign typed again returns the offer to dollars.
      parsed.ok ? (parsed.currency ?? (next.includes('$') ? '$' : undefined)) : undefined
    );
  };

  // "5%" of the base pay is a different amount once the base pay is corrected.
  const seenBase = React.useRef(percentOf);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the base changes; the field's text and parser are read as they are then
  React.useEffect(() => {
    if (seenBase.current === percentOf) return;
    seenBase.current = percentOf;
    if (text.includes('%')) change(text);
  }, [percentOf]);

  const understood =
    !error &&
    value !== null &&
    text.trim() !== '' &&
    shownText(value, null, symbol) !== text.trim() &&
    String(value) !== text.trim();
  const note =
    error ??
    (understood
      ? `Read as ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value ?? 0)}.`
      : hint);

  return (
    <div className="space-y-1">
      <label className="block space-y-1">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <Input
          inputMode="decimal"
          data-guide={guide}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          onChange={(event) => change(event.target.value)}
          className="text-base"
        />
      </label>
      {note && (
        <p
          id={noteId}
          className={cn('text-xs break-words', error ? 'text-love' : 'text-muted-foreground')}
        >
          {note}
        </p>
      )}
    </div>
  );
}
