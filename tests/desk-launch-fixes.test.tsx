/**
 * Regressions from the launch QA of the Application Desk (findings 1, 2, 5,
 * 7, 9, 10, 11, 14 and 15). Each test names its finding.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationDesk from '../src/components/application-desk/ApplicationDesk';
import { matchSelection, selectedIds } from '../src/components/application-desk/ResumeStation';
import { useDesk } from '../src/components/application-desk/useDesk';
import {
  APPLICATION_DESK_KEY,
  createDefaultDeskData,
  loadApplicationDesks,
  updateLetter,
} from '../src/lib/application-desk';
import { APPLICATIONS_KEY, type ApplicationsData } from '../src/lib/applications';
import {
  createDefaultData,
  createRole,
  STORAGE_KEY as GLOW_KEY,
  type GlowUpData,
  loadData,
} from '../src/lib/glowup-store';
import {
  decodePostingToBullets,
  requirementsFromBullets,
  SAMPLE_POSTING,
} from '../src/lib/posting';

type Seed = { id: string; title: string; company?: string; decoded?: boolean };

/** Applications, with a decoded sample posting for the ones that ask for it. */
function seed(apps: Seed[], activeId = apps[0]?.id ?? null) {
  let glow: GlowUpData = createDefaultData();
  const roleIds: Record<string, string> = {};
  for (const app of apps) {
    if (!app.decoded) continue;
    const { parsed, bullets } = decodePostingToBullets(SAMPLE_POSTING);
    glow = createRole(glow, {
      jobTitle: app.title,
      company: app.company ?? '',
      rawJdText: SAMPLE_POSTING,
      parsedJdText: parsed.text,
      bullets,
    });
    roleIds[app.id] = glow.currentRoleId as string;
  }
  const data: ApplicationsData = {
    version: 1,
    activeId,
    applications: apps.map((app) => ({
      id: app.id,
      title: app.title,
      company: app.company ?? '',
      deadline: null,
      roleId: roleIds[app.id] ?? null,
      createdAt: 1,
      updatedAt: 1,
    })),
  };
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(data));
  localStorage.setItem(GLOW_KEY, JSON.stringify(glow));
  return { roleIds };
}

const storedDesks = () => loadApplicationDesks();

/** What another tab does: write storage, then the browser tells this tab. */
function otherTabWrites(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
}

function openAt(search: string) {
  window.history.replaceState(null, '', `/application/${search}`);
}

