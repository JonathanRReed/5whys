import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import CareerDashboard from '../src/components/CareerDashboard';
import { readCareerDashboard } from '../src/lib/career-bridge';
import { createDefaultData, createRole } from '../src/lib/glowup-store';
import { createBulletRecord, EMPTY_SESSION } from '../src/lib/resume-game';

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
