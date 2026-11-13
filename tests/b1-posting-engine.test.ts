import { describe, expect, it } from 'vitest';
import {
  findNearMisses,
  findRequirementEvidence,
  hiringCondition,
  parsePosting,
} from '../src/lib/posting';
import { fieldOf, fieldSignIn } from '../src/lib/posting/field-signs';

const today = new Date('2026-11-13T12:00:00');

const MARCUS = `Marcus Bell
Riverside, CA | marcus.bell.student@example.com
Education
Inland Valley Community College, Associate in Business Administration, expected May 2027
Experience
Cashier, Valley Fresh Market, Aug 2023 - Present
- Responsible for helping customers
- Handled the cash register and counted the drawer
- Stocked shelves and did other tasks when needed
Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present
- In charge of club money
- Helped plan events and fundraisers
Skills
Excel, customer service, teamwork, hard worker`;

const RENEE = `RENEE ALVARADO
Dayton, OH | renee@example.com

SUMMARY
Dedicated retail store manager with 11 years of experience in fast-paced environments.

EXPERIENCE

Store Manager, Brightline Home Goods, Dayton, OH
March 2018 - February 2026
- Responsible for managing the daily operations of the store
- Managed a team of 22 associates and 3 assistant managers
- Created weekly schedules for all staff
- Trained new hires on policies and the point of sale system

Assistant Store Manager, Brightline Home Goods, Springfield, OH
June 2015 - February 2018
- Duties included scheduling, payroll entry, and shrink reports

EDUCATION AND CERTIFICATES
Google Data Analytics Professional Certificate, Coursera, completed August 2026`;

const evidence = (requirement: string, resume: string) =>
  findRequirementEvidence(requirement, resume, { today });

describe('qualification evidence reads what the resume plainly says', () => {
  it('accepts an associate program when the posting takes associate or bachelor', () => {
    const result = evidence(
      "Currently enrolled in an associate or bachelor's program in business, supply chain, or a related field",
      MARCUS
    );
    expect(result.state).toBe('evidence');
    expect(result.parts[0].label).toBe("associate or bachelor's degree");
    expect(result.parts[0].shown).toBe(true);
  });

  it('does not take a sales associate job as an associate degree', () => {
    const result = evidence(
      "Associate or bachelor's degree in business",
      'Experience\nSales Associate, Corner Market, 2022 - 2024\n- Ran the register'
    );
    expect(result.parts[0].shown).toBe(false);
  });

  it('reads retail from a job title and says which word it read', () => {
    const result = evidence('Experience in retail, food service, or a warehouse', MARCUS);
    expect(result.state).toBe('evidence');
    expect(result.excerpts[0].text).toMatch(/^Cashier, Valley Fresh Market/);
    expect(result.note).toBe(
      'Read as retail from the word "Cashier" in "Cashier, Valley Fresh Market, Aug 2023 - Present".'
    );
  });

  it('reads retail operations from "Store Manager", never from the summary', () => {
    const result = evidence('Experience in healthcare or retail operations', RENEE);
    expect(result.state).toBe('evidence');
    expect(result.excerpts[0].text).toMatch(/^Store Manager/);
    expect(result.excerpts.map((e) => e.text)).not.toContainEqual(
      expect.stringMatching(/^Dedicated/)
    );
  });

  it('counts the years of a role whose title places it in the field', () => {
    const result = evidence('2+ years of retail experience', RENEE);
    expect(result.state).toBe('evidence');
    expect(result.note).toMatch(/Read as retail from the word "Store"/);
  });

  it('reads "coordinating schedules" from schedules the person made', () => {
    const result = evidence(
      '3 or more years of experience coordinating schedules, vendors, or teams',
      RENEE
    );
    expect(result.state).toBe('evidence');
    expect(result.excerpts[0].text).toMatch(/schedul/i);
  });

  it('a field sign is only a title, and never a word inside another word', () => {
    expect(fieldSignIn('Marketing Intern, Bright Agency', 'retail')).toBeNull();
    expect(fieldSignIn('Market Research Analyst, Polaris', 'retail')).toBeNull();
    expect(fieldSignIn('Server, Blue Plate Diner', 'food service')?.word).toBe('Server');
    expect(fieldSignIn('Server Administrator, IT Help Desk', 'food service')).toBeNull();
    expect(fieldOf('operations')).toBeNull();
    expect(fieldOf('retail operations')).toBe('retail');
    // A duty line that mentions a store is not a title.
    const result = evidence(
      'Experience in retail',
      'Experience\nTutor, Westside Library, 2023 - 2025\n- Walked students to the store for supplies'
    );
    expect(result.state).toBe('none');
  });

  it('keeps a named qualifier: "Trained new hires" is not Lean or Six Sigma training', () => {
    const result = evidence('Lean or Six Sigma training', RENEE);
    expect(result.state).toBe('none');
    expect(result.parts[0].label).toBe('Lean or Six Sigma');
    expect(
      evidence('Lean or Six Sigma training', `${RENEE}\n- Completed Six Sigma training`).state
    ).toBe('evidence');
  });

  it('offers a counted drawer as a line that may show care with numbers', () => {
    const misses = findNearMisses('Reliable attention to detail with numbers and records', MARCUS, {
      today,
    });
    expect(misses[0]?.text).toMatch(/counted the drawer/);
    // Offered, never counted.
    expect(evidence('Reliable attention to detail with numbers and records', MARCUS).state).toBe(
      'none'
    );
  });
});

