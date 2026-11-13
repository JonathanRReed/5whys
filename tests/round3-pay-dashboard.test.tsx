/**
 * Round 3, batch C: Pay, the dashboard and the applications list. Each block
 * names the report and finding it covers (senior, firstjob, changer, pros,
 * intern, complete).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import titles from '../public/data/pay/onet-31.0-titles-v1.json';
import ApplicationsPanel from '../src/components/ApplicationsPanel';
import CareerDashboard from '../src/components/CareerDashboard';
import PayTool, { moneyRange, openingApplication } from '../src/components/pay/PayTool';
import { hasWages } from '../src/config/pay';
import {
  APPLICATION_DESK_KEY,
  applyOfferChanges,
  createEmptyDesk,
  extrasPhrase,
  loadApplicationDesks,
  normalizeDesk,
  type OfferWorksheet,
  offerEquivalents,
  offerRange,
  updateOfferWorksheet,
} from '../src/lib/application-desk';
import {
  APPLICATIONS_KEY,
  type ApplicationsData,
  loadApplications,
  setAsideApplication,
  sortApplications,
} from '../src/lib/applications';
import { readCareerDashboard, readPostingFor } from '../src/lib/career-bridge';
import { createDefaultData, createRole, STORAGE_KEY as GLOW_KEY } from '../src/lib/glowup-store';
import { readPostingPay } from '../src/lib/pay/posting-pay';
import { createTitleSearch } from '../src/lib/pay/search';
import { parseTitleIndex } from '../src/lib/pay/validate';
import { parseAmount } from '../src/lib/pay-input';

const blank = (): OfferWorksheet => createEmptyDesk().offer;

type App = { id: string; title: string; company?: string; roleId?: string | null; sentOn?: string };

function seedApps(apps: App[], activeId: string | null = apps[0]?.id ?? null) {
  const data: ApplicationsData = {
    version: 1,
    activeId,
    applications: apps.map((app) => ({
      id: app.id,
      title: app.title,
      company: app.company ?? '',
      deadline: null,
      roleId: app.roleId ?? null,
      sentOn: app.sentOn ?? null,
      createdAt: 1,
      updatedAt: 1,
    })),
  };
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(data));
}

function seedOffers(offers: Record<string, Partial<OfferWorksheet>>, updatedAt = 1) {
  const desks: Record<string, unknown> = {};
  for (const [id, offer] of Object.entries(offers)) {
    const desk = createEmptyDesk(updatedAt);
    desk.offer = { ...desk.offer, ...offer };
    desks[id] = normalizeDesk(desk, updatedAt);
  }
  localStorage.setItem(APPLICATION_DESK_KEY, JSON.stringify({ version: 1, desks }));
}

/** A decoded role in the Glow Up store, as the workspace leaves it. Returns its id. */
function seedRole(
  jobTitle: string,
  company: string,
  rawJdText: string,
  data = createDefaultData()
) {
  const next = createRole(data, {
    jobTitle,
    company,
    rawJdText,
    bullets: [
      {
        id: `b-${jobTitle}`,
        text: 'Run PCR on submitted samples',
        status: 'active',
        primarySkillId: null,
        secondarySkillIds: [],
        suggestion: [],
      } as never,
    ],
  });
  localStorage.setItem(GLOW_KEY, JSON.stringify(next));
  return { id: next.currentRoleId as string, data: next };
}

