/**
 * Regressions from the launch QA of Pay, the dashboard, backups and the
 * career review (findings 4, 6, 8, 12, 13, 16, 17, 18, 19 and 20). The desk's
 * own findings are in desk-launch-fixes.test.tsx.
 */
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationsPanel, { NewApplicationForm } from '../src/components/ApplicationsPanel';
import CareerDashboard from '../src/components/CareerDashboard';
import OnboardingWizard from '../src/components/OnboardingWizard';
import PayTool from '../src/components/pay/PayTool';
import StoragePanel from '../src/components/StoragePanel';
import {
  APPLICATION_DESK_KEY,
  createDefaultDeskData,
  createEmptyDesk,
  normalizeDesk,
  offerEquivalents,
  updateOfferWorksheet,
} from '../src/lib/application-desk';
import { APPLICATIONS_KEY } from '../src/lib/applications';
import { type ApplicationSummary, readCareerDashboard } from '../src/lib/career-bridge';
import { asks, runSendChecks } from '../src/lib/desk-checks';
import { closeLocalDb } from '../src/lib/local-db';
import { parseAmount } from '../src/lib/pay-input';
import { parseBackup } from '../src/lib/studio-backup';

beforeEach(() => localStorage.clear());
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  await closeLocalDb();
});

const app = (id: string, title: string) => ({
  id,
  title,
  company: '',
  deadline: null,
  roleId: null,
  createdAt: 1,
  updatedAt: 1,
});

const backupWith = (stores: Record<string, unknown>) =>
  JSON.stringify({ format: '5whys-career-studio', version: 2, exportedAt: '', stores });

describe('finding 4: a malformed backup or store', () => {
  const glow = (packets: unknown[]) => ({
    version: 1,
    roles: [{ id: 'r1', jobTitle: 'Intern', company: '', rawJdText: '', bullets: [] }],
    stories: [],
    packets,
    currentRoleId: 'r1',
    currentPacketId: null,
  });

  it('is refused before anything is written', () => {
    expect(() =>
      parseBackup(
        backupWith({
          'interview-glow-up-data': glow([{ id: 'p', roleId: 'r1', topStoryIds: 'not-an-array' }]),
        })
      )
    ).toThrow('invalid data for "interview-glow-up-data"');
    expect(() =>
      parseBackup(
        backupWith({
          'interview-glow-up-data': {
            ...glow([]),
            roles: [{ id: 'bad-role', jobTitle: 'Role', bullets: [{ id: 'b', text: 7 }] }],
          },
        })
      )
    ).toThrow('invalid data for "interview-glow-up-data"');
    expect(() =>
      parseBackup(
        backupWith({
          'career-application-desk': {
            version: 1,
            desks: { a: { letter: { messages: { linkedin: { text: 3 } } } } },
          },
        })
      )
    ).toThrow('invalid data for "career-application-desk"');
    // A well-formed packet still comes in.
    expect(() =>
      parseBackup(
        backupWith({
          'interview-glow-up-data': glow([{ id: 'p', roleId: 'r1', topStoryIds: ['s1'] }]),
        })
      )
    ).not.toThrow();
  });

  it('does not stop the dashboard readers', () => {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify({ applications: [app('a', 'Intern')] }));
    for (const value of [
      { roles: {}, stories: [], packets: [] },
      { roles: [null, { id: 'r1', bullets: 'x' }], stories: [7], packets: [{ topStoryIds: 'x' }] },
      'just a string',
    ]) {
      localStorage.setItem('interview-glow-up-data', JSON.stringify(value));
      localStorage.setItem('resume-game-session-v2', JSON.stringify({ bullets: [null, 4] }));
      localStorage.setItem('networking-practice-sessions', JSON.stringify([null, { ratings: 1 }]));
      expect(() => readCareerDashboard()).not.toThrow();
      expect(readCareerDashboard().applications).toHaveLength(1);
    }
  });

  it('keeps export, import and clear on the page with a corrupt store', async () => {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify({ applications: [app('a', 'Intern')] }));
    localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({ roles: {}, stories: [], packets: [] })
    );
    render(<CareerDashboard />);
    expect(await screen.findByRole('button', { name: 'Export my work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import a file' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear everything on this device' })
    ).toBeInTheDocument();
    expect(screen.getByText('Intern')).toBeInTheDocument();
  });
});

