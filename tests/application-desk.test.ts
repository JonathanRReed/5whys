import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_DESK_KEY,
  addActionStep,
  annualEquivalent,
  createDefaultDeskData,
  createEmptyDesk,
  datedActionSteps,
  deleteApplication,
  getDesk,
  hourlyEquivalent,
  loadApplicationDesks,
  normalizeDesk,
  offerEquivalents,
  pruneDesks,
  removeActionStep,
  removeDesk,
  removeQualification,
  saveApplicationDesks,
  saveMessageVariant,
  setChecklistTick,
  setQualification,
  setResumeSelection,
  stationsByApplication,
  stationsWithContent,
  updateActionStep,
  updateBulletsFlow,
  updateLetter,
  updateOfferWorksheet,
} from '../src/lib/application-desk';
import {
  APPLICATIONS_KEY,
  addApplication,
  createDefaultApplications,
  loadApplications,
  saveApplications,
} from '../src/lib/applications';
import { readCareerDashboard } from '../src/lib/career-bridge';

const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('application desk storage', () => {
  it('round-trips a desk through save and load', () => {
    let data = createDefaultDeskData();
    data = setQualification(data, 'app-1', 'req-1', { status: 'have', plan: 'Food bank drive' });
    data = updateLetter(data, 'app-1', { hook: 'The water lab posting named field sampling.' });
    expect(saveApplicationDesks(data)).toBe(true);
    const loaded = loadApplicationDesks();
    expect(getDesk(loaded, 'app-1').qualifications).toEqual([
      expect.objectContaining({ requirementId: 'req-1', status: 'have', plan: 'Food bank drive' }),
    ]);
    expect(getDesk(loaded, 'app-1').letter.hook).toBe(
      'The water lab posting named field sampling.'
    );
  });

  it('loading never writes, even when the stored data needed repair', () => {
    localStorage.setItem(APPLICATION_DESK_KEY, '{"desks":{"a":{"qualifications":"oops"}}}');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    loadApplicationDesks();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns an empty desk set for missing, malformed, or unreadable storage', () => {
    expect(loadApplicationDesks()).toEqual(createDefaultDeskData());
    localStorage.setItem(APPLICATION_DESK_KEY, 'not json');
    expect(loadApplicationDesks()).toEqual(createDefaultDeskData());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(loadApplicationDesks()).toEqual(createDefaultDeskData());
  });

  it('reports a refused save instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    expect(saveApplicationDesks(createDefaultDeskData())).toBe(false);
  });

  it('normalizes hand-edited and partial data without losing what is valid', () => {
    localStorage.setItem(
      APPLICATION_DESK_KEY,
      JSON.stringify({
        desks: {
          'app-1': {
            qualifications: [
              { requirementId: 'r1', status: 'have', plan: 'Club treasurer' },
              { requirementId: 'r1', status: 'maybe' },
              { requirementId: 'r2', status: 'expert' },
              { status: 'have' },
              'junk',
            ],
            actionPlan: [
              { id: 's1', text: 'Finish the Excel course', due: '2026-12-01' },
              { text: 'Ask Ms. Ortiz for a reference', due: '2026-02-30', done: 'yes' },
              { id: 's3', text: '   ' },
            ],
            bullets: { experience: 'Food bank drive', bullets: ['Organized 12 volunteers'] },
            letter: {
              hook: 'Hi',
              messages: {
                linkedin: { text: 'Hello', source: 'robot' },
                'intro-call': { text: '' },
              },
            },
            checklist: { 'someone-read-it': true, other: 'yes' },
            offer: {
              basePay: '18.50',
              payPeriod: 'fortnight',
              hoursPerWeek: 20,
              weeksPerYear: -4,
              wageSourceDate: '2026-11-12',
            },
            resumeSelection: { bulletIds: ['b1', 'b1', 7, 'b2'] },
          },
          'app-2': 'not an object',
        },
      }).replace('"desks":{', '"desks":{"__proto__":{"polluted":true},')
    );
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toContain('"__proto__"');
    const data = loadApplicationDesks();
    expect(Object.keys(data.desks).sort()).toEqual(['app-1', 'app-2']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const desk = getDesk(data, 'app-1');
    expect(desk.qualifications.map((r) => [r.requirementId, r.status, r.plan])).toEqual([
      ['r1', 'have', 'Club treasurer'],
      ['r2', 'unset', ''],
    ]);
    expect(desk.actionPlan).toHaveLength(2);
    expect(desk.actionPlan[0]).toMatchObject({ id: 's1', due: '2026-12-01', done: false });
    expect(desk.actionPlan[1]).toMatchObject({ due: null, done: false });
    expect(desk.actionPlan[1].id).toBeTruthy();
    expect(desk.bullets.experience).toBe('Food bank drive');
    // Saved before "included" was recorded: written text with no place was
    // left out of the tailored copy, and stays out. An empty slot takes the
    // new default.
    expect(desk.bullets.bullets).toEqual([
      { bulletId: null, text: 'Organized 12 volunteers', included: false },
      { bulletId: null, text: '', included: true },
    ]);
    expect(desk.letter.messages.linkedin).toMatchObject({ text: 'Hello', source: 'student' });
    expect(desk.letter.messages['intro-call']).toBeNull();
    expect(desk.letter.messages['follow-up-email']).toBeNull();
    expect(desk.checklist).toEqual({ 'someone-read-it': true });
    expect(desk.offer).toMatchObject({
      basePay: 18.5,
      payPeriod: null,
      hoursPerWeek: 20,
      weeksPerYear: null,
      wageSourceDate: '2026-11-12',
      notes: '',
    });
    expect(desk.resumeSelection?.bulletIds).toEqual(['b1', 'b2']);
    expect(getDesk(data, 'app-2')).toEqual(createEmptyDesk(getDesk(data, 'app-2').updatedAt));
  });

  it('fills every field of a desk from nothing', () => {
    const desk = normalizeDesk(undefined, 5);
    expect(desk).toEqual(createEmptyDesk(5));
    expect(stationsWithContent(desk)).toEqual({
      qualifications: false,
      bullets: false,
      resume: false,
      letter: false,
      'before-you-send': false,
      pay: false,
    });
  });
});