const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('senior 2 and pros 12: a one-time bonus is counted once', () => {
  const pharmacy = {
    ...blank(),
    basePay: 19.5,
    payPeriod: 'hour' as const,
    hoursPerWeek: 40,
    weeksPerYear: 52,
    oneTimeBonus: 1000,
  };

  it('keeps the first year apart from every year after', () => {
    const figures = offerEquivalents(pharmacy);
    expect(figures.annualBase).toBe(40_560);
    expect(figures.annualGuaranteed).toBe(40_560);
    expect(figures.firstYear).toBe(41_560);
    expect(figures.annualWithVariable).toBe(40_560);
    expect(figures.oneTime).toBe(1000);
  });

  it('shows "First year" and "Each year after" in Pay', () => {
    seedApps([{ id: 'a', title: 'Pharmacy technician' }]);
    seedOffers({ a: pharmacy });
    render(<PayTool />);
    const results = document.querySelector('[data-guide="offer-results"]') as HTMLElement;
    const row = (term: string) =>
      within(results).getByText(term).parentElement?.querySelector('dd')?.textContent;
    expect(row('First year, with the one-time bonus')).toBe('$41,560 a year');
    expect(row('Each year after')).toBe('$40,560 a year');
  });

  it('reads several variable parts added with "+", with a name after each', () => {
    expect(parseAmount('35,000 + 40,000 LTIP', { label: 'Variable pay', sum: true })).toEqual({
      ok: true,
      value: 75_000,
    });
    const percent = parseAmount('35k + 5%', { label: 'Variable pay', sum: true, percentOf: 1 });
    expect(percent.ok).toBe(false);
    // "62 k" is still sixty-two thousand, not 62 named "k".
    expect(parseAmount('62 k', { sum: true }).value).toBe(62_000);
  });

  it('round-trips the new fields and drops a one-time bonus of zero', () => {
    seedApps([{ id: 'a', title: 'Analyst' }]);
    seedOffers({ a: { ...pharmacy, received: true, answerBy: '2026-11-20' } });
    const offer = loadApplicationDesks().desks.a.offer;
    expect(offer.oneTimeBonus).toBe(1000);
    expect(offer.received).toBe(true);
    expect(offer.answerBy).toBe('2026-11-20');
    expect(applyOfferChanges(offer, { oneTimeBonus: 0 }).oneTimeBonus).toBeUndefined();
    expect(applyOfferChanges(offer, { answerBy: 'Friday' }).answerBy).toBeUndefined();
  });
});

describe('complete 14: extras on a short placement are named for the placement', () => {
  it('labels the bonus for the weeks entered and adds the amount once', () => {
    const offer = {
      ...blank(),
      basePay: 20,
      payPeriod: 'hour' as const,
      hoursPerWeek: 40,
      weeksPerYear: 10,
      guaranteedBonus: 500,
    };
    expect(extrasPhrase(offer)).toBe('for the 10 weeks');
    expect(extrasPhrase({ ...offer, weeksPerYear: 52 })).toBe('a year');
    expect(offerEquivalents(offer).annualGuaranteed).toBe(8_500);
  });

  it('asks for the amount promised for the placement, not a yearly rate', () => {
    seedApps([{ id: 'a', title: 'Summer intern' }]);
    seedOffers({ a: { basePay: 20, payPeriod: 'hour', hoursPerWeek: 40, weeksPerYear: 10 } });
    render(<PayTool />);
    expect(screen.getByLabelText('Guaranteed bonus, for the 10 weeks')).toBeInTheDocument();
    expect(screen.getByLabelText('Variable pay, for the 10 weeks')).toBeInTheDocument();
    expect(screen.queryByLabelText('Guaranteed bonus, a year')).toBeNull();
  });
});

describe('senior 10: a posted range is kept as a range', () => {
  it('reads "44k to 48k" and shows both ends', () => {
    expect(parseAmount('44k to 48k', { range: true })).toEqual({
      ok: true,
      value: 44_000,
      to: 48_000,
    });
    expect(parseAmount('44-48k', { range: true })).toMatchObject({ value: 44_000, to: 48_000 });
    expect(parseAmount('48k to 44k', { range: true }).ok).toBe(false);
    const { low, high } = offerRange({
      ...blank(),
      basePay: 44_000,
      basePayTo: 48_000,
      payPeriod: 'year',
      hoursPerWeek: 40,
      weeksPerYear: 52,
    });
    expect(moneyRange(low.hourly, high?.hourly, 'an hour', '$', true)).toBe(
      '$21.15 to $23.08 an hour'
    );
  });

  it('drops the top of a range when the base pay moves above it', () => {
    const ranged = applyOfferChanges(blank(), { basePay: 44_000, basePayTo: 48_000 });
    expect(ranged.basePayTo).toBe(48_000);
    expect(applyOfferChanges(ranged, { basePay: 50_000 }).basePayTo).toBeUndefined();
  });
});