beforeEach(() => {
  localStorage.clear();
  openAt('');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('finding 1: clearing everything in another tab', () => {
  it('empties this desk and stops it from writing the cleared work back', () => {
    seed([{ id: 'a', title: 'Library assistant' }]);
    const { result } = renderHook(() => useDesk());
    expect(result.current.application?.id).toBe('a');
    act(() =>
      result.current.changeDesks((data) => updateLetter(data, 'a', { hook: 'Private letter' }))
    );
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toContain('Private letter');

    act(() => {
      // The dashboard's clear removes every studio key, one at a time.
      for (const key of [APPLICATIONS_KEY, GLOW_KEY, APPLICATION_DESK_KEY]) {
        otherTabWrites(key, null);
      }
    });
    expect(result.current.application).toBeNull();
    expect(result.current.lost?.reason).toBe('cleared');
    expect(result.current.lost?.text).toBe('');

    // An editor that was open types one more character: nothing comes back.
    act(() =>
      result.current.changeDesks((data) => updateLetter(data, 'a', { hook: 'Private letter!' }))
    );
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toBeNull();
  });

  it('shows the visitor that the page was emptied, with nothing left to copy', () => {
    seed([{ id: 'a', title: 'Library assistant' }]);
    openAt('?station=letter');
    render(<ApplicationDesk />);
    const hook = screen.getByLabelText(/Name the role with a hook/);
    fireEvent.change(hook, { target: { value: 'Private letter' } });
    act(() => {
      for (const key of [APPLICATIONS_KEY, GLOW_KEY, APPLICATION_DESK_KEY]) {
        otherTabWrites(key, null);
      }
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Everything saved on this device was cleared in another tab'
    );
    expect(screen.queryByDisplayValue('Private letter')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy the text' })).toBeNull();
    expect(localStorage.getItem(APPLICATION_DESK_KEY)).toBeNull();
  });
});

describe('finding 5: an application removed in another tab', () => {
  it('stops saving under its id and offers the open text to copy', () => {
    seed([
      { id: 'a', title: 'Research assistant' },
      { id: 'b', title: 'Library assistant' },
    ]);
    openAt('?id=b&station=letter');
    render(<ApplicationDesk />);
    fireEvent.change(screen.getByLabelText(/Name the role with a hook/), {
      target: { value: 'Private note typed before removal' },
    });

    // The dashboard removes B and its desk.
    const apps = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) as string) as ApplicationsData;
    act(() => {
      otherTabWrites(
        APPLICATIONS_KEY,
        JSON.stringify({ ...apps, applications: apps.applications.filter((a) => a.id !== 'b') })
      );
      otherTabWrites(APPLICATION_DESK_KEY, JSON.stringify(createDefaultDeskData()));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('"Library assistant" was removed in another tab');
    expect(
      (
        screen.getByLabelText(
          'What you had written for the removed application'
        ) as HTMLTextAreaElement
      ).value
    ).toContain('Private note typed before removal');
    expect(screen.getByRole('button', { name: 'Copy the text' })).toBeInTheDocument();
    // The editor is gone, and nothing was saved for B.
    expect(screen.queryByLabelText(/Name the role with a hook/)).toBeNull();
    expect(storedDesks().desks.b).toBeUndefined();
  });

  it('refuses a change that arrives before the page has heard of the removal', () => {
    seed([
      { id: 'a', title: 'Research assistant' },
      { id: 'b', title: 'Library assistant' },
    ]);
    openAt('?id=b');
    const { result } = renderHook(() => useDesk());
    // Removed without a storage event (this tab was asleep).
    const apps = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) as string) as ApplicationsData;
    localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({ ...apps, applications: apps.applications.filter((a) => a.id === 'a') })
    );
    act(() =>
      result.current.changeDesks((data) => updateLetter(data, 'b', { hook: 'Typed after removal' }))
    );
    expect(storedDesks().desks.b).toBeUndefined();
    expect(result.current.lost?.reason).toBe('removed');
  });
});

describe('finding 2: confirming requirements in two tabs', () => {
  it('keeps the confirmation the other tab saved', () => {
    const { roleIds } = seed([{ id: 'a', title: 'Volunteer coordinator', decoded: true }]);
    render(<ApplicationDesk />);
    const roleId = roleIds.a;
    const before = requirementsFromBullets(
      loadData().roles.find((r) => r.id === roleId)?.bullets ?? []
    );
    const [first, second] = before;

    // Tab B confirms the first requirement and saves.
    const glow = loadData();
    const role = glow.roles.find((r) => r.id === roleId);
    if (!role) throw new Error('role missing');
    const confirmedFirst = {
      ...glow,
      roles: glow.roles.map((r) =>
        r.id === roleId
          ? {
              ...r,
              bullets: r.bullets.map((b) => (b.id === first.id ? { ...b, confirmed: true } : b)),
            }
          : r
      ),
    };
    localStorage.setItem(GLOW_KEY, JSON.stringify(confirmedFirst));

    // This tab, not reloaded, confirms the second.
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^Confirm: ${second.text.slice(0, 20)}`) })
    );

    const after = requirementsFromBullets(
      loadData().roles.find((r) => r.id === roleId)?.bullets ?? []
    );
    expect(after.find((r) => r.id === first.id)?.status).toBe('confirmed');
    expect(after.find((r) => r.id === second.id)?.status).toBe('confirmed');
  });
});

describe('per-application drafts (findings 7, 10, 11)', () => {
  it('finding 10: a posting draft stays with its application', () => {
    seed([
      { id: 'b', title: 'Library assistant' },
      { id: 'c', title: 'Research assistant' },
    ]);
    render(<ApplicationDesk />);
    fireEvent.change(screen.getByLabelText('Job description'), {
      target: { value: 'Library role draft only for B' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch' }), {
      target: { value: 'c' },
    });
    expect(screen.getByLabelText('Job description')).toHaveValue('');
  });

  it('finding 11: an unfinished action step stays with its application', () => {
    seed([
      { id: 'a', title: 'Volunteer coordinator', decoded: true },
      { id: 'c', title: 'Research assistant', decoded: true },
    ]);
    // Confirm every suggested requirement for both, so each has rows.
    const glow = loadData();
    localStorage.setItem(
      GLOW_KEY,
      JSON.stringify({
        ...glow,
        roles: glow.roles.map((r) => ({
          ...r,
          bullets: r.bullets.map((b) => ({ ...b, confirmed: true })),
        })),
      })
    );
    openAt('?station=qualifications');
    render(<ApplicationDesk />);
    fireEvent.change(screen.getByLabelText('Next step'), {
      target: { value: 'Ask QA mentor for a reference' },
    });
    fireEvent.change(screen.getByLabelText('Do it by'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch' }), {
      target: { value: 'c' },
    });
    expect(screen.getByLabelText('Next step')).toHaveValue('');
    expect(screen.getByLabelText('Do it by')).toHaveValue('');
    expect(storedDesks().desks.c?.actionPlan ?? []).toHaveLength(0);
  });

  it('finding 7: "Letter copied" does not follow the visitor to another application', async () => {
    seed([
      { id: 'a', title: 'Library assistant' },
      { id: 'c', title: 'Research assistant' },
    ]);
    localStorage.setItem(
      APPLICATION_DESK_KEY,
      JSON.stringify(updateLetter(createDefaultDeskData(), 'a', { hook: 'Letter for A' }))
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    openAt('?station=send');
    render(<ApplicationDesk />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the letter' }));
    });
    expect(screen.getByRole('button', { name: 'Letter copied' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch' }), {
      target: { value: 'c' },
    });
    expect(screen.queryByRole('button', { name: 'Letter copied' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy the letter' })).toBeDisabled();
  });
});

describe('finding 14: interview links for an application with no decoded posting', () => {
  it('sends the visitor to the posting instead of another role', () => {
    seed([
      { id: 'r', title: 'Research assistant', decoded: true },
      { id: 'l', title: 'Library assistant' },
    ]);
    openAt('?id=l&station=letter');
    render(<ApplicationDesk />);
    const nav = screen.getByRole('navigation', { name: 'Other tools for this application' });
    expect(nav).not.toHaveTextContent('Build interview stories');
    expect(nav).not.toHaveTextContent('Rehearse the interview');
    fireEvent.click(screen.getByRole('button', { name: 'Paste and decode it first' }));
    expect(screen.getByLabelText('Job description')).toBeInTheDocument();
  });

  it('keeps the links for an application with a decoded posting', () => {
    seed([{ id: 'r', title: 'Research assistant', decoded: true }]);
    render(<ApplicationDesk />);
    expect(screen.getByRole('link', { name: 'Build interview stories' })).toBeInTheDocument();
  });
});

describe('finding 15: editing the role and company of an application', () => {
  it('saves both on the desk and keeps the posting and desk work', () => {
    const { roleIds } = seed([{ id: 'a', title: 'Data analyst', decoded: true }]);
    localStorage.setItem(
      APPLICATION_DESK_KEY,
      JSON.stringify(updateLetter(createDefaultDeskData(), 'a', { hook: 'Kept hook' }))
    );
    render(<ApplicationDesk />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit role and company' }));
    const form = screen.getByRole('form', { name: 'Role and company for this application' });
    fireEvent.change(form.querySelector('#desk-edit-title') as HTMLInputElement, {
      target: { value: 'Data analyst intern' },
    });
    fireEvent.change(screen.getAllByLabelText(/Company or organization/)[0], {
      target: { value: 'Riverside Food Bank' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const apps = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) as string) as ApplicationsData;
    expect(apps.applications[0]).toMatchObject({
      title: 'Data analyst intern',
      company: 'Riverside Food Bank',
      roleId: roleIds.a,
    });
    const role = loadData().roles.find((r) => r.id === roleIds.a);
    expect(role?.company).toBe('Riverside Food Bank');
    expect(role?.rawJdText).toBe(SAMPLE_POSTING);
    expect(storedDesks().desks.a?.letter.hook).toBe('Kept hook');
    expect(screen.getByText(/at Riverside Food Bank/)).toBeInTheDocument();
  });
});

describe('finding 9: a corrected bullet keeps the rest of the choice', () => {
  const resume = (n: number) => [
    { id: 'text:1', key: `built a spreadsheet tracking ${n} volunteers.` },
    { id: 'text:2', key: 'ran the front desk on weekends.' },
    { id: 'text:3', key: 'wrote the weekly newsletter for 200 readers.' },
  ];
  const saved = {
    bulletIds: ['text:1'],
    bulletTexts: ['built a spreadsheet tracking 30 volunteers.'],
  };

  it('follows a one-word correction instead of including every bullet again', () => {
    expect(selectedIds(resume(30), saved)).toEqual(['text:1']);
    expect(matchSelection(resume(45), saved)).toEqual({ ids: ['text:1'], reset: false });
  });

  it('falls back to everything, and says so, only for a different resume', () => {
    const other = [
      { id: 'text:1', key: 'stocked shelves at the campus store.' },
      { id: 'text:2', key: 'tutored first-year chemistry students.' },
    ];
    expect(matchSelection(other, saved)).toEqual({ ids: ['text:1', 'text:2'], reset: true });
  });
});
