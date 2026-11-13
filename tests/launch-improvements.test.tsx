/**
 * The launch improvements from the user-story reviews (student S, changer C,
 * advisor A, access X). Each block names the item it covers.
 */
import 'fake-indexeddb/auto';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationsPanel from '../src/components/ApplicationsPanel';
import ApplicationDesk from '../src/components/application-desk/ApplicationDesk';
import { useDeskExamples } from '../src/components/application-desk/examples';
import { defaultPlacement } from '../src/components/application-desk/ResumeStation';
import BackupControls from '../src/components/BackupControls';
import CareerDashboard from '../src/components/CareerDashboard';
import OnboardingWizard from '../src/components/OnboardingWizard';
import PayTool from '../src/components/pay/PayTool';
import StoragePanel from '../src/components/StoragePanel';
import {
  APPLICATION_DESK_KEY,
  createEmptyDesk,
  loadApplicationDesks,
  normalizeDesk,
  offerEquivalents,
  periodPhrase,
} from '../src/lib/application-desk';
import {
  APPLICATIONS_KEY,
  type ApplicationsData,
  activeApplicationId,
  applicationStatus,
  loadApplications,
  localDate,
  markSent,
  shortDate,
} from '../src/lib/applications';
import { addedWords, draftBullet, draftFields } from '../src/lib/bullet-draft';
import { readCareerDashboard } from '../src/lib/career-bridge';
import {
  asks,
  describeStanding,
  deskRequirements,
  runSendChecks,
  SEND_CHECK_IDS,
  standing,
  whyYouDraft,
  wornPhrases,
} from '../src/lib/desk-checks';
import { createDefaultData, createRole, STORAGE_KEY as GLOW_KEY } from '../src/lib/glowup-store';
import { applicationGuide } from '../src/lib/guides/application';
import { payGuide } from '../src/lib/guides/pay';
import { letterParagraphsXml } from '../src/lib/letter-docx';
import { messageVariantsRules } from '../src/lib/local-ai/rules';
import { closeLocalDb } from '../src/lib/local-db';
import { parseAmount } from '../src/lib/pay-input';
import {
  addRequirement,
  bulletsFromRequirements,
  type PostingRequirement,
} from '../src/lib/posting';
import { PROFILE_STORAGE_KEY, readProfile, writeProfile } from '../src/lib/profile';
import { fromText } from '../src/lib/resume-doc';
import { parseBackup } from '../src/lib/studio-backup';

const CONDITION = "Must be at least 18 and have a valid driver's license";
const EXCEL = 'Experience with Excel or Google Sheets';
const ENROLLED = 'Currently enrolled in a college or community college program';
const SERVICE = 'Customer service experience';

/** Confirmed requirements, as the posting station leaves them. */
function confirmed(lines: string[]): PostingRequirement[] {
  return lines.reduce<PostingRequirement[]>((list, line) => addRequirement(list, line), []);
}

type Seed = {
  id: string;
  title: string;
  company?: string;
  lines?: string[];
  deadline?: string | null;
  sentOn?: string | null;
};

/** Applications, each with a decoded role made of `lines` when given. */
function seed(apps: Seed[], activeId: string | null = apps[0]?.id ?? null) {
  let glow = createDefaultData();
  const roles: Record<string, { id: string; requirements: PostingRequirement[] }> = {};
  for (const app of apps) {
    if (!app.lines) continue;
    const requirements = confirmed(app.lines);
    glow = createRole(glow, {
      jobTitle: app.title,
      company: app.company ?? '',
      rawJdText: app.lines.join('\n'),
      parsedJdText: app.lines.join('\n'),
      bullets: bulletsFromRequirements(requirements),
    });
    roles[app.id] = { id: glow.currentRoleId as string, requirements };
  }
  const data: ApplicationsData = {
    version: 1,
    activeId,
    applications: apps.map((app) => ({
      id: app.id,
      title: app.title,
      company: app.company ?? '',
      deadline: app.deadline ?? null,
      roleId: roles[app.id]?.id ?? null,
      sentOn: app.sentOn ?? null,
      createdAt: 1,
      updatedAt: 1,
    })),
  };
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(data));
  localStorage.setItem(GLOW_KEY, JSON.stringify(glow));
  return roles;
}

function saveDesk(id: string, desk: unknown) {
  localStorage.setItem(
    APPLICATION_DESK_KEY,
    JSON.stringify({ version: 1, desks: { [id]: normalizeDesk(desk, 1) } })
  );
}

