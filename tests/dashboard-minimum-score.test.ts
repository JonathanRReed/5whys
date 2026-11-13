import { beforeEach, expect, it } from 'vitest';
import { readCareerDashboard } from '../src/lib/career-bridge';
import { scoreBullet } from '../src/lib/resume-game';

beforeEach(() => localStorage.clear());

const STRONG =
  'Grew the station Instagram from 400 to 2,100 followers by posting three times a week';
const WEAK = 'Helped with stuff';
const MIDDLE = 'Responsible for social media for the campus radio station';

const save = (lines: string[], storedScores: unknown[]) => {
  const saved = JSON.stringify({
    needsRescan: false,
    bullets: lines.map((line, index) => ({
      id: String(index),
      original: line,
      improved: line,
      baselineScore: storedScores[index],
      improvedScore: storedScores[index],
    })),
    lastAnalyzedAt: '2026-10-09T00:00:00Z',
  });
  localStorage.setItem('resume-game-session-v2', saved);
  return saved;
};

const rewriteLinks = () =>
  readCareerDashboard()
    .recommendations.filter((item) => item.cta === 'Work on this line')
    .map((item) => item.href);

it('points at the line that scores lowest as written, whatever score was stored with it', () => {
  const lines = [STRONG, MIDDLE, WEAK];
  const scores = lines.map((line) => scoreBullet(line));
  const weakest = scores.indexOf(Math.min(...scores));
  expect(weakest).toBe(2);
  // The stored numbers say the opposite, as a session saved under an older rubric can.
  const saved = save(lines, [10, 50, 100]);
  expect(rewriteLinks()).toEqual([`/resume-game/?bullet=${weakest}`]);
  // Reading never writes.
  expect(localStorage.getItem('resume-game-session-v2')).toBe(saved);
});

it.each([
  { name: 'strings', stored: ['20', '100', 'bad'] },
  { name: 'nothing', stored: [null, undefined, null] },
])('is not thrown by stored scores that are $name', ({ stored }) => {
  save([STRONG, MIDDLE, WEAK], stored);
  expect(rewriteLinks()).toEqual(['/resume-game/?bullet=2']);
});

it('counts strong lines by the current rules', () => {
  save([STRONG, WEAK], [0, 100]);
  const resume = readCareerDashboard().resume;
  expect(scoreBullet(STRONG)).toBeGreaterThanOrEqual(80);
  expect(resume?.strongCount).toBe(1);
});