describe('firstjob 6 and senior 10: the posting pay reaches Pay', () => {
  it('reads rates, ranges and hours written in a posting, and nothing else', () => {
    expect(readPostingPay('Cashier\n$15.00/hr | 15-25 hrs/week')).toMatchObject({
      basePay: 15,
      basePayTo: null,
      payPeriod: 'hour',
      hoursPerWeek: 15,
      hoursPerWeekTo: 25,
    });
    expect(readPostingPay('Salary range: $44,000 to $48,000 per year')).toMatchObject({
      basePay: 44_000,
      basePayTo: 48_000,
      payPeriod: 'year',
    });
    // A figure with no period is not guessed to be yearly.
    expect(readPostingPay('Salary $44,000')).toBeNull();
  });

  it('offers the figures from the linked posting and fills the worksheet on a press', () => {
    const role = seedRole('Cashier', 'Valley Fresh Market', 'Cashier\n$15.00/hr | 15-25 hrs/week');
    seedApps([{ id: 'a', title: 'Cashier', company: 'Valley Fresh Market', roleId: role.id }]);
    window.history.replaceState(null, '', '/pay/?id=a');
    render(<PayTool />);
    const box = screen.getByTestId('posting-pay');
    expect(box).toHaveTextContent('$15.00/hr | 15-25 hrs/week');
    expect(box).toHaveTextContent('the low end, 15');
    // Reading the posting writes nothing.
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use the figures from the posting' }));
    const offer = loadApplicationDesks().desks.a.offer;
    expect(offer).toMatchObject({ basePay: 15, payPeriod: 'hour', hoursPerWeek: 15 });
    expect(screen.queryByTestId('posting-pay')).toBeNull();
    expect(screen.getByLabelText('Base pay')).toHaveValue('15');
  });
});

describe('firstjob 7: hours and weeks fields read their units', () => {
  it('reads "20hrs" and gives an example that fits the field', () => {
    const hours = { label: 'Hours a week', unit: 'hours' as const, money: false, example: '20' };
    expect(parseAmount('20hrs', hours).value).toBe(20);
    expect(parseAmount('20 hours a week', hours).value).toBe(20);
    expect(parseAmount('20 hrs/week', hours).value).toBe(20);
    const wrong = parseAmount('twenty', hours);
    expect(!wrong.ok && wrong.error).toBe(
      'Hours a week was not understood. Use a number such as 20.'
    );
    expect(parseAmount('10 wks', { unit: 'weeks', money: false }).value).toBe(10);
  });

  it('accepts "20hrs" in Pay', () => {
    render(<PayTool />);
    fill('Hours a week', '20hrs');
    expect(screen.getByLabelText('Hours a week')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/not understood/)).toBeNull();
    expect(screen.getByText('Read as 20.')).toBeInTheDocument();
  });
});

describe('firstjob 8: a month figure, plain labels and a next step', () => {
  it('shows a month and names the total plainly', () => {
    seedApps([{ id: 'a', title: 'Cashier', company: 'Valley Fresh Market' }]);
    seedOffers({ a: { basePay: 15, payPeriod: 'hour', hoursPerWeek: 20, weeksPerYear: 52 } });
    render(<PayTool />);
    const results = document.querySelector('[data-guide="offer-results"]') as HTMLElement;
    expect(results).toHaveTextContent('A month$1,300 a month');
    expect(results).toHaveTextContent('Total base pay$15,600 a year');
    expect(results).not.toHaveTextContent('over the period');
    expect(
      screen.getByRole('link', { name: /back to Cashier at Valley Fresh Market/ })
    ).toHaveAttribute('href', '/application/?id=a');
  });

  it('works a salary out by the month as a twelfth', () => {
    const figures = offerEquivalents({
      ...blank(),
      basePay: 60_000,
      payPeriod: 'year',
      hoursPerWeek: 40,
      weeksPerYear: 48,
    });
    expect(figures.monthly).toBe(5_000);
  });
});