function saveResume(text: string) {
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({ resumeText: text, bullets: [], lastAnalyzedAt: null })
  );
}

const openAt = (path: string) => window.history.replaceState(null, '', path);

const RESUME = `Maya Torres
maya@example.edu

Summary
Second-year student who likes busy front counters

Skills
- Excel
- Spanish

Experience
FreshWay Market, Cashier, 2025 to present
- Handled cash and card payments at a busy register
- Tracked weekly inventory counts in Excel
Lakeshore Library, Shelving Assistant, 2024
- Shelved returns for the children's section

Education
Lakeshore Community College, expected May 2027`;

beforeEach(() => {
  localStorage.clear();
  openAt('/');
});
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  await closeLocalDb();
});

describe('1. one condition filter on the desk (S F2)', () => {
  it('leaves conditions out of the letter count', () => {
    const checks = runSendChecks({
      letter: {
        ...createEmptyDesk().letter,
        hook: 'At FreshWay I kept weekly counts in Excel.',
        whyYou: "I am over 18 and have a valid driver's license.",
      },
      title: 'Operations Intern',
      company: 'Cedar Valley',
      requirements: confirmed([CONDITION, EXCEL]),
    });
    const words = checks.find((check) => check.id === 'posting-words');
    expect(words?.detail).toBe('Touches 1 of 1 confirmed requirements.');
  });

  it('splits a posting into what a resume can show and the conditions', () => {
    const roles = seed([{ id: 'a', title: 'Intern', lines: [CONDITION, EXCEL] }]);
    const bullets = bulletsFromRequirements(roles.a.requirements);
    const split = deskRequirements(bullets);
    expect(split.requirements.map((r) => r.text)).toEqual([EXCEL]);
    expect(split.conditions.map((r) => r.text)).toEqual([CONDITION]);
  });

  it('never makes a condition the target of a bullet', () => {
    const roles = seed([{ id: 'a', title: 'Intern', lines: [CONDITION, EXCEL] }]);
    const condition = roles.a.requirements.find((r) => r.text === CONDITION);
    openAt(`/application/?id=a&station=bullets&requirement=${condition?.id}`);
    render(<ApplicationDesk />);
    expect(screen.queryByText('Write a bullet that shows this')).toBeNull();
    expect(screen.getByText(/is a condition of the job/)).toBeInTheDocument();
  });

  it('does not tag a resume bullet as answering a condition', async () => {
    seed([{ id: 'a', title: 'Intern', lines: [CONDITION, EXCEL] }]);
    saveResume(
      `${RESUME}\nCity Deliveries, Driver, 2023\n- Drove the delivery van with a valid driver's license`
    );
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    const count = await screen.findByTestId('resume-selection-count');
    // The Excel bullet; never the driving line, and never the skills list,
    // whose lines are not things done.
    expect(count).toHaveTextContent('1 mention a confirmed requirement');
    expect(screen.getAllByText(`Answers: ${EXCEL}`)).toHaveLength(1);
    expect(screen.queryByText(`Answers: ${CONDITION}`)).toBeNull();
  });

  it('does not offer a condition as letter material', () => {
    const requirements = confirmed([CONDITION, EXCEL]);
    const rows = requirements.map((r) => ({
      requirementId: r.id,
      status: 'have' as const,
      plan: '',
      updatedAt: 1,
    }));
    expect(whyYouDraft(requirements, rows)).toEqual([`${EXCEL}: [your proof]`]);
  });
});

