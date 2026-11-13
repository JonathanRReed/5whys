import { describe, expect, it } from 'vitest';
import { sortApplications } from '../src/lib/applications';
import { findRequirementEvidence } from '../src/lib/posting';
import { detectResumeStructure } from '../src/lib/resume-game';
import { extractSkills } from '../src/lib/resume-game/skills';
import { isCareerBreak } from '../src/lib/resume-game/structure';

const today = new Date('2026-11-13T12:00:00');

describe('a title line is told apart from an action clause', () => {
  it('scores work whose first clause ends in a title word', () => {
    for (const line of [
      'Supported manager, organized files and answered calls',
      'Assisted lead developer, reviewing code and writing tests',
    ]) {
      expect(detectResumeStructure(`Experience\n${line}`).bullets, line).toHaveLength(1);
    }
  });

  it('still reads a title and a place as a title', () => {
    const { bullets } = detectResumeStructure(
      [
        'Experience',
        'Research Assistant, Department of Economics',
        'Certified Nursing Assistant, Mercy Hospital',
        '- Recorded vitals for patients on a 20 bed ward',
      ].join('\n')
    );
    expect(bullets).toHaveLength(1);
  });
});

describe('caring for people as a job is work, not a career break', () => {
  it('scores childcare and patient care', () => {
    for (const line of [
      'Cared for 12 children at summer camp, keeping everyone safe',
      'Caregiver for 3 elderly residents at Sunrise home',
      'Cared for children in the toddlers classroom every weekday',
    ]) {
      expect(isCareerBreak(line), line).toBe(false);
      expect(detectResumeStructure(`Experience\n- ${line}`).bullets, line).toHaveLength(1);
    }
  });

  it('still reads a break as a break', () => {
    for (const line of [
      'Full-time caregiver for a parent after surgery',
      'Cared for my two children while they were small',
      'Career break to relocate',
    ]) {
      expect(isCareerBreak(line), line).toBe(true);
    }
  });
});

describe('customer service is a skill unless it names another team', () => {
  it('keeps it when the visitor did it or listed it', () => {
    for (const text of [
      'Provided sales and customer service at the front counter',
      'Skills: Communication and customer service',
    ]) {
      expect(extractSkills(text).soft, text).toContain('customer service');
    }
  });

  it('leaves it out when it is a department worked with', () => {
    for (const text of [
      'Worked closely with drivers and customer service to fix late orders',
      'Passed returns to the customer service desk',
    ]) {
      expect(extractSkills(text).soft, text).not.toContain('customer service');
    }
  });
});

describe('years of management need a title that says so', () => {
  const requirement = 'At least 2 years of retail management experience';
  it('does not count a cashier job', () => {
    const resume = `Sam Rivera\n\nEXPERIENCE\n\nCashier, Valley Fresh Market | Jan 2021 - Jan 2024\n- Ran a register on weekends`;
    expect(findRequirementEvidence(requirement, resume, { today }).state).not.toBe('evidence');
  });

  it('counts a store manager job', () => {
    const resume = `Renee Park\n\nEXPERIENCE\n\nStore Manager, Brightline Home Goods | March 2018 - February 2026\n- Managed a team of 22 associates`;
    expect(findRequirementEvidence(requirement, resume, { today }).state).toBe('evidence');
  });
});

describe('an offer in hand is never sorted behind drafts', () => {
  it('keeps a sent application with an offer in the group that needs attention', () => {
    const order = sortApplications(
      [
        { id: 'draft-a', daysUntil: null, updatedAt: 3, sentOn: null },
        { id: 'draft-b', daysUntil: null, updatedAt: 2, sentOn: null },
        { id: 'offer', daysUntil: 0, updatedAt: 1, sentOn: '2026-11-01', offerReceived: true },
        { id: 'sent', daysUntil: null, updatedAt: 4, sentOn: '2026-11-02' },
      ],
      null
    ).map((app) => app.id);
    expect(order[0]).toBe('offer');
    expect(order[order.length - 1]).toBe('sent');
  });
});

describe("a posting's pay is the applicant's, not money the job handles", () => {
  it('passes over business spending to the salary line', async () => {
    const { readPostingPay } = await import('../src/lib/pay/posting-pay');
    const pay = readPostingPay(
      'Manage $200,000 per year in marketing spend.\nSalary: $44,000 per year'
    );
    expect(pay?.basePay).toBe(44000);
    expect(pay?.payPeriod).toBe('year');
    expect(pay?.quotes).toEqual(['Salary: $44,000 per year']);
  });

  it('reads nothing when only business money is written', async () => {
    const { readPostingPay } = await import('../src/lib/pay/posting-pay');
    expect(readPostingPay('Own a budget of $30,000 per month for events.')).toBeNull();
    expect(readPostingPay('$15.00/hr | 15-25 hrs/week')?.basePay).toBe(15);
  });
});
