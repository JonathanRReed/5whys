import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectSkillsFromText, KEYWORD_CONTEXT, SKILL_BANK } from '../src/lib/glowup-banks';

const skillsOf = (text: string) => detectSkillsFromText(text).map((s) => s.skillId);
const NORTHGATE = readFileSync(
  'tests/fixtures/postings/northgate-operations-coordinator.txt',
  'utf8'
);

describe('keyword boundaries', () => {
  // Every word that stands on its own (no context rule) is found alone and
  // never inside another word: "ts" in "projects", "ai" in "email".
  const plain = SKILL_BANK.flatMap((skill) =>
    [...skill.keywords, ...(skill.tagOnly ?? [])]
      .filter((keyword) => !KEYWORD_CONTEXT[keyword.toLowerCase()])
      .map((keyword) => ({ skill: skill.id, keyword }))
  );

  it.each(plain)('finds "$keyword" for $skill only on word boundaries', ({ skill, keyword }) => {
    for (const text of [keyword, keyword.toUpperCase(), `(${keyword}),`, `${keyword}-based`]) {
      const hit = detectSkillsFromText(text).find((s) => s.skillId === skill);
      expect(hit?.matchedKeywords, `${keyword} in ${JSON.stringify(text)}`).toContain(keyword);
    }
    for (const text of [`x${keyword}x`, `1${keyword}2`, `${keyword}++`, `${keyword}#`]) {
      const hit = detectSkillsFromText(text).find((s) => s.skillId === skill);
      expect(hit?.matchedKeywords ?? [], `${keyword} in ${JSON.stringify(text)}`).not.toContain(
        keyword
      );
    }
  });

  it('finds nothing in an empty line or a line with no listed words', () => {
    expect(detectSkillsFromText('')).toEqual([]);
    expect(detectSkillsFromText('Email projects in HTML, but no listed keywords.')).toEqual([
      { skillId: 'frontend', matchedKeywords: ['html'] },
    ]);
  });

  it('returns at most three skills, most matched words first, then the earliest', () => {
    const result = detectSkillsFromText(
      'Strong leadership, communication, teamwork, problem-solving, and time management.'
    );
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.skillId)).toEqual(['leadership', 'communication', 'teamwork']);
    expect(skillsOf('Used JavaScript, React, SQL, MYSQL, and Python')[0]).toBe('javascript');
  });
});

describe('a phrase beats its parts (career-changer walkthrough)', () => {
  it('tags a warehouse management system as logistics, not leadership', () => {
    const skills = skillsOf(
      'Experience with a warehouse management system (WMS) such as Manhattan, Blue Yonder, or similar'
    );
    expect(skills[0]).toBe('logistics');
    expect(skills).not.toContain('leadership');
  });

  it('tags pivot tables as data analysis, not adaptability', () => {
    const skills = skillsOf('Advanced Excel skills (pivot tables, VLOOKUP/XLOOKUP)');
    expect(skills).toEqual(['data-analysis']);
  });

  it('tags a transportation management system as logistics', () => {
    expect(skillsOf('Experience with a transportation management system (TMS)')).toEqual([
      'logistics',
    ]);
  });
});

describe('ambiguous words need context', () => {
  it.each([
    [
      'Track KPIs (on-time shipping, order accuracy, dock-to-stock time) and prepare weekly reports for leadership',
      'leadership',
    ],
    ['Ability to manage multiple priorities in a fast-paced environment', 'leadership'],
    ['Associate of Applied Science, Business Management', 'leadership'],
    [
      'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads',
      'leadership',
    ],
    ['Available for the Spring 2027 semester', 'java'],
    ['You will help run the weekly mobile pantry', 'mobile'],
    ['We offer a flexible schedule', 'adaptability'],
    ['We offer a flexible schedule', 'scheduling'],
    ['Reduce lead time on orders', 'leadership'],
    ['Must have reliable transportation', 'logistics'],
    ['Support inventory reconciliation and resolve discrepancies with clients', 'ecommerce'],
  ])('"%s" is not tagged %s', (text, skill) => {
    expect(skillsOf(text)).not.toContain(skill);
  });

  it.each([
    ['Lead a team of five cashiers', 'leadership'],
    ['Manage a team of associates on the overnight shift', 'leadership'],
    ['Adapt to change in a growing company', 'adaptability'],
    ['Lean or Six Sigma Yellow Belt', 'operations'],
    ['Schedule and confirm 30 or more volunteers each week', 'scheduling'],
    ['Comfort presenting findings to non-technical teams', 'communication'],
  ])('"%s" is tagged %s', (text, skill) => {
    expect(skillsOf(text)).toContain(skill);
  });
});

describe('operations postings get operations skills', () => {
  it.each([
    [
      'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads',
      ['logistics', 'scheduling', 'vendor-coordination'],
    ],
    [
      'Maintain SOPs and help roll out process improvements across two sites',
      ['process-documentation', 'operations'],
    ],
    [
      'Act as a point of contact for client escalations and own them to resolution',
      ['customer-service'],
    ],
    [
      'Support inventory reconciliation and resolve discrepancies with clients',
      ['inventory', 'customer-service'],
    ],
    ['Prepare meeting agendas, take notes, and follow up on action items', ['administrative']],
    [
      'Track project budgets and purchase orders; flag variances to the project manager',
      ['budgeting', 'vendor-coordination'],
    ],
    [
      'Build and maintain project schedules in Smartsheet and track milestones',
      ['scheduling', 'project-coordination'],
    ],
  ])('"%s"', (text, expected) => {
    const skills = skillsOf(text);
    for (const skill of expected) expect(skills).toContain(skill);
  });

  it('never tags the Northgate posting Retail or Leadership', () => {
    const lines = NORTHGATE.split('\n').filter((line) => line.startsWith('- '));
    for (const line of lines) {
      expect(skillsOf(line), line).not.toContain('ecommerce');
      expect(skillsOf(line), line).not.toContain('leadership');
    }
  });
});