describe('2. desk bullets go into the tailored resume (S F5, C 2)', () => {
  it('places them after the last bullet of the most recent job, never under skills', () => {
    const doc = fromText(RESUME);
    const bullets = doc.lines.filter((line) => line.bullet).map((line) => line.id);
    const after = defaultPlacement(doc, bullets);
    const line = doc.lines.find((l) => l.id === after);
    expect(line?.text).toContain('Tracked weekly inventory counts in Excel');
  });

  it('includes a bullet written on a new desk by default and says so', async () => {
    seed([{ id: 'a', title: 'Intern', lines: [EXCEL] }]);
    saveResume(RESUME);
    const desk = createEmptyDesk(1);
    desk.bullets.bullets[0].text = 'Balanced my register drawer at the end of every shift';
    saveDesk('a', desk);
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    const checkbox = await screen.findByRole('checkbox', {
      name: /Balanced my register drawer/,
    });
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/This bullet is in the copy for this role/)).toBeInTheDocument();
    expect(screen.getByTestId('resume-selection-count')).toHaveTextContent(
      'plus 1 written on this desk'
    );
    const place = screen.getByRole('combobox', { name: /Place it after/ }) as HTMLSelectElement;
    expect(place.selectedOptions[0].textContent).toContain('Tracked weekly inventory');
    // Unticking is kept.
    fireEvent.click(checkbox);
    expect(loadApplicationDesks().desks.a.bullets.bullets[0].included).toBe(false);
  });

  it('keeps what an old desk chose', () => {
    const old = normalizeDesk({
      bullets: {
        bullets: [
          { bulletId: null, text: 'Left out on purpose' },
          { bulletId: 'text:9', text: 'Placed by hand' },
        ],
      },
    });
    expect(old.bullets.bullets.map((slot) => slot.included)).toEqual([false, true]);
  });
});

