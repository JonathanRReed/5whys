/**
 * "This might be the same work": bridges between a posting duty and a resume
 * line that describe the same kind of work in other words, from the career
 * changer review (finding 4). A bridge is a note, never evidence, and never
 * offers a tool or credential the line does not have.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  confirmAllSuggested,
  findNearMisses,
  parsePosting,
  summarizeCoverage,
} from '../src/lib/posting';

const today = new Date(2026, 10, 13);
const resume = readFileSync('tests/fixtures/changer-docx/two-column-skills.txt', 'utf8');
const posting = readFileSync(
  'tests/fixtures/changer-docx/project-coordinator-healthcare.txt',
  'utf8'
);

function bridges(requirement: string, text = resume) {
  return findNearMisses(requirement, text, { today }).map((miss) => ({
    line: miss.text.replace(/^-\s*/, ''),
    terms: miss.postingTerms,
  }));
}

const one = (line: string) => `Jordan Lee\nEXPERIENCE\n- ${line}`;

describe('the reviewer posting and two-column resume', () => {
  it('bridges go-live readiness to the WMS rollout', () => {
    const found = bridges('Support training and go-live readiness for frontline staff');
    expect(found).toContainEqual({
      line: 'Led rollout of Manhattan WMS cycle counting, cutting inventory variance from 2.1% to 0.4% in 9 months',
      terms: ['go-live readiness'],
    });
  });

  it('bridges budgets to food cost', () => {
    expect(
      bridges('Track budgets and purchase orders and flag variances to the project manager')
    ).toContainEqual({
      line: 'Negotiated with food vendors, cut food cost from 34% to 29%',
      terms: ['budgets'],
    });
  });

  it('bridges status meetings to safety meetings', () => {
    expect(
      bridges(
        'Schedule and run weekly status meetings; take notes and track action items to closure'
      )
    ).toContainEqual({
      line: 'Ran safety meetings and investigated incidents; site went 600 days without a lost-time injury',
      terms: ['status meetings'],
    });
  });

  it('bridges vendors to carriers and clients', () => {
    expect(
      bridges(
        'Work with clinical managers, IT, facilities, and vendors to resolve issues and remove blockers'
      )
    ).toContainEqual({
      line: 'Coordinated with carriers and three client accounts on daily shipping cutoffs',
      terms: ['vendors'],
    });
  });

  it('bridges milestones to shipping cutoffs', () => {
    expect(
      bridges(
        'Coordinate project timelines, milestones, and deliverables across multiple concurrent projects'
      )
    ).toContainEqual({
      line: 'Coordinated with carriers and three client accounts on daily shipping cutoffs',
      terms: ['project timelines', 'milestones'],
    });
  });

  it('never offers the tools the posting names', () => {
    const found = bridges(
      'Maintain project plans, RAID logs, and status reports in Smartsheet and Microsoft Project'
    );
    for (const bridge of found) {
      expect(bridge.terms.join(' ')).not.toMatch(/Smartsheet|Microsoft|RAID/);
    }
    expect(bridges('CAPM or PMP certification')).toEqual([]);
    expect(bridges('Familiarity with Epic or another electronic health record')).toEqual([]);
  });

  it('keeps bridges out of the evidence count', () => {
    const parsed = parsePosting(posting);
    const summary = summarizeCoverage(
      confirmAllSuggested(parsed.requirements, () => true),
      resume,
      { today }
    );
    const maybe = summary.rows.filter((row) => row.nearMisses.length > 0);
    expect(maybe.length).toBeGreaterThanOrEqual(5);
    for (const row of maybe) expect(row.state === 'none' || row.state === 'partial').toBe(true);
    expect(summary.withEvidenceCount).toBe(3);
  });

  it('never bridges from the skills sidebar', () => {
    const parsed = parsePosting(posting);
    const summary = summarizeCoverage(
      confirmAllSuggested(parsed.requirements, () => true),
      resume,
      { today }
    );
    const lines = summary.rows.flatMap((row) => row.nearMisses.map((miss) => miss.text));
    for (const skill of ['Inventory Control', 'Vendor Relations', 'Training & Coaching']) {
      expect(lines.some((line) => line.includes(skill))).toBe(false);
    }
  });
});

describe('bridges in other fields', () => {
  it.each([
    [
      'teaching',
      'Develop training materials and deliver onboarding sessions for new employees',
      'Wrote lesson plans for 5 sections of 9th grade English',
      'training materials',
    ],
    [
      'teaching',
      'Create assessments to measure training effectiveness',
      'Built rubrics and graded projects for 5 classes',
      'assessments',
    ],
    [
      'caregiving',
      'Coordinate patient care plans with clinical staff',
      'Wrote and followed service plans for 3 residents with dementia',
      'patient care plans',
    ],
    [
      'military',
      'Maintain inventory of equipment and supplies',
      'Managed a hand receipt for $2M of unit equipment with zero losses',
      'inventory',
    ],
    [
      'food service',
      'Schedule and run weekly status meetings',
      'Led pre-shift line-ups for a 12-person crew',
      'status meetings',
    ],
    [
      'food service',
      'Track budgets and flag variances',
      'Managed food cost and labor for a 90-seat restaurant',
      'budgets',
    ],
    [
      'retail',
      'Restock shelves and keep the sales floor clean',
      'Ran the freight and receiving side of the store: 3 trucks a week, inventory counts',
      'Restock shelves',
    ],
  ])('%s: %s', (_field, requirement, line, term) => {
    const [bridge] = bridges(requirement, one(line));
    expect(bridge?.line).toBe(line);
    expect(bridge?.terms).toContain(term);
  });

  it('does not bridge on a shared object or a broad word alone', () => {
    for (const [requirement, line] of [
      ['Provide excellent customer service', 'Greeted guests and answered questions'],
      ['Coordinate project timelines and milestones', 'Arrived on time for every shift'],
      ['Enter and verify shipment data in our tracking system', 'Unloaded 3 trucks a week'],
      [
        'Lead walking tours of campus for prospective students and their families',
        'Coordinated with carriers and client accounts',
      ],
      [
        'Act as a point of contact for client escalations',
        'Coordinated with carriers and three client accounts',
      ],
      ['Assist with onboarding new clients', 'Trained three new cashiers on the register'],
      ['Schedule and run weekly status meetings', 'Helped with various projects as needed'],
    ]) {
      expect(bridges(requirement, one(line)), `${requirement} / ${line}`).toEqual([]);
    }
  });

  it('does not bridge a line that only lists or plans', () => {
    expect(
      bridges(
        'Support go-live readiness for frontline staff',
        one('Plan to learn about system rollouts')
      )
    ).toEqual([]);
    expect(
      bridges(
        'Support go-live readiness for frontline staff',
        'Jordan Lee\nSKILLS\n- Rollout planning\n- Budgets'
      )
    ).toEqual([]);
  });

  it('never offers a credential the line does not have', () => {
    const found = bridges(
      'Maintain OSHA compliance and safety training records',
      one('Ran safety meetings for 40 associates')
    );
    for (const bridge of found) expect(bridge.terms.join(' ')).not.toMatch(/OSHA/);
  });
});