describe('pure updates', () => {
  it('does not mutate the data it is given', () => {
    const data = createDefaultDeskData();
    const frozen = JSON.stringify(data);
    setQualification(data, 'a', 'r', { status: 'have' });
    addActionStep(data, 'a', { text: 'Step' });
    updateOfferWorksheet(data, 'a', { basePay: 20 });
    expect(JSON.stringify(data)).toBe(frozen);
  });

  it('edits qualification rows in place and removes dismissed ones', () => {
    let data = setQualification(createDefaultDeskData(), 'a', 'r1', { status: 'not-yet' });
    data = setQualification(data, 'a', 'r1', { plan: 'Take the free SQL course' });
    data = setQualification(data, 'a', 'r2', { status: 'maybe' });
    expect(
      getDesk(data, 'a').qualifications.map((r) => [r.requirementId, r.status, r.plan])
    ).toEqual([
      ['r1', 'not-yet', 'Take the free SQL course'],
      ['r2', 'maybe', ''],
    ]);
    data = removeQualification(data, 'a', 'r1');
    expect(getDesk(data, 'a').qualifications.map((r) => r.requirementId)).toEqual(['r2']);
  });

  it('adds, edits, completes, and removes action steps', () => {
    const first = addActionStep(createDefaultDeskData(), 'a', {
      text: '  Email the club advisor  ',
      due: '2026-12-05',
    });
    expect(first.step).toMatchObject({ text: 'Email the club advisor', due: '2026-12-05' });
    expect(addActionStep(first.data, 'a', { text: '   ' }).step).toBeNull();
    const id = first.step?.id ?? '';
    let data = updateActionStep(first.data, 'a', id, { due: 'whenever', done: true });
    expect(getDesk(data, 'a').actionPlan[0]).toMatchObject({ due: null, done: true });
    data = updateActionStep(data, 'a', id, { text: '' });
    expect(getDesk(data, 'a').actionPlan[0].text).toBe('Email the club advisor');
    expect(updateActionStep(data, 'a', 'missing', { done: false })).toBe(data);
    data = removeActionStep(data, 'a', id);
    expect(getDesk(data, 'a').actionPlan).toEqual([]);
  });

  it('keeps the bullets flow at exactly two bullets', () => {
    let data = updateBulletsFlow(createDefaultDeskData(), 'a', {
      experience: 'Chemistry lab partner',
      bullet: { index: 1, slot: { text: 'Calibrated pH meters for 30 lab sections' } },
    });
    data = updateBulletsFlow(data, 'a', { bullet: { index: 1, slot: { bulletId: 'master-7' } } });
    data = updateBulletsFlow(data, 'a', { impact: 'Fewer failed labs', reflection: 'Fits QA' });
    const flow = getDesk(data, 'a').bullets;
    expect(flow.bullets).toEqual([
      { bulletId: null, text: '', included: true },
      { bulletId: 'master-7', text: 'Calibrated pH meters for 30 lab sections', included: true },
    ]);
    expect(flow).toMatchObject({
      experience: 'Chemistry lab partner',
      impact: 'Fewer failed labs',
      reflection: 'Fits QA',
    });
  });

  it('saves message variants with their source, and clears one with empty text', () => {
    let data = saveMessageVariant(createDefaultDeskData(), 'a', 'linkedin', {
      text: 'Hi, I saw the lab assistant posting.',
      source: 'rules',
    });
    data = saveMessageVariant(data, 'a', 'follow-up-email', {
      text: 'Thank you for the call.',
      source: 'browser-model',
    });
    const messages = getDesk(data, 'a').letter.messages;
    expect(messages.linkedin).toMatchObject({ source: 'rules' });
    expect(messages['follow-up-email']).toMatchObject({ source: 'browser-model' });
    data = saveMessageVariant(data, 'a', 'linkedin', { text: '  ', source: 'student' });
    expect(getDesk(data, 'a').letter.messages.linkedin).toBeNull();
  });

  it('ticks checklist items, chooses resume bullets, and fills the worksheet', () => {
    let data = setChecklistTick(createDefaultDeskData(), 'a', 'someone-read-it', true);
    expect(setChecklistTick(data, 'a', '__proto__', true)).toBe(data);
    data = setResumeSelection(data, 'a', ['b1', 'b2', 'b1']);
    expect(getDesk(data, 'a').resumeSelection?.bulletIds).toEqual(['b1', 'b2']);
    data = updateOfferWorksheet(data, 'a', {
      basePay: 22,
      payPeriod: 'hour',
      hoursPerWeek: Number.NaN,
      wageSource: 'BLS OEWS May 2025, Lab technicians, national',
      wageSourceDate: '2026-11-12',
    });
    expect(getDesk(data, 'a').offer).toMatchObject({
      basePay: 22,
      payPeriod: 'hour',
      hoursPerWeek: null,
      wageSourceDate: '2026-11-12',
    });
    expect(getDesk(data, 'a').checklist).toEqual({ 'someone-read-it': true });
    data = setResumeSelection(data, 'a', null);
    expect(getDesk(data, 'a').resumeSelection).toBeNull();
  });

  it('removes and prunes desks', () => {
    let data = setChecklistTick(createDefaultDeskData(), 'a', 'x', true);
    data = setChecklistTick(data, 'b', 'x', true);
    expect(Object.keys(pruneDesks(data, ['b']).desks)).toEqual(['b']);
    expect(Object.keys(removeDesk(data, 'a').desks)).toEqual(['b']);
    expect(removeDesk(data, 'missing')).toBe(data);
  });
});