describe('3. the letter uses what the visitor wrote (S F8, C 12)', () => {
  it('fills each "have it" line with its proof, skipping enrolment', () => {
    const requirements = confirmed([ENROLLED, SERVICE, EXCEL]);
    const plan = new Map([
      [SERVICE, 'Cashier at FreshWay Market since 2025, I help customers every shift'],
    ]);
    const rows = requirements.map((r) => ({
      requirementId: r.id,
      status: 'have' as const,
      plan: plan.get(r.text) ?? '',
      updatedAt: 1,
    }));
    expect(whyYouDraft(requirements, rows)).toEqual([
      'Cashier at FreshWay Market since 2025, I help customers every shift.',
      `${EXCEL}: [your proof]`,
    ]);
  });

  it('shows the whole letter, greeting to sign-off, read only', () => {
    seed([{ id: 'a', title: 'Operations Intern', company: 'Cedar Valley', lines: [EXCEL] }]);
    const desk = createEmptyDesk(1);
    desk.letter = {
      ...desk.letter,
      hook: 'I kept the weekly counts at FreshWay.',
      closingAsk: 'Could we talk next week?',
      sender: 'Maya Torres',
    };
    saveDesk('a', desk);
    openAt('/application/?id=a&station=letter');
    render(<ApplicationDesk />);
    const preview = screen.getByTestId('letter-preview');
    expect(preview).toHaveTextContent('Dear Hiring Team,');
    expect(preview).toHaveTextContent('I kept the weekly counts at FreshWay.');
    expect(preview).toHaveTextContent('Sincerely, Maya Torres');
    expect(screen.getByRole('button', { name: 'Copy the letter' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download as .docx' })).toBeEnabled();
  });

  it('writes the Word letter as real paragraphs', () => {
    const xml = letterParagraphsXml('Dear Ms. Rivera,\n\nI ran the counts.\n\nSincerely,\nMaya');
    expect(xml.match(/<w:p>/g)).toHaveLength(3);
    expect(xml).toContain('Sincerely,</w:t><w:br/><w:t xml:space="preserve">Maya');
  });

  it('does not name the role and company twice when the hook already does (S F8)', () => {
    const hook =
      'When my manager asked me to train two new cashiers, they ran their own registers within a week, and I would like to bring that to the Summer Operations Intern role at Cedar Valley Parks & Recreation.';
    const out = messageVariantsRules({
      opener: hook,
      role: 'Summer Operations Intern',
      company: 'Cedar Valley Parks & Recreation',
    });
    const count = (text: string) => text.split('Summer Operations Intern').length - 1;
    expect(count(out.followUpEmail.body)).toBe(1);
    expect(count(out.introCallOpener)).toBe(1);
    expect(count(out.linkedInMessage)).toBe(1);
    expect(out.followUpEmail.body).toContain('I recently applied and wanted to follow up. When');
  });

  it('opens with "Hello," when there is no person to greet', () => {
    for (const contactName of [undefined, 'Hiring Team']) {
      const out = messageVariantsRules({
        opener: 'I ran the club sign-up table.',
        role: 'Intern',
        company: 'Northwind',
        contactName,
      });
      expect(out.linkedInMessage.startsWith('Hello,')).toBe(true);
      expect(out.linkedInMessage).not.toContain('Hiring Team');
    }
  });
});

describe('4. Before you send, more honest (C 6, A A12)', () => {
  it('reads a closing that asks for a conversation as an ask, but not a bare question', () => {
    expect(asks('I would welcome a conversation about the rollout.')).toBe(true);
    expect(asks('I am available to talk at your convenience.')).toBe(true);
    expect(asks('I welcome a call about the role.')).toBe(true);
    expect(asks('Feel free to reach out to talk about the schedule.')).toBe(true);
    expect(asks('Why is the sky blue?')).toBe(false);
    expect(asks('Thank you for considering my application.')).toBe(false);
  });

  it('names worn phrases in the letter body, quoted, without a score', () => {
    const letter = {
      ...createEmptyDesk().letter,
      whyYou:
        'I am Passionate about helping people. I am a hard worker and a team player who can think outside the box.',
    };
    expect(wornPhrases(letter)).toEqual([
      'Passionate about',
      'hard worker',
      'team player',
      'think outside the box',
    ]);
    const checks = runSendChecks({ letter, title: 'x', company: 'y', requirements: [] });
    expect(checks.map((check) => check.id)).toEqual([...SEND_CHECK_IDS]);
  });

  it('states the real number of computed checks in the guide and on the page', () => {
    const step = applicationGuide.steps.find((s) => s.id === 'check');
    expect(step?.body).toContain('Five checks are computed');
    expect(SEND_CHECK_IDS).toHaveLength(5);
    seed([{ id: 'a', title: 'Intern', lines: [EXCEL] }]);
    const desk = createEmptyDesk(1);
    desk.letter.whyYou = 'I am a fast learner.';
    saveDesk('a', desk);
    openAt('/application/?id=a&station=send');
    render(<ApplicationDesk />);
    expect(
      screen.getByText(/The first five are checked against what you wrote\. The last two/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('worn-phrases')).toHaveTextContent('"fast learner"');
  });
});

describe('5. the Bullets station drafts from the visitor’s words (S F12)', () => {
  it('assembles a draft only from what was written', () => {
    const experience = 'I trained two new cashiers on the register.';
    const impact = 'Because of that, they ran their own registers within a week.';
    const fields = draftFields(experience, impact);
    expect(fields).toEqual({
      verb: 'Trained',
      task: 'two new cashiers on the register',
      result: 'they ran their own registers within a week',
    });
    const draft = draftBullet(fields);
    expect(draft).toBe(
      'Trained two new cashiers on the register, so they ran their own registers within a week.'
    );
    expect(addedWords(draft, experience, impact)).toEqual([]);
  });

  it('leaves the verb empty when none was written, instead of inventing one', () => {
    expect(draftFields('Cashier at FreshWay Market since 2025', '').verb).toBe('');
  });

  it('offers the draft in labelled fields and puts it in a bullet box', () => {
    seed([{ id: 'a', title: 'Intern', lines: [EXCEL] }]);
    const desk = createEmptyDesk(1);
    desk.bullets.experience = 'I counted the drawer at the end of every shift.';
    desk.bullets.impact = 'my drawer balanced every shift';
    saveDesk('a', desk);
    openAt('/application/?id=a&station=bullets');
    render(<ApplicationDesk />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft a bullet from what I wrote' }));
    expect(screen.getByLabelText('Verb')).toHaveValue('Counted');
    expect(screen.getByLabelText('What happened')).toHaveValue('my drawer balanced every shift');
    fireEvent.click(screen.getByRole('button', { name: 'Use it as bullet 1' }));
    expect(loadApplicationDesks().desks.a.bullets.bullets[0].text).toBe(
      'Counted the drawer at the end of every shift, so my drawer balanced every shift.'
    );
  });

  it('gives the two bullet boxes different, student-scale placeholders', () => {
    const { result } = renderHook(() => useDeskExamples());
    const [one, two] = result.current.bulletPlaceholders;
    expect(one).not.toBe(two);
    expect(`${one} ${two}`).not.toMatch(/followers|2,100/);
  });
});

describe('6. an application can be marked as sent (S F10)', () => {
  it('records the date, undoes it, and derives the other states', () => {
    seed([{ id: 'a', title: 'Intern' }]);
    let data = loadApplications();
    expect(data.applications[0].sentOn).toBeNull();
    data = markSent(data, 'a', '2026-11-12');
    expect(data.applications[0].sentOn).toBe('2026-11-12');
    expect(applicationStatus(data.applications[0], true)).toBe('sent');
    data = markSent(data, 'a', null);
    expect(applicationStatus(data.applications[0], true)).toBe('in-progress');
    expect(applicationStatus(data.applications[0], false)).toBe('not-started');
    expect(markSent(data, 'a', 'not a date').applications[0].sentOn).toBeNull();
  });

  it('is accepted by backup validation and dropped when malformed', () => {
    const backup = (sentOn: unknown) =>
      JSON.stringify({
        format: '5whys-career-studio',
        version: 2,
        exportedAt: '2026-11-13T05:00:00Z',
        stores: {
          'career-applications': {
            version: 1,
            activeId: null,
            applications: [{ id: 'a', title: 'Intern', company: '', sentOn }],
          },
        },
      });
    expect(() => parseBackup(backup('2026-11-12'))).not.toThrow();
    expect(() => parseBackup(backup(12))).toThrow();
    localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({ applications: [{ id: 'a', title: 'Intern', sentOn: '2026-13-45' }] })
    );
    expect(loadApplications().applications[0].sentOn).toBeNull();
  });

  it('is never called past its deadline or overdue on the dashboard', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 10));
    seed([
      { id: 'a', title: 'Summer Operations Intern', deadline: '2026-11-18', sentOn: '2026-11-16' },
    ]);
    const desk = createEmptyDesk(1);
    desk.actionPlan = [
      {
        id: 's',
        text: 'Ask Ms. Lee for a reference',
        due: '2026-11-15',
        done: false,
        createdAt: 1,
      },
    ];
    saveDesk('a', desk);
    // The whole loop, so the headline line is drawn.
    const data = readCareerDashboard();
    expect(JSON.stringify(data)).not.toMatch(/past its deadline|deadline has passed|overdue/);
    expect(data.actionSteps).toEqual([]);
    expect(data.recommendations[0].text).toContain('was sent on Nov 16');
    render(
      <ApplicationsPanel
        applications={data.applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={() => {}}
      />
    );
    expect(screen.getByText('Sent Nov 16')).toBeInTheDocument();
    expect(screen.queryByText(/days past/)).toBeNull();
    expect(screen.getByRole('link', { name: 'the thank-you note' })).toHaveAttribute(
      'href',
      '/application/?id=a&station=send#after-interview'
    );
  });

  it('can be marked sent and undone from Before you send', () => {
    seed([{ id: 'a', title: 'Intern', lines: [EXCEL] }]);
    openAt('/application/?id=a&station=send');
    render(<ApplicationDesk />);
    const send = screen.getByRole('region', { name: 'Sent it?' });
    fireEvent.click(within(send).getByRole('button', { name: /Mark as sent/ }));
    expect(loadApplications().applications[0].sentOn).toBe(localDate());
    fireEvent.click(within(send).getByRole('button', { name: /Not sent yet/ }));
    expect(loadApplications().applications[0].sentOn).toBeNull();
  });
});

describe('7. Pay tells the truth about the period (S F4, C 7, C 8, A A10, A A13, X A6)', () => {
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('names a 10-week total by its weeks and shows the weekly figure', () => {
    const offer = {
      ...createEmptyDesk().offer,
      basePay: 17,
      payPeriod: 'hour' as const,
      hoursPerWeek: 25,
      weeksPerYear: 10,
    };
    expect(periodPhrase(offer)).toBe('over 10 weeks');
    expect(periodPhrase({ ...offer, weeksPerYear: 52 })).toBe('a year');
    expect(periodPhrase({ ...offer, payPeriod: 'year' })).toBe('a year');
    expect(offerEquivalents(offer)).toMatchObject({ weekly: 425, annualBase: 4250 });
  });

  it('keeps overtime out of the base', () => {
    const figures = offerEquivalents({
      ...createEmptyDesk().offer,
      basePay: 27.5,
      payPeriod: 'hour',
      hoursPerWeek: 40,
      weeksPerYear: 52,
      overtimeHoursPerWeek: 6,
    });
    expect(figures.annualBase).toBe(57200);
    expect(figures.overtimeAnnual).toBe(12870);
    expect(figures.annualGuaranteed).toBe(57200);
    expect(figures.annualWithVariable).toBe(70070);
  });

  it('reads other currencies and asks about "62.000"', () => {
    expect(parseAmount('€62,000')).toEqual({ ok: true, value: 62000, currency: '€' });
    expect(parseAmount('£30k')).toMatchObject({ value: 30000, currency: '£' });
    expect(parseAmount('₹5,00,000')).toMatchObject({ value: 500000, currency: '₹' });
    const ambiguous = parseAmount('62.000');
    expect(ambiguous.ok).toBe(false);
    expect(!ambiguous.ok && ambiguous.error).toBe(
      'Did you mean 62,000 or 62? Write 62000 for the first, or 62 for the second.'
    );
  });

  it('shows the worksheet in plain terms, hides empty rows, and notes overtime', async () => {
    seed([{ id: 'a', title: 'Summer Operations Intern' }]);
    render(<PayTool />);
    // "Save with" starts on the active application.
    expect(screen.getByRole('combobox', { name: 'Save with' })).toHaveValue('a');
    fill('Base pay', '17');
    fireEvent.change(screen.getByRole('combobox', { name: 'Paid' }), {
      target: { value: 'hour' },
    });
    fill('Hours a week', '25');
    fill('Weeks a year', '10');
    const results = document.querySelector('[data-guide="offer-results"]') as HTMLElement;
    expect(results).toHaveTextContent('$425 a week');
    expect(results).toHaveTextContent('$4,250 over 10 weeks');
    expect(results).not.toHaveTextContent('a year');
    expect(results).not.toHaveTextContent('With the guaranteed bonus');
    expect(results).not.toHaveTextContent('If the variable pay comes through');
    expect(results).toHaveTextContent('before taxes');
    expect(screen.queryByTestId('overtime-hint')).toBeNull();
    fill('Hours a week', '45');
    expect(screen.getByTestId('overtime-hint')).toHaveTextContent('time and a half');
    // Read out once typing pauses.
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('status')
            .some((node) => /Works out to \$17\.00 an hour/.test(node.textContent ?? ''))
        ).toBe(true),
      { timeout: 3000 }
    );
  });

  it('shows results in the currency typed', () => {
    seed([{ id: 'a', title: 'Intern' }]);
    render(<PayTool />);
    fill('Base pay', '€30,000');
    fireEvent.change(screen.getByRole('combobox', { name: 'Paid' }), {
      target: { value: 'year' },
    });
    fill('Hours a week', '40');
    fill('Weeks a year', '52');
    const results = document.querySelector('[data-guide="offer-results"]') as HTMLElement;
    expect(results).toHaveTextContent('€30,000 a year');
    expect(loadApplicationDesks().desks.a.offer.currency).toBe('€');
  });

  it('adds another offer to compare, with hours in the table', () => {
    seed([{ id: 'a', title: 'Cashier' }]);
    const desk = createEmptyDesk(1);
    desk.offer = {
      ...desk.offer,
      basePay: 17,
      payPeriod: 'hour',
      hoursPerWeek: 25,
      weeksPerYear: 10,
    };
    saveDesk('a', desk);
    render(<PayTool />);
    fireEvent.click(screen.getByRole('button', { name: 'Add another offer' }));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Camp counselor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));
    expect(loadApplications().applications.map((a) => a.title)).toEqual([
      'Cashier',
      'Camp counselor',
    ]);
    fill('Base pay', '15');
    fireEvent.change(screen.getByRole('combobox', { name: 'Paid' }), {
      target: { value: 'hour' },
    });
    fill('Hours a week', '30');
    fill('Weeks a year', '8');
    const table = screen.getByTestId('offer-compare');
    expect(within(table).getByRole('columnheader', { name: 'Hours a week' })).toBeInTheDocument();
    expect(table).toHaveTextContent('$4,250 over 10 weeks');
    expect(table).toHaveTextContent('$3,600 over 8 weeks');
  });

  it('starts the guide at the worksheet while no wage data is built in', () => {
    expect(payGuide.steps[0].id).toBe('base');
    expect(payGuide.steps.map((s) => s.id)).not.toContain('title');
  });
});