describe('the posting sorter', () => {
  const benefits = `Benefits Coordinator

Requirements:
- Experience processing health insurance claims
- Experience administering paid time off policies

Responsibilities:
- Conduct background checks for new hires
- Help customers compare dental insurance plans

What we offer:
- Health insurance, dental insurance, and paid time off
- Enjoy a 401(k) match

All offers are contingent on a background check. We are an equal opportunity employer.`;

  it('keeps work on benefits and checks, and sets the benefits themselves aside', () => {
    const parsed = parsePosting(benefits);
    const texts = parsed.requirements.map((r) => r.text);
    expect(texts).toEqual([
      'Experience processing health insurance claims',
      'Experience administering paid time off policies',
      'Conduct background checks for new hires',
      'Help customers compare dental insurance plans',
    ]);
    const aside = parsed.setAside.map((s) => s.text.trim());
    expect(aside).toContain('Health insurance, dental insurance, and paid time off');
    expect(aside).toContain('All offers are contingent on a background check.');
  });

  it('keeps "We do not sponsor visas" as a condition, not a line about the employer', () => {
    const parsed = parsePosting(
      'Operations Intern\n\nOther\n- Must be at least 18 years old and authorized to work in the United States. We do not sponsor visas for this role.\n- Must pass a background check.'
    );
    const visa = parsed.requirements.find((r) => /sponsor/.test(r.text));
    expect(visa?.section).toBe('required');
    expect(hiringCondition(visa?.text ?? '')?.noSponsorship).toBe(true);
  });
});

describe('work authorization and sponsorship are told apart', () => {
  it('says what a no-sponsorship line means for the reader, briefly', () => {
    for (const line of [
      'We are unable to sponsor or take over sponsorship of an employment visa at this time.',
      'Must be authorized to work in the United States without sponsorship.',
      'Sponsorship is not available for this role.',
    ]) {
      const condition = hiringCondition(line);
      expect(condition?.kind).toBe('work-authorization');
      expect(condition?.noSponsorship, line).toBe(true);
      expect(condition?.note).toMatch(/will not sponsor/);
      expect(condition?.note).toMatch(/ask the recruiter/);
    }
  });

  it('keeps the glossary out of the per-line note', () => {
    const condition = hiringCondition('Must be legally authorized to work in the United States.');
    expect(condition?.noSponsorship).toBeUndefined();
    expect(condition?.note).not.toMatch(/F-1/);
    expect(condition?.about).toMatch(/F-1, J-1, and H-1B/);
  });
});
