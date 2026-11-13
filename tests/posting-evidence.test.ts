/**
 * Regression tests from two user-story walkthroughs (a career changer and a
 * student). Every input below is a line they pasted; every expectation is
 * what the engine should have said.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addRequirement,
  analyzeRequirement,
  confirmAllSuggested,
  confirmsByDefault,
  describeCoverage,
  describeParts,
  descriptionReason,
  extractRequirementTerms,
  findNearMisses,
  findRequirementEvidence,
  type PostingRequirement,
  parsePosting,
  parseYears,
  readDocument,
  summarizeCoverage,
  WORK_SYNONYM_GROUPS,
} from '../src/lib/posting';

const read = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'postings', `${name}.txt`), 'utf8');

const changer = read('changer-resume');
const student = read('student-resume');
const today = new Date(2026, 10, 12);

const DEGREE_LINE =
  'Associate of Applied Science, Business Management, Columbus State Community College, 2016';
const OBJECTIVE_LINE =
  'Looking to bring my store operations background to an operations or project coordination role.';
const COACHED_LINE =
  '- Hired, trained, and coached associates; promoted 9 associates into key holder or department lead roles.';
const DC_LINE =
  '- Coordinated with the DC on truck schedules and freight flow; got trucks worked within 6 hours of arrival.';

function evidence(requirement: string, resume = changer) {
  return findRequirementEvidence(requirement, resume, { today });
}

function excerptTexts(requirement: string, resume = changer): string[] {
  return evidence(requirement, resume).excerpts.map((e) => e.text);
}

function confirmed(texts: string[]): PostingRequirement[] {
  return texts.reduce<PostingRequirement[]>((list, text) => addRequirement(list, text), []);
}

describe('false evidence from the career changer walkthrough', () => {
  it('does not credit a warehouse system to a degree in business management', () => {
    const wms =
      'Experience with a warehouse management system (WMS) such as Manhattan, Blue Yonder, or similar';
    const result = evidence(wms);
    expect(result.state).toBe('none');
    expect(result.excerpts).toEqual([]);
    expect(result.kind).toBe('tool');
    expect(extractRequirementTerms(wms).map((t) => t.key)).not.toContain('management');
    // Only the tools or the category phrase count.
    expect(result.terms.map((t) => t.key)).toEqual([
      'warehouse management system',
      'manhattan',
      'blue yonder',
    ]);
    expect(excerptTexts('Experience with a transportation management system (TMS)')).toEqual([]);
  });

  it('still credits the system when a work line names it', () => {
    expect(
      evidence(wms(), '- Picked and staged orders in Manhattan WMS for two retail clients').state
    ).toBe('evidence');
    function wms() {
      return 'Experience with a warehouse management system (WMS) such as Manhattan, Blue Yonder, or similar';
    }
  });

  it('does not credit KPI tracking and weekly reports to coaching associates', () => {
    const kpis =
      'Track KPIs (on-time shipping, order accuracy, dock-to-stock time) and prepare weekly reports for leadership';
    const result = evidence(kpis);
    expect(result.state).toBe('none');
    expect(result.excerpts.map((e) => e.text)).not.toContain(COACHED_LINE);
    expect(result.weakTerms.map((t) => t.key)).toContain('leadership');
    expect(result.parts.map((p) => p.label)).toEqual([
      'Track KPIs (on-time shipping, order accuracy, dock-to-stock time)',
      'prepare weekly reports for leadership',
    ]);
  });

  it('says which part is shown when only one of two things is', () => {
    const result = evidence(
      'Track KPIs (on-time shipping, order accuracy, dock-to-stock time) and prepare weekly reports for leadership',
      '- Prepared weekly sales reports for the district manager'
    );
    expect(result.state).toBe('partial');
    expect(describeParts(result)).toEqual({
      shown: ['prepare weekly reports for leadership'],
      notShown: ['Track KPIs (on-time shipping, order accuracy, dock-to-stock time)'],
    });
  });

  it('never takes a summary or objective sentence as evidence of a tool', () => {
    const result = evidence(
      'Proficiency with Smartsheet, MS Project, or similar project management tools'
    );
    expect(result.state).toBe('none');
    expect(result.excerpts.map((e) => e.text)).not.toContain(OBJECTIVE_LINE);
    expect(excerptTexts('1-3 years of project coordination or related experience')).not.toContain(
      OBJECTIVE_LINE
    );
    expect(excerptTexts('Retail store operations experience')).toEqual([]);
  });

  it('does not match a place name in one line to the same place in another', () => {
    const line = 'Larkfield Brands, Inc. (remote within Ohio, up to 25% travel)';
    expect(extractRequirementTerms(line)).toEqual([]);
    const result = evidence(line);
    expect(result.state).toBe('not-checkable');
    expect(result.excerpts).toEqual([]);
    expect(result.weakTerms.map((t) => t.key)).toEqual(
      expect.arrayContaining(['larkfield', 'brands', 'ohio'])
    );
    expect(
      extractRequirementTerms('Northgate Logistics Partners, Columbus, OH (hybrid, 3 days on site)')
    ).toEqual([]);
  });

  it('never lets a weak word stand alone', () => {
    for (const requirement of [
      'Strong communication skills and attention to detail',
      'Ability to manage multiple priorities in a fast-paced environment',
      'Proven leadership and team management',
      'Excellent written and verbal communication',
    ]) {
      expect(evidence(requirement).state, requirement).toBe('not-checkable');
    }
  });

  it('matches a phrase as a phrase, not as one of its words', () => {
    expect(
      findRequirementEvidence('Warehouse management experience', 'Business Management, 2016').state
    ).toBe('none');
    expect(
      findRequirementEvidence(
        'Warehouse management experience',
        '- Took over warehouse management for the Dublin store'
      ).state
    ).toBe('evidence');
  });

  it('reads education and contact lines as what they are', () => {
    const doc = readDocument(changer);
    const kindOf = (start: string) => doc.lines.find((l) => l.text.startsWith(start))?.kind;
    expect(kindOf('Associate of Applied Science')).toBe('education');
    expect(kindOf('Columbus, OH 43215')).toBe('contact');
    expect(kindOf('Retail store manager')).toBe('summary');
    expect(kindOf('Store Manager, Hartwell')).toBe('title');
    expect(kindOf('- Ran a $14M-volume store')).toBe('experience');
    expect(kindOf('Kronos (UKG)')).toBe('skills');
    expect(kindOf('ServSafe Manager')).toBe('certification');
  });

  it('lets a degree line show a degree, and only a degree', () => {
    const result = evidence(
      "Bachelor's degree in business, supply chain, or related field, or equivalent experience"
    );
    expect(result.state).toBe('partial');
    expect(result.kind).toBe('education');
    expect(describeParts(result)).toEqual({
      shown: ['business or supply chain'],
      notShown: ["Bachelor's degree"],
    });
    expect(result.excerpts[0].text).toBe(DEGREE_LINE);
    expect(result.note).toBe('The posting also accepts equivalent experience.');
    expect(
      evidence(
        "Currently enrolled in a bachelor's degree program in statistics, economics, computer science, or a related field",
        student
      ).state
    ).toBe('evidence');
  });

  it('keeps generic words out of every term', () => {
    for (const requirement of parsePosting(read('changer-operations-coordinator')).requirements) {
      for (const term of extractRequirementTerms(requirement.text)) {
        expect(['management', 'leadership', 'communication'], requirement.text).not.toContain(
          term.key
        );
        for (const word of term.key.split(/[\s-]+/)) {
          expect(['currently', 'enrolled', 'degree', 'program'], term.key).not.toContain(word);
        }
      }
    }
  });
});

describe('missed evidence and alternatives', () => {
  it('reads a years requirement as a number and a list of alternatives', () => {
    expect(
      parseYears(
        '2+ years of experience in operations, logistics, supply chain, or a related field'
      )
    ).toMatchObject({
      min: 2,
      label: '2+ years',
      fields: [{ key: 'operations' }, { key: 'logistics' }, { key: 'supply chain' }],
    });
    expect(parseYears('1-3 years of project coordination or related experience')).toMatchObject({
      min: 1,
      label: '1 to 3 years',
      fields: [{ key: 'project coordination' }],
    });
    expect(parseYears('Must be 18 years or older')).toBeNull();
    expect(parseYears('Must be at least 18 years old')).toBeNull();
  });

  it('counts years from the resume dates and says what it found', () => {
    const result = evidence(
      '2+ years of experience in operations, logistics, supply chain, or a related field'
    );
    expect(result.kind).toBe('years');
    expect(result.state).toBe('partial');
    expect(describeParts(result)).toEqual({
      shown: ['2+ years'],
      notShown: ['experience in operations, logistics, or supply chain'],
    });
    expect(result.note).toBe(
      'Your resume has about 10 years of dated work, but no role names operations, logistics, or supply chain.'
    );
  });

  it('credits years in roles that name the field', () => {
    const resume = [
      'EXPERIENCE',
      'Logistics Coordinator, Acme Freight, Columbus, OH',
      'March 2020 - March 2023',
      '- Scheduled carrier pickups for 40 outbound loads a week',
    ].join('\n');
    const result = evidence('2+ years of experience in logistics or supply chain', resume);
    expect(result.state).toBe('evidence');
    expect(result.note).toBe('About 3 years in roles mentioning logistics.');
    expect(evidence('5+ years of experience in logistics', resume)).toMatchObject({
      state: 'partial',
      note: 'About 3 years in roles mentioning logistics; the posting asks for 5+ years.',
    });
  });

  it('marks years not checkable when no dates can be read, and says why', () => {
    const result = evidence('2+ years of experience in logistics', student);
    expect(result.state).toBe('not-checkable');
    expect(result.note).toMatch(/^No date ranges/);
  });

  it('accepts any one of the alternatives', () => {
    expect(evidence('Experience with Power BI or Tableau', student).state).toBe('evidence');
    expect(
      evidence('Familiarity with inventory or logistics software', '- Ran inventory software daily')
        .state
    ).toBe('evidence');
    expect(evidence('Spanish or another second language would be helpful', student).state).toBe(
      'evidence'
    );
  });

  it('finds the line that says the same work in other words', () => {
    const requirement =
      'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads';
    expect(evidence(requirement).state).toBe('none');
    const misses = findNearMisses(requirement, changer, { today });
    expect(misses[0].text).toBe(DC_LINE);
    expect(changer.slice(misses[0].start, misses[0].end)).toBe(DC_LINE);
    expect(misses[0].postingTerms).toEqual(
      expect.arrayContaining(['outbound shipment schedules', 'warehouse leads'])
    );
    expect(misses.length).toBeLessThanOrEqual(2);
  });

  it('offers the cycle count line for inventory reconciliation', () => {
    const [miss] = findNearMisses(
      'Support inventory reconciliation and resolve discrepancies with clients',
      changer,
      { today }
    );
    expect(miss.text).toMatch(/cycle count routine/);
    expect(miss.postingTerms).toContain('inventory reconciliation');
  });

  it('offers store freight lines for a logistics years requirement', () => {
    const misses = findNearMisses(
      '2+ years of experience in operations, logistics, supply chain, or a related field',
      changer,
      { today }
    );
    expect(misses.map((m) => m.text)).toContain(DC_LINE);
    expect(misses[0].postingTerms).toContain('logistics');
  });

  it('prefers nothing to nonsense', () => {
    // A tool is used or it is not; no line says it "in other words".
    expect(
      findNearMisses(
        'Proficiency with Smartsheet, MS Project, or similar project management tools',
        changer
      )
    ).toEqual([]);
    // Lines that only repeat the requirement's own words are not near misses.
    expect(findNearMisses('Answer calls and emails from drivers and customers', student)).toEqual(
      []
    );
    expect(
      findNearMisses(
        'Track KPIs (on-time shipping, order accuracy, dock-to-stock time) and prepare weekly reports for leadership',
        changer
      )
    ).toEqual([]);
    expect(findNearMisses('Strong communication skills and attention to detail', changer)).toEqual(
      []
    );
  });

  it('never counts a near miss as evidence', () => {
    const summary = summarizeCoverage(
      confirmed([
        'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads',
        'Advanced Excel skills (pivot tables, VLOOKUP/XLOOKUP)',
      ]),
      changer,
      { today }
    );
    expect(summary.rows[0].state).toBe('none');
    expect(summary.rows[0].nearMisses.length).toBeGreaterThan(0);
    expect(summary.rows[1].nearMisses).toEqual([]);
    expect(describeCoverage(summary)).toBe(
      '1 of 2 confirmed requirements has evidence in your resume.'
    );
  });

  it('authors at least 60 groups of everyday work words across settings', () => {
    expect(WORK_SYNONYM_GROUPS.length).toBeGreaterThanOrEqual(60);
    const words = new Set(WORK_SYNONYM_GROUPS.flatMap((g) => g.words));
    for (const word of [
      'freight',
      'truck',
      'roster',
      'guest',
      'dashboard',
      'onboard',
      'cycle count',
      'supplier',
      'register',
      'servsafe',
      'tutor',
      'front desk',
      'volunteer',
      'invoice',
    ]) {
      expect(words, word).toContain(word);
    }
    const ids = WORK_SYNONYM_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('coverage for the career changer, row by row', () => {
  function rows(posting: string) {
    const parsed = parsePosting(read(posting));
    return summarizeCoverage(
      confirmAllSuggested(parsed.requirements, () => true),
      changer,
      {
        today,
      }
    );
  }

  it('reads the operations coordinator posting honestly', () => {
    const summary = rows('changer-operations-coordinator');
    expect(describeCoverage(summary)).toBe(
      '1 of 16 confirmed requirements has evidence in your resume.'
    );
    const states = Object.fromEntries(summary.rows.map((r) => [r.requirement.text, r.state]));
    expect(states).toEqual({
      'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads':
        'none',
      'Track KPIs (on-time shipping, order accuracy, dock-to-stock time) and prepare weekly reports for leadership':
        'none',
      'Maintain SOPs and help roll out process improvements across two sites': 'none',
      'Support inventory reconciliation and resolve discrepancies with clients': 'none',
      'Act as a point of contact for client escalations and own them to resolution': 'none',
      'Assist with onboarding new clients, including setting up item masters in the WMS': 'none',
      '2+ years of experience in operations, logistics, supply chain, or a related field':
        'partial',
      "Bachelor's degree in business, supply chain, or related field, or equivalent experience":
        'partial',
      'Advanced Excel skills (pivot tables, VLOOKUP/XLOOKUP)': 'evidence',
      'Experience with a warehouse management system (WMS) such as Manhattan, Blue Yonder, or similar':
        'none',
      'Strong communication skills and attention to detail': 'not-checkable',
      'Ability to manage multiple priorities in a fast-paced environment': 'not-checkable',
      'Experience with a transportation management system (TMS)': 'none',
      'Lean or Six Sigma Yellow Belt': 'none',
      'Experience with Power BI or Tableau': 'none',
      'Familiarity with EDI transactions': 'none',
    });
    expect(summary).toMatchObject({
      confirmedCount: 16,
      withEvidenceCount: 1,
      partialCount: 2,
      withoutEvidenceCount: 13,
      notCheckableCount: 2,
    });
    const excel = summary.rows.find((r) => r.requirement.text.startsWith('Advanced Excel'));
    expect(excel?.excerpts[0].listedOnly).toBe(false);
  });

  it('reads the project coordinator posting honestly', () => {
    const summary = rows('changer-project-coordinator');
    expect(describeCoverage(summary)).toBe(
      '1 of 13 confirmed requirements has evidence in your resume.'
    );
    const evidenced = summary.rows.filter((r) => r.state === 'evidence');
    expect(evidenced.map((r) => r.requirement.text)).toEqual([
      'Proficient in Microsoft Office, especially Excel',
    ]);
    for (const row of summary.rows) {
      for (const excerpt of row.excerpts) {
        expect(excerpt.text).not.toBe(OBJECTIVE_LINE);
        expect(excerpt.text).not.toMatch(/^Mid-Ohio Food Collective/);
      }
    }
  });
});

describe('non-requirements set aside', () => {
  it('ends the Preferred list at the blank line before the deadline', () => {
    const parsed = parsePosting(read('student-operations-intern'));
    const texts = parsed.requirements.map((r) => r.text);
    expect(texts).not.toContain('Application closes November 13 at 11:59 PM.');
    expect(texts).not.toContain('Applications reviewed on a rolling basis.');
    expect(parsed.requirements.filter((r) => r.section === 'preferred').map((r) => r.text)).toEqual(
      [
        'Experience with data entry',
        'Customer service experience',
        'Familiarity with inventory or logistics software',
      ]
    );
    const reasons = Object.fromEntries(parsed.setAside.map((s) => [s.text, s.reason]));
    expect(reasons['Application closes November 13 at 11:59 PM.']).toBe('application-logistics');
    expect(reasons['Applications reviewed on a rolling basis.']).toBe('application-logistics');
    expect(reasons['Harbor Freight Logistics is a mid-size logistics company.']).toBe(
      'company-description'
    );
    expect(reasons['This is a paid 10-week summer internship.']).toBe('company-description');
    expect(parsed.requirements).toHaveLength(12);
  });

  it('sets aside the header, company, role summary, and pitch lines of the changer postings', () => {
    const ops = parsePosting(read('changer-operations-coordinator'));
    const opsReasons = Object.fromEntries(ops.setAside.map((s) => [s.text, s.reason]));
    expect(opsReasons['Northgate Logistics Partners, Columbus, OH (hybrid, 3 days on site)']).toBe(
      'header-line'
    );
    expect(
      opsReasons[
        'Northgate is a growing third-party logistics provider serving retail and consumer goods brands.'
      ]
    ).toBe('company-description');
    expect(
      opsReasons['The Operations Coordinator keeps our warehouse and transportation teams moving.']
    ).toBe('role-summary');
    expect(
      opsReasons['You will be the glue between the floor, our carriers, and our account managers.']
    ).toBe('pitch');
    expect(ops.requirements.every((r) => r.section !== 'unclassified')).toBe(true);
    // Vague phrases still come from the whole posting.
    expect(ops.vaguePhrases.map((v) => v.id)).toEqual(
      expect.arrayContaining(['self-starter', 'fast-paced', 'many-hats'])
    );

    const pc = parsePosting(read('changer-project-coordinator'));
    const pcReasons = Object.fromEntries(pc.setAside.map((s) => [s.text, s.reason]));
    expect(pcReasons['Larkfield Brands, Inc. (remote within Ohio, up to 25% travel)']).toBe(
      'header-line'
    );
    expect(
      pcReasons[
        'As Project Coordinator you will support project managers in delivering store remodel and rollout projects on time and on budget.'
      ]
    ).toBe('role-summary');
    expect(
      pcReasons[
        'This is a great opportunity for a rockstar who is passionate about retail and ready to hit the ground running.'
      ]
    ).toBe('pitch');
    expect(pc.requirements.every((r) => r.section !== 'unclassified')).toBe(true);
    expect(pc.vaguePhrases.map((v) => v.id)).toEqual(
      expect.arrayContaining(['rockstar', 'hit-the-ground-running'])
    );
  });

  it('keeps a section open across the blank line right after its heading', () => {
    const parsed = parsePosting('Requirements\n\nMust be 18 or older to apply.\n');
    expect(parsed.requirements.map((r) => [r.text, r.section])).toEqual([
      ['Must be 18 or older to apply.', 'required'],
    ]);
  });

  it('names why a line with no heading or cue is not a requirement', () => {
    expect(descriptionReason('Northgate is a growing third-party logistics provider.')).toBe(
      'company-description'
    );
    expect(descriptionReason('You will be the glue between the floor and our carriers.')).toBe(
      'pitch'
    );
    expect(descriptionReason('Answer phones and greet visitors at the front desk.')).toBeNull();
    expect(descriptionReason('Experience with Excel and SQL')).toBeNull();
  });

  it('still returns an unsorted line that reads as a duty', () => {
    const parsed = parsePosting('Answer phones and greet visitors at the front desk.');
    expect(parsed.requirements.map((r) => r.section)).toEqual(['unclassified']);
  });
});

describe('review status', () => {
  it('confirms only required and preferred requirements by default', () => {
    const parsed = parsePosting(read('changer-project-coordinator'));
    const next = confirmAllSuggested(parsed.requirements);
    for (const r of next) {
      expect(r.status, r.text).toBe(confirmsByDefault(r) ? 'confirmed' : 'suggested');
    }
    expect(
      next.filter((r) => r.section === 'responsibility').every((r) => r.status === 'suggested')
    ).toBe(true);
    expect(
      confirmAllSuggested(parsed.requirements, () => true).every((r) => r.status === 'confirmed')
    ).toBe(true);
  });

  it('analyzes without a score, weight, or percentage', () => {
    const analysis = analyzeRequirement(
      '2+ years of experience in operations, logistics, supply chain, or a related field'
    );
    const summary = summarizeCoverage(
      confirmed([
        '2+ years of experience in operations, logistics, supply chain, or a related field',
      ]),
      changer,
      { today }
    );
    expect(JSON.stringify({ analysis, summary })).not.toMatch(/score|weight|percent/i);
  });
});