describe('8. the career review (S F17, A C1, X tremor)', () => {
  it('offers a first-job stage and a start-from-nothing answer', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'High school or first job' }));
    fireEvent.click(screen.getByRole('button', { name: 'I do not have much to show yet' }));
    expect(screen.getByRole('link', { name: /Start now/ })).toHaveAttribute(
      'href',
      '/resume-game/?start=blank'
    );
    expect(readProfile()).toMatchObject({ stage: 'student', focus: 'starting', firstJob: true });
    expect(screen.getByText('High school or first job · Not much to show yet')).toBeInTheDocument();
  });

  it('uses the primary button, one icon, plain words and the site’s names', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Student' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interview prep' }));
    const start = screen.getByRole('link', { name: /Start now/ });
    expect(start).toHaveAttribute('data-slot', 'button');
    expect(start).toHaveAttribute('data-variant', 'default');
    const page = document.body.textContent ?? '';
    expect(page).not.toMatch(
      /JD decode|panic-proof|Panic-proof|Networking Rehearsal|Rehearse pitch/
    );
    const icons = [...document.querySelectorAll('[data-slot="card"] svg')].filter(
      (svg) => !svg.closest('[data-slot="button"]')
    );
    expect(icons).toHaveLength(1);
    const heading = screen.getByRole('heading', { name: 'Here is your starting point' });
    expect(heading.className).toContain('focus-visible:outline-2');
    expect(heading.className).not.toMatch(/(^|\s)focus:outline-2/);
  });

  it('ignores the second tap of a double tap on the next question', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Student' }), { detail: 1 });
    now += 150;
    fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }), { detail: 1 });
    expect(
      screen.getByRole('heading', { name: 'What is your biggest challenge right now?' })
    ).toBeInTheDocument();
    now += 400;
    fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }), { detail: 1 });
    expect(
      screen.getByRole('heading', { name: 'Here is your starting point' })
    ).toBeInTheDocument();
  });

  it('asks before starting over', () => {
    writeProfile('student', 'direction');
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('heading', { name: /starting point/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear both answers' }));
    expect(
      screen.getByRole('heading', { name: 'Where are you in your career?' })
    ).toBeInTheDocument();
  });

  it('keeps the profile shape every tool reads', () => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ stage: 'mid', focus: 'resume', firstJob: true, updatedAt: 'x' })
    );
    // The flag only means something with the student stage.
    expect(readProfile()).toEqual({ stage: 'mid', focus: 'resume', updatedAt: 'x' });
  });
});