describe('removing an application', () => {
  it('drops its desk and leaves career-applications thin', () => {
    const one = addApplication(createDefaultApplications(), { title: 'Lab Assistant' });
    const two = addApplication(one.data, { title: 'Camp Counselor' });
    saveApplications(two.data);
    let desks = setQualification(createDefaultDeskData(), one.application.id, 'r', {
      status: 'have',
    });
    desks = setChecklistTick(desks, two.application.id, 'someone-read-it', true);
    saveApplicationDesks(desks);

    const stored = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) ?? '{}');
    expect(Object.keys(stored.applications[0]).sort()).toEqual(
      ['company', 'createdAt', 'deadline', 'id', 'roleId', 'sentOn', 'title', 'updatedAt'].sort()
    );

    deleteApplication(one.application.id);
    expect(loadApplications().applications.map((a) => a.title)).toEqual(['Camp Counselor']);
    expect(Object.keys(loadApplicationDesks().desks)).toEqual([two.application.id]);
  });

  it('still removes the application when it has no desk', () => {
    const { data, application } = addApplication(createDefaultApplications(), { title: 'Intern' });
    saveApplications(data);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    deleteApplication(application.id);
    expect(loadApplications().applications).toEqual([]);
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([APPLICATIONS_KEY]);
  });
});