describe('senior 9, firstjob 5, changer 4, pros 1, complete 5: no wage lookup without wages', () => {
  it('shows no wage section and requests nothing while the data is titles only', () => {
    expect(hasWages).toBe(false);
    const fetcher = vi.spyOn(globalThis, 'fetch');
    seedApps([{ id: 'a', title: 'Cashier' }]);
    window.history.replaceState(null, '', '/pay/?id=a');
    render(<PayTool />);
    expect(screen.queryByText('What the job tends to pay')).toBeNull();
    expect(screen.queryByLabelText('Job title')).toBeNull();
    expect(screen.queryByText(/not included in this copy/)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('ranks a civilian manager above a military occupation for a senior title', () => {
    const search = createTitleSearch(parseTitleIndex(titles));
    const first = search('Director of Operations', 5)[0];
    expect(first.onetCode.startsWith('55-')).toBe(false);
    expect(first.title).toBe('General and Operations Managers');
  });
});

describe('changer 4: a return visit opens on the offer worked on last', () => {
  it('prefers the focused application with an offer, then the last offer edited', () => {
    seedApps([
      { id: 'engineer', title: 'Senior Data Engineer' },
      { id: 'ops', title: 'Operations Analyst' },
    ]);
    seedOffers({ ops: { basePay: 62_000, payPeriod: 'year', editedAt: 5 } });
    const apps = loadApplications().applications;
    expect(openingApplication(apps, loadApplicationDesks(), 'engineer')).toBe('ops');
    seedOffers({
      ops: { basePay: 62_000, editedAt: 5 },
      engineer: { basePay: 90_000, editedAt: 1 },
    });
    expect(openingApplication(apps, loadApplicationDesks(), 'engineer')).toBe('engineer');
    expect(openingApplication(apps, { version: 1, desks: {} }, 'engineer')).toBe('engineer');
  });

  it('stamps the time the worksheet was changed', () => {
    seedApps([{ id: 'a', title: 'Analyst' }]);
    const next = updateOfferWorksheet(loadApplicationDesks(), 'a', { basePay: 10 });
    expect(typeof next.desks.a.offer.editedAt).toBe('number');
  });
});

describe('senior 3 (Pay half): an answer-by date and what to do with the comparison', () => {
  it('records an offer in hand with a date, and says how to ask for time', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 10));
    seedApps([{ id: 'a', title: 'Pharmacy technician' }]);
    seedOffers({ a: { basePay: 19.5, payPeriod: 'hour' } });
    render(<PayTool />);
    expect(screen.queryByTestId('offer-deciding')).toBeNull();
    fireEvent.click(screen.getByLabelText('I have this offer and need to answer it'));
    fill('Answer by', '2026-11-20');
    const offer = loadApplicationDesks().desks.a.offer;
    expect(offer).toMatchObject({ received: true, answerBy: '2026-11-20' });
    const deciding = screen.getByTestId('offer-deciding');
    expect(deciding).toHaveTextContent('answer by Nov 20, in 7 days');
    expect(deciding).toHaveTextContent('Could I give you my answer by');
  });

  it('brings back the reason from the Five Whys, in the visitor’s words', () => {
    localStorage.setItem(
      'career-why-history',
      JSON.stringify([
        {
          id: 's1',
          track: 'career',
          topic: 'Research technician or pharmacy',
          responses: ['a', 'b', 'c', 'd', 'e'],
          whyStatement: 'x',
          rootReason: 'Pay enough to live on and still learn something new each month',
          nextStep: 'y',
          timestamp: new Date().toISOString(),
        },
      ])
    );
    seedApps([{ id: 'a', title: 'Pharmacy technician' }]);
    seedOffers({ a: { basePay: 19.5, payPeriod: 'hour', received: true } });
    render(<PayTool />);
    expect(screen.getByTestId('offer-deciding')).toHaveTextContent(
      'Pay enough to live on and still learn something new each month'
    );
  });
});

describe('senior 12: the comparison fits a phone', () => {
  it('draws a card per offer beside the table, with the one-time money apart', () => {
    seedApps([
      { id: 'a', title: 'Pharmacy technician' },
      { id: 'b', title: 'Research Technician I' },
    ]);
    seedOffers({
      a: {
        basePay: 19.5,
        payPeriod: 'hour',
        hoursPerWeek: 40,
        weeksPerYear: 52,
        oneTimeBonus: 1000,
      },
      b: { basePay: 46_000, payPeriod: 'year', hoursPerWeek: 40, weeksPerYear: 52 },
    });
    render(<PayTool />);
    const cards = screen.getByTestId('offer-compare-cards');
    expect(cards.className).toContain('sm:hidden');
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    expect(cards).toHaveTextContent('One-time$1,000 once');
    const table = screen.getByTestId('offer-compare');
    expect(within(table).getByRole('columnheader', { name: 'One-time' })).toBeInTheDocument();
    // The yearly columns leave the one-time money out.
    expect(table).toHaveTextContent('$40,560 a year');
    expect(table).not.toHaveTextContent('$41,560');
  });
});

