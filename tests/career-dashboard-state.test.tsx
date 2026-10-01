import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import CareerDashboard from '../src/components/CareerDashboard';
import { readCareerDashboard } from '../src/lib/career-bridge';
import { createDefaultData, createRole } from '../src/lib/glowup-store';
import { buildDeepSignalReport, createBulletRecord, EMPTY_SESSION } from '../src/lib/resume-game';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it.each(['resume', 'reflection', 'networking', 'interview'])(
  'recognizes saved %s work before a full exercise is complete',
  (tool) => {
    if (tool === 'resume') {
      localStorage.setItem(
        'resume-game-session-v2',
        JSON.stringify({
          ...EMPTY_SESSION,
          resumeText: 'A resume draft awaiting review.',
          needsRescan: true,
        })
      );
    } else if (tool === 'reflection') {
      localStorage.setItem(
        'career-why-session-v2',
        JSON.stringify({
          track: 'interest',
          topic: 'Teaching',
          responses: ['I enjoy explaining ideas.', '', '', '', ''],
        })
      );
    } else if (tool === 'networking') {
      localStorage.setItem(
        'networking-practice-draft',
        JSON.stringify({ text: 'A practice introduction.' })
      );
    } else {
      localStorage.setItem(
        'interview-glow-up-data',
        JSON.stringify(
          createRole(createDefaultData(), {
            jobTitle: 'Community coordinator',
            company: '',
            rawJdText: 'Organize events.',
            bullets: [],
          })
        )
      );
    }
    expect(readCareerDashboard().hasData).toBe(true);
    render(<CareerDashboard />);
    expect(screen.queryByText('Nothing saved in this browser yet.')).not.toBeInTheDocument();
  }
);

it('prioritizes a rescan over advice based on older resume results', () => {
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({
      ...EMPTY_SESSION,
      resumeText: 'A changed resume draft.',
      needsRescan: true,
      bullets: [createBulletRecord('Helped with tasks', 0)],
      lastAnalyzedAt: '2026-10-01T00:00:00Z',
      signalReport: { ...EMPTY_SESSION.signalReport, hardSkills: ['python'] },
    })
  );
  const dashboard = readCareerDashboard();
  expect(dashboard.recommendations[0].cta).toBe('Review changed resume');
  expect(dashboard.recommendations.some((item) => item.text.includes('lowest bullet scores'))).toBe(
    false
  );
  expect(dashboard.recommendations.some((item) => item.text.includes('Your resume shows'))).toBe(
    false
  );
});

it('shows a supported legacy resume draft without migrating or overwriting it', () => {
  localStorage.setItem('resume-game-text', 'Legacy resume draft');
  expect(readCareerDashboard().hasData).toBe(true);
  render(<CareerDashboard />);
  expect(screen.getByText(/a resume draft awaiting review/)).toBeVisible();
  expect(localStorage.getItem('resume-game-text')).toBe('Legacy resume draft');
  expect(localStorage.getItem('resume-game-session-v2')).toBeNull();
});

it('shows a newer reflection draft alongside saved snapshots', () => {
  localStorage.setItem(
    'career-why-history',
    JSON.stringify([
      {
        id: 'saved-reflection',
        timestamp: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
        version: 2,
        track: 'interest',
        topic: 'Research',
        responses: Array(5).fill('Saved answer.'),
        whyStatement: 'Saved research statement.',
        rootReason: 'Saved reason.',
        nextStep: 'Test research.',
      },
    ])
  );
  localStorage.setItem(
    'career-why-session-v2',
    JSON.stringify({
      track: 'interest',
      topic: 'Teaching',
      responses: ['I enjoy explaining ideas.', '', '', '', ''],
    })
  );
  render(<CareerDashboard />);
  expect(
    screen.getByText(/one reflection on Research.*reflection in progress on Teaching/)
  ).toBeVisible();
});

it('shows an intro draft alongside previous practice rounds', () => {
  localStorage.setItem(
    'networking-practice-draft',
    JSON.stringify({ text: 'A newer introduction.' })
  );
  localStorage.setItem(
    'networking-practice-sessions',
    JSON.stringify([
      {
        createdAt: '2026-09-01T00:00:00Z',
        ratings: { confidence: 3, clarity: 3, rapport: 3, authenticity: 3 },
      },
    ])
  );
  render(<CareerDashboard />);
  expect(screen.getByText(/one practice round.*an introduction draft/)).toBeVisible();
});

it('counts saved roles and stories independently', () => {
  localStorage.setItem(
    'interview-glow-up-data',
    JSON.stringify({
      ...createRole(createDefaultData(), {
        jobTitle: 'Community coordinator',
        company: '',
        rawJdText: 'Organize events.',
        bullets: [],
      }),
      stories: [
        {
          id: 'existing-story',
          primarySkillId: 'python',
          otherSkillIds: [],
          trigger: 'Prior work',
          hook: 'Prior research work',
          proofSnippet: 'A reporting workflow',
          play: 'Built a workflow',
          proof: 'Used by the team',
          confidence: 60,
          questionPrompts: [],
          tags: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
  );
  render(<CareerDashboard />);
  expect(screen.getByText(/one interview story.*one saved role/)).toBeVisible();
});

it('does not show an obsolete prominent resume score beside changed text', () => {
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({
      ...EMPTY_SESSION,
      resumeText: 'Changed resume',
      needsRescan: true,
      bullets: [createBulletRecord('Helped with tasks', 0)],
      lastAnalyzedAt: '2026-09-01T00:00:00Z',
    })
  );
  render(<CareerDashboard />);
  expect(screen.getByText(/Saved resume results need a fresh analysis/)).toBeVisible();
  expect(screen.queryByText(/average bullet score across/)).toBeNull();
});

it('suppresses stale skills even when the old analysis found no achievement bullets', () => {
  const report = buildDeepSignalReport([], 'Skills: Python');
  expect(report.hardSkills).toContain('python');
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({
      ...EMPTY_SESSION,
      resumeText: 'A new community-focused resume.',
      needsRescan: true,
      lastAnalyzedAt: '2026-09-01T00:00:00Z',
      signalReport: report,
      bullets: [],
    })
  );
  const dashboard = readCareerDashboard();
  expect(dashboard.resume?.needsRescan).toBe(true);
  expect(dashboard.resume?.hardSkills).toEqual([]);
  expect(dashboard.recommendations[0].cta).toBe('Review changed resume');
  expect(dashboard.recommendations.some((item) => item.text.includes('Your resume shows'))).toBe(
    false
  );
});
