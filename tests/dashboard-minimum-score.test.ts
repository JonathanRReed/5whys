import { beforeEach, expect, it } from 'vitest';
import { readCareerDashboard } from '../src/lib/career-bridge';

beforeEach(() => localStorage.clear());

it.each([
  { name: 'numeric scores', scores: [100, 20, 40], expected: 1 },
  { name: 'numeric ties', scores: [20, 20, 40], expected: 0 },
  { name: 'numeric strings', scores: ['20', '100'], expected: 0 },
  { name: 'reversed numeric strings', scores: ['100', '20'], expected: 1 },
  { name: 'nonnumeric separator', scores: [20, 'bad', 10], expected: 0 },
  { name: 'nonnumeric separator after high score', scores: [100, 'bad', 20], expected: null },
  { name: 'leading nonnumeric score', scores: ['bad', 20, 10], expected: null },
  { name: 'null score', scores: [20, null], expected: 1 },
  { name: 'missing score', scores: [20, undefined], expected: 1 },
  { name: 'missing and zero tie', scores: [undefined, 0], expected: 0 },
  { name: 'mixed numeric tie', scores: ['20', 20], expected: 0 },
])('preserves the saved recommendation for $name', ({ scores, expected }) => {
  const saved = JSON.stringify({
    needsRescan: false,
    bullets: scores.map((score, index) => ({
      id: String(index),
      original: `Saved bullet ${index}`,
      improved: `Saved bullet ${index}`,
      baselineScore: score,
      improvedScore: score,
    })),
    lastAnalyzedAt: '2026-10-09T00:00:00Z',
  });
  localStorage.setItem('resume-game-session-v2', saved);
  const recommendations = readCareerDashboard().recommendations.filter(
    (item) => item.cta === 'Rewrite it'
  );
  expect(recommendations.map((item) => item.href)).toEqual(
    expected === null ? [] : [`/resume-game/?bullet=${expected}`]
  );
  expect(localStorage.getItem('resume-game-session-v2')).toBe(saved);
});