describe('dashboard readers', () => {
  it('lists open dated steps across applications, soonest first', () => {
    let data = createDefaultDeskData();
    data = addActionStep(data, 'a', { text: 'Later', due: '2026-12-20' }).data;
    data = addActionStep(data, 'a', { text: 'Undated' }).data;
    const done = addActionStep(data, 'b', { text: 'Done already', due: '2026-12-01' });
    data = updateActionStep(done.data, 'b', done.step?.id ?? '', { done: true });
    data = addActionStep(data, 'b', { text: 'Soonest', due: '2026-12-02' }).data;
    data = addActionStep(data, 'gone', { text: 'Orphan', due: '2026-11-13' }).data;

    const now = new Date(2026, 10, 30);
    const steps = datedActionSteps(data, ['a', 'b'], { now });
    expect(steps.map((s) => [s.applicationId, s.text, s.daysUntil])).toEqual([
      ['b', 'Soonest', 2],
      ['a', 'Later', 20],
    ]);
    expect(
      datedActionSteps(data, ['a', 'b'], { now, includeDone: true }).map((s) => s.text)
    ).toEqual(['Done already', 'Soonest', 'Later']);
  });

  it('reports which stations hold content per application', () => {
    let data = setQualification(createDefaultDeskData(), 'a', 'r', {});
    expect(stationsByApplication(data, ['a']).a.qualifications).toBe(false);
    data = setQualification(data, 'a', 'r', { status: 'maybe' });
    data = updateOfferWorksheet(data, 'a', { notes: 'Asked about a start date' });
    data = setChecklistTick(data, 'a', 'someone-read-it', false);
    const byApp = stationsByApplication(data, ['a', 'new']);
    expect(byApp.a).toEqual({
      qualifications: true,
      bullets: false,
      resume: false,
      letter: false,
      'before-you-send': false,
      pay: true,
    });
    expect(Object.values(byApp.new).some(Boolean)).toBe(false);
  });

  it('surfaces dated steps and stations through the dashboard bridge', () => {
    const { data: apps, application } = addApplication(createDefaultApplications(), {
      title: 'Lab Assistant',
      company: 'County Water Lab',
    });
    saveApplications(apps);
    let desks = addActionStep(createDefaultDeskData(), application.id, {
      text: 'Ask for a reference',
      due: isoDaysFromNow(3),
    }).data;
    desks = addActionStep(desks, 'removed-app', { text: 'Orphan', due: isoDaysFromNow(1) }).data;
    saveApplicationDesks(desks);

    const dashboard = readCareerDashboard();
    expect(dashboard.actionSteps).toEqual([
      expect.objectContaining({
        applicationId: application.id,
        applicationTitle: 'Lab Assistant',
        company: 'County Water Lab',
        text: 'Ask for a reference',
        daysUntil: 3,
        done: false,
      }),
    ]);
    expect(dashboard.applications[0].stations.qualifications).toBe(true);
    expect(dashboard.applications[0].stations.letter).toBe(false);
  });
});

describe('pay normalization', () => {
  it('converts an hourly rate only with the hours and weeks given', () => {
    expect(hourlyEquivalent(20, 'hour', null, null)).toBe(20);
    expect(annualEquivalent(20, 'hour', 15, 10)).toBe(3000);
    expect(annualEquivalent(20, 'hour', 15, null)).toBeNull();
    expect(annualEquivalent(20, 'hour', null, 52)).toBeNull();
  });

  it('converts a yearly salary to hourly only with hours and weeks', () => {
    expect(annualEquivalent(52_000, 'year', null, null)).toBe(52_000);
    expect(hourlyEquivalent(52_000, 'year', 40, 52)).toBe(25);
    expect(hourlyEquivalent(52_000, 'year', 40, null)).toBeNull();
    expect(hourlyEquivalent(52_000, 'year', null, 52)).toBeNull();
  });

  it('converts weekly and monthly figures', () => {
    expect(hourlyEquivalent(600, 'week', 30, null)).toBe(20);
    expect(annualEquivalent(600, 'week', null, 12)).toBe(7200);
    expect(hourlyEquivalent(3000, 'month', 40, null)).toBeCloseTo((3000 * 12) / 52 / 40);
    expect(annualEquivalent(3000, 'month', null, 52)).toBeCloseTo(36_000);
    expect(annualEquivalent(3000, 'month', null, 12)).toBeCloseTo((3000 * 12 * 12) / 52);
  });

  it('returns null for missing or unusable inputs', () => {
    expect(hourlyEquivalent(null, 'hour', 40, 52)).toBeNull();
    expect(hourlyEquivalent(20, null, 40, 52)).toBeNull();
    expect(annualEquivalent(-5, 'year', 40, 52)).toBeNull();
    expect(hourlyEquivalent(600, 'week', 0, 52)).toBeNull();
  });

  it('summarizes an offer and names what is still missing', () => {
    const offer = {
      ...createEmptyDesk().offer,
      basePay: 20,
      payPeriod: 'hour' as const,
      hoursPerWeek: 40,
      guaranteedBonus: 1000,
      variablePay: 500,
    };
    expect(offerEquivalents(offer)).toEqual({
      hourly: 20,
      weekly: 800,
      annualBase: null,
      overtimeAnnual: 0,
      annualGuaranteed: null,
      annualWithVariable: null,
      missing: ['weeksPerYear'],
    });
    expect(offerEquivalents({ ...offer, weeksPerYear: 50 })).toEqual({
      hourly: 20,
      weekly: 800,
      annualBase: 40_000,
      overtimeAnnual: 0,
      annualGuaranteed: 41_000,
      annualWithVariable: 41_500,
      missing: [],
    });
    expect(offerEquivalents(createEmptyDesk().offer).missing).toEqual([
      'basePay',
      'payPeriod',
      'hoursPerWeek',
      'weeksPerYear',
    ]);
  });
});