describe('senior 8: the dashboard agrees with the workspace', () => {
  it('finds the decoded posting for an application added in Pay by its title', () => {
    seedRole(
      'Research Technician I',
      'Halvorsen Institute',
      'Salary range: $44,000 to $48,000 per year'
    );
    seedApps([{ id: 'tech', title: 'Research Technician I', company: 'Halvorsen Institute' }]);
    const app = readCareerDashboard().applications[0];
    expect(app.decoded).toBe(true);
    expect(app.roleMatched).toBe(true);
    expect(readPostingFor('tech')?.text).toContain('$44,000');
    // Matching is read only.
    expect(loadApplications().applications[0].roleId).toBeNull();
  });

  it('does not match a role at another company, or one of two that fit', () => {
    const first = seedRole('Analyst', 'Acme', 'x');
    seedApps([{ id: 'a', title: 'Analyst', company: 'Other Co' }]);
    expect(readCareerDashboard().applications[0].decoded).toBe(false);
    seedRole('Analyst', '', 'y', first.data);
    seedApps([{ id: 'a', title: 'Analyst' }]);
    expect(readCareerDashboard().applications[0].decoded).toBe(false);
  });

  it('says a networking rep once, not under every application', () => {
    seedApps([
      { id: 'a', title: 'Pharmacy technician' },
      { id: 'b', title: 'Research Technician I' },
    ]);
    render(
      <ApplicationsPanel
        applications={readCareerDashboard().applications}
        readiness={{ resumeScored: false, practiceRounds: 1, storyCount: 0 }}
        onChanged={() => {}}
      />
    );
    expect(screen.getByTestId('shared-readiness')).toHaveTextContent(
      'you have 1 networking practice rep. These count for every application.'
    );
    expect(screen.queryByText('1 practice rep')).toBeNull();
  });

  it('gives an offer in hand an answer-by step, not "Paste the posting"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 10));
    seedApps([{ id: 'a', title: 'Pharmacy technician', company: 'Northside' }]);
    seedOffers({ a: { basePay: 19.5, payPeriod: 'hour', received: true, answerBy: '2026-11-20' } });
    const dash = readCareerDashboard();
    expect(dash.recommendations[0]).toMatchObject({
      tool: 'Pay',
      text: 'You have an offer for "Pharmacy technician at Northside". Answer by Nov 20, in 7 days.',
      href: '/pay/?id=a',
    });
    render(
      <ApplicationsPanel
        applications={dash.applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={() => {}}
      />
    );
    expect(screen.queryByText('Paste the posting on the desk')).toBeNull();
    expect(screen.queryByText('No decoded posting')).toBeNull();
    expect(screen.getByText('Offer in hand')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weigh it in Pay' })).toHaveAttribute(
      'href',
      '/pay/?id=a'
    );
  });
});

describe('pros 14: one networking rep is one card', () => {
  it('drops the average card when the rep already gave a next step', () => {
    localStorage.setItem(
      'networking-practice-sessions',
      JSON.stringify([
        {
          createdAt: new Date().toISOString(),
          scenarioTitle: 'Meet the team',
          ratings: { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 },
        },
      ])
    );
    const dash = readCareerDashboard();
    const networking = [
      ...dash.nextActions.filter((a) => a.tool === 'Networking Practice'),
      ...dash.recommendations.filter((r) => r.tool === 'Networking Practice'),
    ];
    expect(networking).toHaveLength(1);
  });
});

describe('complete 4: a recommendation opens the application it names', () => {
  it('names the role to make current, or sends an application with none to its desk', () => {
    const role = seedRole('Library assistant', 'City Library', 'x');
    seedApps([
      {
        id: 'a',
        title: 'Library assistant',
        company: 'City Library',
        roleId: role.id,
        sentOn: '2026-11-01',
      },
      { id: 'b', title: 'Clerk', company: 'Other Company', sentOn: '2026-11-02' },
    ]);
    const recs = readCareerDashboard().recommendations;
    const library = recs.find((r) => r.text.includes('Library assistant'));
    expect(library).toMatchObject({ href: '/interview-glow-up/rehearse/', roleId: role.id });
    const clerk = recs.find((r) => r.text.includes('Clerk'));
    expect(clerk?.href).toBe('/application/?id=b&station=posting');
  });

  it('makes that role current when the card is followed', () => {
    const library = seedRole('Library assistant', 'City Library', 'x');
    const other = seedRole('Clerk', 'Other Company', 'y', library.data);
    seedApps([
      {
        id: 'a',
        title: 'Library assistant',
        company: 'City Library',
        roleId: library.id,
        sentOn: '2026-11-01',
      },
    ]);
    expect(JSON.parse(localStorage.getItem(GLOW_KEY) ?? '{}').currentRoleId).toBe(other.id);
    render(<CareerDashboard />);
    fireEvent.click(
      screen.getByRole('link', { name: /Practice for the interview while you wait/ })
    );
    expect(JSON.parse(localStorage.getItem(GLOW_KEY) ?? '{}').currentRoleId).toBe(library.id);
  });
});

