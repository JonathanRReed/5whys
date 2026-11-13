/**
 * Smaller scoring and marking bugs from the career changer review (finding
 * 15) and its sub-stories: the parent's "Raised two children" and the
 * veteran's regulation numbers and MOS codes.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findNumbers, parseHighlightedResume, scoreParts } from '../src/lib/resume-game';

const verbs = (text: string) =>
  parseHighlightedResume(text)
    .filter((token) => token.type === 'verb')
    .map((token) => token.text);
const numbers = (text: string) =>
  parseHighlightedResume(text)
    .filter((token) => token.type === 'number')
    .map((token) => token.text);

describe('the marked text agrees with the scorer', () => {
  it('marks the opening verbs the scorer credits', () => {
    const text = [
      'EXPERIENCE',
      '- Ran a $3.2M restaurant with 60 staff',
      '- Hired, trained and scheduled front and back of house',
      '- Opened second location on time and under budget',
    ].join('\n');
    expect(verbs(text)).toEqual(expect.arrayContaining(['Ran', 'Hired', 'Opened']));
  });

  it('leaves the phone number, ZIP code and years of the two-column resume unmarked', () => {
    const text = readFileSync('tests/fixtures/changer-docx/two-column-skills.txt', 'utf8');
    const marked = numbers(text);
    for (const unmarked of [
      '614',
      '555',
      '0187',
      '43215',
      '2018',
      '2017',
      '2015',
      '2008',
      '2005',
    ]) {
      expect(marked).not.toContain(unmarked);
    }
    expect(marked).toEqual(expect.arrayContaining(['$3.2M', '2.1%', '600']));
  });
});

describe('a family is not a result or a measure', () => {
  it('scores "Raised two children" for what it says, nothing more', () => {
    const parts = scoreParts('Raised two children');
    expect(parts.result.points).toBe(0);
    expect(parts.measure.points).toBe(0);
  });

  it('still credits money raised and children cared for at work', () => {
    expect(scoreParts('Raised $4,000 for the food pantry').result.points).toBe(40);
    expect(scoreParts('Babysat two kids after school').measure.points).toBe(15);
  });
});

describe('codes are names, not amounts', () => {
  it.each([
    ['Trained 6 92Ys on CTA 50-900 standards', ['92 Ys', '900 standards']],
    ['Kept supply records per AR 710-2 for the battalion', ['710', '2']],
    ['Kept 92Y records for the company', ['92 Y']],
    ['Followed FM 3-21.8 drills every week', ['21.8']],
  ])('"%s"', (line, notMeasures) => {
    const measures = findNumbers(line)
      .filter((found) => found.kind === 'measure')
      .map((found) => found.text);
    for (const code of notMeasures) expect(measures).not.toContain(code);
  });

  it('keeps 4K, 10x and plain counts as amounts', () => {
    const measures = findNumbers('Streamed 4K video to 300 viewers and cut load time 10x')
      .filter((found) => found.kind === 'measure')
      .map((found) => found.text);
    expect(measures).toEqual(['4K', '300 viewers', '10x']);
    expect(scoreParts('Accounted for $2M of equipment across 3 units').measure.points).toBe(15);
  });
});