describe('9. leaving a shared computer (A B2, B3)', () => {
  it('arms the clear with a verb and says what is kept', () => {
    render(<StoragePanel />);
    expect(screen.getByText(/Your theme and typeface choices are kept/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear everything on this device' }));
    expect(screen.getByRole('button', { name: 'Delete everything now' })).toBeInTheDocument();
  });

  it('tells the visitor to take the export home and delete it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      names.push(this.download);
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 23, 30));
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify({ applications: [] }));
    render(<BackupControls />);
    fireEvent.click(screen.getByRole('button', { name: /Export my work/ }));
    expect(await screen.findByTestId('export-carry-home')).toHaveTextContent(
      "Send this file to yourself, then delete it from this computer's Downloads folder. It is plain text with your writing in it."
    );
    // Named for the evening it was made on this device, not for tomorrow in UTC.
    expect(names).toEqual(['5whys-career-studio-2026-11-13.json']);
  });

  it('dates files by the local calendar', () => {
    expect(localDate(new Date(2026, 10, 13, 23, 59))).toBe('2026-11-13');
    expect(shortDate('2026-11-15', new Date(2026, 0, 1))).toBe('Nov 15');
  });
});

describe('10. dashboard tone and polish (A A4, S F18, C 14, X A11)', () => {
  const session = (lines: [string, number][]) =>
    localStorage.setItem(
      'resume-game-session-v2',
      JSON.stringify({
        needsRescan: false,
        lastAnalyzedAt: '2026-11-01T00:00:00Z',
        bullets: lines.map(([line, score], index) => ({
          id: String(index),
          original: line,
          improved: line,
          baselineScore: score,
          improvedScore: score,
        })),
      })
    );

  it('leads with what is there and never headlines the lowest score', () => {
    session([
      ['Grew the station Instagram from 400 to 2,100 followers by posting three times a week', 90],
      ['Babysat two kids after school', 10],
    ]);
    const rec = readCareerDashboard().recommendations.find((r) => r.tool === 'The Resume Game');
    expect(rec?.text).toBe(
      '1 of your 2 resume lines are already strong. A good next line to work on: "Babysat two kids after school".'
    );
    expect(rec?.text).not.toMatch(/lowest|scores \d/);
  });

  it('draws no warning mark on the empty dashboard', () => {
    render(<CareerDashboard />);
    const heading = screen.getByRole('heading', { name: 'Nothing saved yet' });
    expect(heading.parentElement?.previousElementSibling?.querySelector('svg') ?? null).toBeNull();
  });

  it('writes the in-focus chip in ink, not brass, and dates steps as "Nov 15"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 10));
    seed([{ id: 'a', title: 'Intern', deadline: '2026-11-20' }]);
    const desk = createEmptyDesk(1);
    desk.actionPlan = [
      { id: 's', text: 'Ask for a reference', due: '2026-11-15', done: false, createdAt: 1 },
    ];
    saveDesk('a', desk);
    render(<CareerDashboard />);
    const chip = screen.getByText('In focus');
    expect(chip.className).toContain('text-foreground');
    expect(chip.className).not.toContain('text-gold');
    expect(screen.getByText(/Nov 15, in 2 days/)).toBeInTheDocument();
  });

  it('means the same application by "active" on the desk, the dashboard and Pay', () => {
    const data = (activeId: string | null, ids: string[]): ApplicationsData => ({
      version: 1,
      activeId,
      applications: ids.map((id) => ({
        id,
        title: id,
        company: '',
        deadline: null,
        roleId: null,
        createdAt: 1,
        updatedAt: 1,
      })),
    });
    expect(activeApplicationId(data(null, ['a']))).toBe('a');
    expect(activeApplicationId(data(null, ['a', 'b']))).toBeNull();
    expect(activeApplicationId(data('b', ['a', 'b']))).toBe('b');
    expect(activeApplicationId(data('gone', ['a', 'b']))).toBeNull();
  });

  it('switching on the desk moves the focus and the interview role with it', () => {
    const roles = seed(
      [
        { id: 'a', title: 'Coordinator', lines: [EXCEL] },
        { id: 'b', title: 'Analyst', lines: [SERVICE] },
      ],
      'a'
    );
    openAt('/application/?id=a');
    render(<ApplicationDesk />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch' }), {
      target: { value: 'b' },
    });
    expect(loadApplications().activeId).toBe('b');
    expect(JSON.parse(localStorage.getItem(GLOW_KEY) ?? '{}').currentRoleId).toBe(roles.b.id);
  });
});

