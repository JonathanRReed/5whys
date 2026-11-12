import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addRequirement,
  confirmAllSuggested,
  describeCoverage,
  dismissRequirement,
  type PostingRequirement,
  parsePosting,
  summarizeCoverage,
} from '../src/lib/posting';

const read = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'postings', `${name}.txt`), 'utf8');

const resume = read('student-resume');

function confirmed(texts: string[]): PostingRequirement[] {
  return texts.reduce<PostingRequirement[]>((list, text) => addRequirement(list, text), []);
}

describe('summarizeCoverage', () => {
  it('returns evidence or none per confirmed requirement, with counts', () => {
    const summary = summarizeCoverage(
      confirmed([
        'Experience with Excel, including pivot tables',
        'Write SQL queries',
        'Familiarity with GIS tools',
        'Must be 18 years or older',
      ]),
      resume
    );
    expect(summary.rows.map((r) => r.state)).toEqual([
      'evidence',
      'evidence',
      'none',
      'not-checkable',
    ]);
    expect(summary).toMatchObject({
      confirmedCount: 4,
      withEvidenceCount: 2,
      withoutEvidenceCount: 1,
      notCheckableCount: 1,
    });
    expect(summary.rows[2].excerpts).toEqual([]);
    expect(summary.rows[2].missingTerms.map((t) => t.key)).toEqual(['gis']);
  });

  it('ignores suggested and dismissed requirements', () => {
    const parsed = parsePosting(read('student-internship')).requirements;
    expect(summarizeCoverage(parsed, resume).confirmedCount).toBe(0);

    const all = confirmAllSuggested(parsed, (r) => r.section !== 'unclassified');
    const withOneDismissed = dismissRequirement(all, all[3].id);
    const summary = summarizeCoverage(withOneDismissed, resume);
    expect(summary.confirmedCount).toBe(all.filter((r) => r.section !== 'unclassified').length - 1);
    expect(
      summary.withEvidenceCount + summary.withoutEvidenceCount + summary.notCheckableCount
    ).toBe(summary.confirmedCount);
  });

  it('carries no score, weight, or percentage', () => {
    const summary = summarizeCoverage(confirmed(['Write SQL queries']), resume);
    expect(Object.keys(summary).sort()).toEqual([
      'confirmedCount',
      'notCheckableCount',
      'partialCount',
      'rows',
      'withEvidenceCount',
      'withoutEvidenceCount',
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/score|weight|percent/i);
  });

  it('counts a requirement covered only through the resume skills list', () => {
    const [row] = summarizeCoverage(confirmed(['Build dashboards in Tableau']), resume).rows;
    expect(row.state).toBe('evidence');
    expect(row.excerpts.every((e) => e.listedOnly)).toBe(true);
  });
});

describe('describeCoverage', () => {
  it('says the count with its denominator', () => {
    const summary = summarizeCoverage(
      confirmed(['Write SQL queries', 'Familiarity with GIS tools', 'Experience with Tableau']),
      resume
    );
    expect(describeCoverage(summary)).toBe(
      '2 of 3 confirmed requirements have evidence in your resume.'
    );
    expect(describeCoverage(summary, 'your letter')).toBe(
      '2 of 3 confirmed requirements have evidence in your letter.'
    );
  });

  it('handles one and none', () => {
    expect(describeCoverage(summarizeCoverage(confirmed(['Write SQL queries']), resume))).toBe(
      '1 of 1 confirmed requirement has evidence in your resume.'
    );
    expect(describeCoverage(summarizeCoverage([], resume))).toBe('No confirmed requirements yet.');
  });
});