describe('finding 6: a full store and the new-application form', () => {
  it('keeps what was typed and says saving failed', () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === APPLICATIONS_KEY) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    const onCreated = vi.fn();
    render(<NewApplicationForm idPrefix="t" onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'Student research intern' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Track this application' }));
    expect(screen.getByLabelText('Role')).toHaveValue('Student research intern');
    expect(screen.getByRole('alert')).toHaveTextContent('This browser would not save it.');
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe('finding 8: a bonus typed as a percentage', () => {
  const offer = {
    ...createEmptyDesk().offer,
    basePay: 62000,
    payPeriod: 'year' as const,
    hoursPerWeek: 40,
    weeksPerYear: 52,
  };

  it('stays a share of base pay in saved data', () => {
    const typed = updateOfferWorksheet(createDefaultDeskData(), 'a', {
      guaranteedBonus: 3100,
      percentOfBase: { guaranteedBonus: 5 },
    });
    const reloaded = normalizeDesk(JSON.parse(JSON.stringify(typed.desks.a)));
    expect(reloaded.offer.percentOfBase).toEqual({ guaranteedBonus: 5 });
    const raised = { ...reloaded.offer, ...offer, basePay: 100000 };
    expect(offerEquivalents(raised).annualGuaranteed).toBe(105000);
    // An amount typed later replaces the percentage.
    const fixed = updateOfferWorksheet(typed, 'a', {
      guaranteedBonus: 3000,
      percentOfBase: { guaranteedBonus: null },
    });
    expect(fixed.desks.a.offer.percentOfBase).toBeUndefined();
  });

  it('loads a worksheet saved before percentages were kept', () => {
    const old = normalizeDesk({ offer: { ...offer, guaranteedBonus: 3100 } });
    expect(old.offer.percentOfBase).toBeUndefined();
    expect(offerEquivalents(old.offer).annualGuaranteed).toBe(65100);
  });

  it('is accepted in a backup', () => {
    const desk = { ...createEmptyDesk(1), offer: { ...offer, percentOfBase: { variablePay: 5 } } };
    expect(() =>
      parseBackup(backupWith({ 'career-application-desk': { version: 1, desks: { a: desk } } }))
    ).not.toThrow();
  });

  it('shows "5%" again after a reload, and follows the base pay', async () => {
    localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({ version: 1, activeId: 'a', applications: [app('a', 'Intern')] })
    );
    const desks = updateOfferWorksheet(createDefaultDeskData(), 'a', {
      ...offer,
      guaranteedBonus: 3100,
      percentOfBase: { guaranteedBonus: 5 },
    });
    localStorage.setItem(APPLICATION_DESK_KEY, JSON.stringify(desks));
    render(<PayTool />);
    const bonus = await screen.findByDisplayValue('5%');
    expect(bonus).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('62000'), { target: { value: '100000' } });
    await waitFor(() =>
      expect(screen.getByText('With the guaranteed bonus').nextElementSibling).toHaveTextContent(
        '$105,000 a year'
      )
    );
  });
});

describe('findings 1 and 5 on the pay page: an application removed in another tab', () => {
  it('empties the worksheet and saves nothing under the removed id', async () => {
    localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({ version: 1, activeId: 'a', applications: [app('a', 'Intern')] })
    );
    render(<PayTool />);
    const base = await screen.findByRole('textbox', { name: 'Base pay' });
    fireEvent.change(base, { target: { value: '62000' } });
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toContain('62000');

    act(() => {
      localStorage.removeItem(APPLICATIONS_KEY);
      localStorage.removeItem(APPLICATION_DESK_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: APPLICATIONS_KEY }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('removed in another tab');
    const emptied = screen.getByRole('textbox', { name: 'Base pay' });
    expect(emptied).toHaveValue('');
    fireEvent.change(emptied, { target: { value: '70000' } });
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toBeNull();
  });
});

describe('finding 12: decimal commas', () => {
  it('reads an unambiguous decimal comma as a decimal', () => {
    expect(parseAmount('26,50')).toEqual({ ok: true, value: 26.5 });
    expect(parseAmount('62,5')).toEqual({ ok: true, value: 62.5 });
  });

  it('reads commas between thousands as grouping', () => {
    expect(parseAmount('62,000')).toEqual({ ok: true, value: 62000 });
    expect(parseAmount('1,250,000')).toEqual({ ok: true, value: 1250000 });
    expect(parseAmount('$12,345.67')).toEqual({ ok: true, value: 12345.67 });
  });

  it('refuses anything else with a plain message', () => {
    for (const input of ['26,5000', '1,2,3', '1,00.5', '62,00,000', ',50']) {
      const result = parseAmount(input, { label: 'Base pay' });
      expect(result.ok, input).toBe(false);
      if (!result.ok) expect(result.error).toContain('Use a point for cents, such as 26.50');
    }
  });
});

describe('finding 17: numbers too large to work out', () => {
  it('refuses them instead of producing infinity', () => {
    const huge = '9'.repeat(308);
    expect(parseAmount(huge, { label: 'Base pay' })).toMatchObject({
      ok: false,
      error: 'Base pay is too large to work out.',
    });
    const figures = offerEquivalents({
      ...createEmptyDesk().offer,
      basePay: Number(huge),
      payPeriod: 'hour',
      hoursPerWeek: 40,
      weeksPerYear: 52,
    });
    expect(figures.annualBase).toBeNull();
    expect(figures.annualGuaranteed).toBeNull();
  });
});

describe('findings 13 and 16: the send checks', () => {
  const checks = (hook: string, closingAsk = '') =>
    Object.fromEntries(
      runSendChecks({
        letter: { ...createEmptyDesk().letter, hook, closingAsk },
        title: 'Data analyst',
        company: 'Meta',
        requirements: [],
      }).map((check) => [check.id, check])
    );

  it('finding 13: a different role and a word that contains the company do not count', () => {
    const names = checks('I want to be a Data engineer who builds metadata tools.').names;
    expect(names.passed).toBe(false);
    expect(names.detail).toBe('Does not mention Data analyst or Meta.');
    expect(checks('I want to join Meta as a data analyst.').names.passed).toBe(true);
  });

  it('finding 16: a question is not an ask unless it asks for a next step', () => {
    expect(asks('Why is the sky blue?')).toBe(false);
    expect(checks('Hook', 'Why is the sky blue?')['ends-with-ask'].passed).toBe(false);
    expect(asks('Could we set up a call next week?')).toBe(true);
    expect(asks('I look forward to hearing from you.')).toBe(true);
    expect(asks('Please contact me at sam@example.edu.')).toBe(true);
  });
});

describe('finding 18: the storage panel after an import or a delete', () => {
  it('measures again when the stored work changes', async () => {
    localStorage.setItem('career-application-desk', 'x'.repeat(20 * 1024));
    const { rerender } = render(<StoragePanel revision={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Measure it' }));
    await waitFor(() =>
      expect(screen.getByTestId('storage-total')).toHaveTextContent(/^40 KB in all/)
    );
    localStorage.setItem('career-application-desk', '{}');
    rerender(<StoragePanel revision={1} />);
    await waitFor(() =>
      expect(screen.getByTestId('storage-total')).toHaveTextContent(/^\d+ B in all/)
    );
  });
});

describe('finding 19: focus after removing an application', () => {
  const summary = (id: string, title: string): ApplicationSummary => ({
    id,
    title,
    company: '',
    deadline: null,
    daysUntil: null,
    isActive: false,
    roleId: null,
    decoded: false,
    packetStories: 0,
    stations: {
      qualifications: false,
      bullets: false,
      resume: false,
      letter: false,
      'before-you-send': false,
      pay: false,
    },
    updatedAt: 1,
  });

  function Panel() {
    const read = () =>
      (
        JSON.parse(localStorage.getItem(APPLICATIONS_KEY) ?? '{"applications":[]}') as {
          applications: { id: string; title: string }[];
        }
      ).applications.map((a) => summary(a.id, a.title));
    const [apps, setApps] = React.useState(read);
    return (
      <ApplicationsPanel
        applications={apps}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={() => setApps(read())}
      />
    );
  }

  const removeVia = async (name: string) => {
    const row = screen.getByText(name).closest('li') as HTMLElement;
    const button = Array.from(row.querySelectorAll('button')).find(
      (b) => b.textContent === 'Remove'
    ) as HTMLButtonElement;
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  };

  it('moves to the next row, then the previous one, then the heading', async () => {
    localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({
        version: 1,
        activeId: null,
        applications: [app('a', 'First'), app('b', 'Second'), app('c', 'Third')],
      })
    );
    render(<Panel />);
    await removeVia('First');
    expect(document.activeElement?.id).toBe('app-row-b');
    await removeVia('Third');
    expect(document.activeElement?.id).toBe('app-row-b');
    await removeVia('Second');
    expect(document.activeElement?.id).toBe('applications-heading');
  });
});

describe('finding 20: the career review heading on a phone', () => {
  it('reserves no empty side columns for the question on a phone', () => {
    render(<OnboardingWizard />);
    const block = screen.getByTestId('review-question');
    const row = block.parentElement as HTMLElement;
    // One column below the small breakpoint; the empty Back cell is hidden there.
    expect(row.className).not.toMatch(/(^|\s)flex(\s|$)/);
    expect(row.className).toContain('sm:grid-cols-');
    for (const cell of Array.from(row.children)) {
      if (cell !== block) expect(cell.className).toContain('max-sm:hidden');
    }
  });
});