describe('changer 6: triage by date, and "Not applying" keeps the work', () => {
  it('sorts by the soonest date, then sent, then set aside', () => {
    const make = (id: string, daysUntil: number | null, extra = {}) => ({
      id,
      daysUntil,
      updatedAt: 1,
      ...extra,
    });
    const sorted = sortApplications(
      [
        make('focus', null),
        make('aside', 1, { setAside: { on: '2026-11-13', reason: '' } }),
        make('sent', 2, { sentOn: '2026-11-10' }),
        make('soon', 7),
      ],
      'focus'
    );
    expect(sorted.map((a) => a.id)).toEqual(['soon', 'focus', 'sent', 'aside']);
  });

  it('sets an application aside with a reason, keeps its desk, and brings it back', () => {
    seedApps([
      { id: 'reach', title: 'Senior Data Engineer' },
      { id: 'fit', title: 'Project Coordinator' },
    ]);
    seedOffers({ reach: { notes: 'kept' } });
    const onChanged = vi.fn();
    const { rerender } = render(
      <ApplicationsPanel
        applications={readCareerDashboard().applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={onChanged}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Not applying: Senior Data Engineer' }));
    fill('Why not (optional)', 'Needs seven years I do not have yet');
    fireEvent.click(screen.getByRole('button', { name: 'Set it aside' }));
    const stored = loadApplications().applications.find((a) => a.id === 'reach');
    expect(stored?.setAside?.reason).toBe('Needs seven years I do not have yet');
    expect(loadApplicationDesks().desks.reach.offer.notes).toBe('kept');
    const dash = readCareerDashboard();
    expect(dash.applications.map((a) => a.id)).toEqual(['fit', 'reach']);
    expect(dash.recommendations.some((r) => r.text.includes('Senior Data Engineer'))).toBe(false);
    rerender(
      <ApplicationsPanel
        applications={dash.applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={onChanged}
      />
    );
    expect(
      screen.getByText(/Needs seven years I do not have yet\. Its work is kept\./)
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back in play: Senior Data Engineer' }));
    expect(loadApplications().applications.find((a) => a.id === 'reach')?.setAside).toBeUndefined();
  });

  it('refuses a set-aside date that is not a date', () => {
    seedApps([{ id: 'a', title: 'A' }]);
    const data = loadApplications();
    expect(setAsideApplication(data, 'a', { on: 'today' })).toBe(data);
  });

  it('names a recent decode as a decode, not as interview prep', () => {
    seedRole('Analyst', 'Acme', 'x');
    const activity = readCareerDashboard().recentActivity.find(
      (a) => a.tool === 'Interview Glow Up'
    );
    expect(activity?.action).toBe('Decoded a posting');
  });
});

describe('intern 7: the dashboard says where the visitor left off', () => {
  it('names the desk worked on last and links to its next station', () => {
    const role = seedRole('Operations Intern', 'Coastline Supply Co.', 'x');
    seedApps([
      { id: 'a', title: 'Operations Intern', company: 'Coastline Supply Co.', roleId: role.id },
    ]);
    const desk = createEmptyDesk(Date.now() + 10_000);
    desk.letter = { ...desk.letter, hook: 'I keep counts honest.' };
    desk.qualifications = [{ requirementId: 'r', status: 'have', plan: '', updatedAt: 1 } as never];
    desk.bullets = { ...desk.bullets, experience: 'Stocked shelves' };
    localStorage.setItem(
      APPLICATION_DESK_KEY,
      JSON.stringify({ version: 1, desks: { a: normalizeDesk(desk, Date.now() + 10_000) } })
    );
    const leftOff = readCareerDashboard().leftOff;
    expect(leftOff).toMatchObject({
      tool: 'The Application Desk',
      what: 'The desk for Operations Intern at Coastline Supply Co.',
      next: 'Run the check before you send.',
      href: '/application/?id=a&station=send',
    });
    render(<CareerDashboard />);
    const card = screen.getByTestId('left-off');
    expect(within(card).getByRole('link', { name: 'Pick it up' })).toHaveAttribute(
      'href',
      '/application/?id=a&station=send'
    );
  });

  it('names Pay when the worksheet was the last thing changed', () => {
    seedApps([{ id: 'a', title: 'Cashier' }]);
    const next = updateOfferWorksheet(loadApplicationDesks(), 'a', { basePay: 15 });
    localStorage.setItem(APPLICATION_DESK_KEY, JSON.stringify(next));
    expect(readCareerDashboard().leftOff).toMatchObject({ tool: 'Pay', href: '/pay/?id=a' });
  });
});