describe('11. smaller desk items (C 12, C 13)', () => {
  it('asks before "Only the ones that match" leaves fewer than three bullets', async () => {
    seed([{ id: 'a', title: 'Intern', lines: [EXCEL] }]);
    saveResume(RESUME);
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    // The skills list is not offered as bullets, so three lines remain and one matches.
    const narrow = await screen.findByRole('button', { name: 'Only the ones that match (1)' });
    fireEvent.click(narrow);
    expect(screen.getByText(/That would leave 1 bullet in/)).toBeVisible();
    expect(screen.getByTestId('resume-selection-count')).toHaveTextContent('3 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Keep only that one' }));
    expect(screen.getByTestId('resume-selection-count')).toHaveTextContent('1 of 3');
  });

  it('counts where the visitor stands once, from one list', () => {
    const requirements = confirmed([EXCEL, SERVICE, 'Strong written communication']);
    const rows = requirements.map((r, i) => ({
      requirementId: r.id,
      status: (['have', 'have', 'not-yet'] as const)[i],
      plan: '',
      updatedAt: 1,
    }));
    const evidence = new Map<string, 'evidence' | 'none'>([
      [requirements[0].id, 'evidence'],
      [requirements[1].id, 'none'],
      [requirements[2].id, 'none'],
    ]);
    const where = standing(requirements, rows, evidence);
    expect(where).toMatchObject({ have: 2, notYet: 1, total: 3, shown: 1, haveShown: 1 });
    expect(describeStanding(where)).toBe(
      "2 have it, 0 maybe, 1 not yet. You have more than you are missing. That is enough to apply; plan for the gaps below. Your resume already shows 1 of the 2 you have. Put the other 1 into a bullet or the letter, in the posting's words where they are true."
    );
  });

  it('shows one standing line on Qualifications, with conditions left out', async () => {
    seed([{ id: 'a', title: 'Intern', lines: [CONDITION, EXCEL] }]);
    saveResume(RESUME);
    openAt('/application/?id=a&station=qualifications');
    render(<ApplicationDesk />);
    expect(screen.getByTestId('standing-line')).toHaveTextContent(
      '1 to mark. Your resume already shows 1 of the 1.'
    );
    expect(screen.queryByTestId('coverage-line')).toBeNull();
    await act(async () => {});
  });
});
