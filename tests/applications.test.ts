import { beforeEach, describe, expect, it } from 'vitest';
import {
  APPLICATIONS_KEY,
  addApplication,
  createDefaultApplications,
  daysUntilDeadline,
  deadlineLabel,
  loadApplications,
  removeApplication,
  saveApplications,
  setActiveApplication,
  sortApplications,
  updateApplication,
} from '../src/lib/applications';
import { readCareerDashboard } from '../src/lib/career-bridge';

const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe('applications store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips and makes the first application the focused one', () => {
    const { data, application } = addApplication(createDefaultApplications(), {
      title: 'Marketing Intern',
      company: 'City Parks Department',
      deadline: isoDaysFromNow(14),
    });
    saveApplications(data);

    const loaded = loadApplications();
    expect(loaded.applications).toHaveLength(1);
    expect(loaded.applications[0].id).toBe(application.id);
    expect(loaded.activeId).toBe(application.id);
  });

  it('rejects malformed and impossible deadlines instead of storing them', () => {
    const { data } = addApplication(createDefaultApplications(), {
      title: 'Analyst',
      deadline: 'next Friday',
    });
    expect(data.applications[0].deadline).toBeNull();

    const rolled = updateApplication(data, data.applications[0].id, { deadline: '2026-13-40' });
    expect(rolled.applications[0].deadline).toBeNull();

    const valid = updateApplication(rolled, rolled.applications[0].id, {
      deadline: isoDaysFromNow(5),
    });
    expect(valid.applications[0].deadline).toBe(isoDaysFromNow(5));
  });

  it('drops entries with no title or company when normalizing stored data', () => {
    window.localStorage.setItem(
      APPLICATIONS_KEY,
      JSON.stringify({
        version: 1,
        applications: [
          { id: 'a', title: '', company: '' },
          { id: 'b', title: 'Intern', company: '', deadline: 'bad-date' },
          'garbage',
        ],
        activeId: 'not-a-real-id',
      })
    );
    const loaded = loadApplications();
    expect(loaded.applications).toHaveLength(1);
    expect(loaded.applications[0].title).toBe('Intern');
    expect(loaded.applications[0].deadline).toBeNull();
    expect(loaded.activeId).toBeNull();
  });

  it('clears the focus when the focused application is removed', () => {
    const { data, application } = addApplication(createDefaultApplications(), { title: 'A' });
    const { data: withSecond } = addApplication(data, { title: 'B' });
    expect(withSecond.activeId).toBe(application.id);

    const removed = removeApplication(withSecond, application.id);
    expect(removed.activeId).toBeNull();
    expect(removed.applications.map((a) => a.title)).toEqual(['B']);
  });

  it('refuses to focus an application that does not exist', () => {
    const { data } = addApplication(createDefaultApplications(), { title: 'A' });
    const result = setActiveApplication(data, 'ghost');
    expect(result.activeId).toBe(data.applications[0].id);
  });

  it('orders the focused application first, then soonest deadline', () => {
    const make = (id: string, daysUntil: number | null, updatedAt: number) => ({
      id,
      daysUntil,
      updatedAt,
    });
    const sorted = sortApplications(
      [make('no-date', null, 9), make('soon', 2, 1), make('later', 30, 8), make('focus', 60, 2)],
      'focus'
    );
    expect(sorted.map((a) => a.id)).toEqual(['focus', 'soon', 'later', 'no-date']);
  });

  it('computes whole days against local dates and labels them', () => {
    expect(daysUntilDeadline(isoDaysFromNow(0))).toBe(0);
    expect(daysUntilDeadline(isoDaysFromNow(3))).toBe(3);
    expect(daysUntilDeadline(isoDaysFromNow(-2))).toBe(-2);
    expect(daysUntilDeadline(null)).toBeNull();
    expect(daysUntilDeadline('2026-02-30')).toBeNull();

    expect(deadlineLabel(0)).toBe('Due today');
    expect(deadlineLabel(1)).toBe('Due tomorrow');
    expect(deadlineLabel(4)).toBe('in 4 days');
    expect(deadlineLabel(-1)).toBe('1 day past');
  });
});

describe('dashboard bridge reads applications', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const seedGlowUp = () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'role-1',
            jobTitle: 'Product Analyst',
            company: 'Acme',
            bullets: [{ id: 'b1', status: 'active' }],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        stories: [{ id: 'story-1', updatedAt: 1 }],
        packets: [{ id: 'p1', roleId: 'role-1', topStoryIds: ['story-1', 'gone'], updatedAt: 2 }],
        currentRoleId: 'role-1',
        currentPacketId: 'p1',
      })
    );
  };

  it('treats a tracked application as data even with no tool work yet', () => {
    const { data } = addApplication(createDefaultApplications(), { title: 'Intern' });
    saveApplications(data);
    const dash = readCareerDashboard();
    expect(dash.hasData).toBe(true);
    expect(dash.applications).toHaveLength(1);
    expect(dash.applications[0].decoded).toBe(false);
  });

  it('prefers the linked role’s live title and derives decode and packet state', () => {
    seedGlowUp();
    const { data } = addApplication(createDefaultApplications(), {
      title: 'Stale title',
      roleId: 'role-1',
      deadline: isoDaysFromNow(4),
    });
    saveApplications(data);

    const app = readCareerDashboard().applications[0];
    expect(app.title).toBe('Product Analyst');
    expect(app.company).toBe('Acme');
    expect(app.decoded).toBe(true);
    // 'gone' is a dead story id; only real stories count as packed.
    expect(app.packetStories).toBe(1);
    expect(app.daysUntil).toBe(4);
  });

  it('reports the loop complete only when every stage has real saved work', () => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      'career-why-history',
      JSON.stringify([{ id: 'snap', timestamp: now, track: 'interest', topic: 'bio' }])
    );
    window.localStorage.setItem(
      'resume-game-session-v2',
      JSON.stringify({ bullets: [{ id: 'b', improvedScore: 70 }], lastAnalyzedAt: now })
    );
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'r1', jobTitle: 'Analyst' }],
        stories: [{ id: 's1' }],
        packets: [{ id: 'p1', roleId: 'r1', topStoryIds: ['s1'] }],
      })
    );

    // Missing the practice rep: the loop is open.
    expect(readCareerDashboard().arcLine).toBeNull();

    window.localStorage.setItem(
      'networking-practice-sessions',
      JSON.stringify([{ createdAt: now, ratings: { confidence: 4 } }])
    );
    expect(readCareerDashboard().arcLine).toContain('You have done the whole loop');

    // A packet pointing at a deleted story does not count as packed.
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'r1' }],
        stories: [],
        packets: [{ id: 'p1', roleId: 'r1', topStoryIds: ['s1'] }],
      })
    );
    expect(readCareerDashboard().arcLine).toBeNull();
  });

  it('recommends decoding before packing, and only counts a parsed role as decoded', () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'role-1', jobTitle: 'Analyst', bullets: [], updatedAt: 1 }],
        stories: [],
        packets: [],
      })
    );
    const { data } = addApplication(createDefaultApplications(), {
      title: 'Analyst',
      roleId: 'role-1',
    });
    saveApplications(data);

    const dash = readCareerDashboard();
    expect(dash.applications[0].decoded).toBe(false);
    const rec = dash.recommendations.find((r) => r.text.includes('decoded'));
    expect(rec?.href).toBe('/interview-glow-up/workspace/?tab=decode');
  });
});
