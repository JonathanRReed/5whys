import { describe, expect, it } from 'vitest';
import { hiringCondition } from '../src/lib/posting/conditions';

describe('conditions of hiring', () => {
  it.each([
    ['We are unable to sponsor visas for this role', 'work-authorization'],
    ['Must be legally authorized to work in the United States', 'work-authorization'],
    ['US citizenship required', 'citizenship'],
    ['U.S. citizenship required due to federal contract', 'citizenship'],
    ['Must be a U.S. citizen or permanent resident', 'citizenship'],
    ['Citizenship required', 'citizenship'],
    ['Students on CPT/OPT welcome to apply', 'work-authorization'],
    ['F-1 students eligible for CPT may apply', 'work-authorization'],
    ['J-1 visa holders are not eligible', 'work-authorization'],
    ['We do not sponsor H-1B', 'work-authorization'],
    ['Must have a valid Social Security number', 'work-authorization'],
    ['Must provide an SSN at hire', 'work-authorization'],
    ['Must complete Form I-9 on your first day', 'work-authorization'],
    ['Will you now or in the future require sponsorship?', 'work-authorization'],
    ['Candidates must not require sponsorship now or in the future', 'work-authorization'],
    ['Ability to obtain a security clearance', 'security-clearance'],
    ['Native English speaker', 'native-speaker'],
    ['Native speaker of Spanish preferred', 'native-speaker'],
    ['We want a digital native who lives on social media', 'age-coded'],
    ['Join a young, energetic team', 'age-coded'],
    ['Ideal for a young professional', 'age-coded'],
    ['Must be 18 or older', 'minimum-age'],
    ['Must be at least 21 years of age', 'minimum-age'],
    ['Offer is contingent on a background check', 'background-check'],
    ['Must be able to lift 25 pounds and work Saturday mornings', 'physical'],
  ])('reads "%s" as %s', (text, kind) => {
    expect(hiringCondition(text)?.kind).toBe(kind);
  });

  it.each([
    'Comfortable with spreadsheets (Excel or Google Sheets)',
    'Spanish language skills',
    'Experience with sponsorship outreach for events',
    'At least 2 years of experience in customer service',
    'Fluent in English, written and spoken',
    'At least 15 years of experience in logistics',
    '15+ years of progressive leadership experience',
    'Experience organizing people, events, or schedules',
    'Background in biology or a related field',
    'Experience in drug testing procedures',
    'Experience working with young children',
    'Tutored young adults in reading',
    'Conduct background checks for new hires',
    'Knowledge of CPT and ICD-10 coding',
    'Accurate CPT coding for outpatient visits',
    'Opt in to the weekly schedule email',
    'Volunteer with senior citizens at the community center',
    'Plan events for corporate sponsors',
  ])('leaves "%s" as a qualification', (text) => {
    expect(hiringCondition(text)).toBeNull();
  });

  it('never tells the visitor what their own case is', () => {
    for (const text of [
      'Unable to sponsor visas',
      'Native English speaker',
      'Must be 18+',
      'US citizenship required',
      'Students on CPT/OPT welcome to apply',
    ]) {
      const note = hiringCondition(text)?.note ?? '';
      expect(note).not.toMatch(
        /you (?:are|will be) (?:not )?(?:eligible|protected)|illegal|your (?:visa|status) (?:allows|lets|permits)|you (?:can|cannot|may not) work (?:on|with|under)/i
      );
      expect(note).not.toContain('—');
      expect(note).not.toContain('!');
    }
  });

  it('gives citizenship its own note, not one about sponsoring a visa', () => {
    const note = hiringCondition('US citizenship required')?.note ?? '';
    expect(note).toMatch(/citizen/i);
    expect(note).not.toMatch(/would need to sponsor/i);
    expect(note).toMatch(/international student office/);
  });

  it('points students on a visa to the international student office', () => {
    for (const text of ['Students on CPT/OPT welcome to apply', 'We do not sponsor H-1B']) {
      expect(hiringCondition(text)?.note).toMatch(/international student office/);
    }
  });

  it('splits conditions from requirements', async () => {
    const { splitConditions } = await import('../src/lib/posting');
    const items = [
      { text: "Must be at least 18 and have a valid driver's license" },
      { text: 'Experience with Excel' },
      { text: 'Students on CPT/OPT welcome to apply' },
    ];
    const split = splitConditions(items);
    expect(split.requirements.map((r) => r.text)).toEqual(['Experience with Excel']);
    expect(split.conditions).toHaveLength(2);
  });
});

describe('review fixes: money and wrapped lines', () => {
  it('does not accept the same amount in another currency', async () => {
    const { findInventedClaims } = await import('../src/lib/local-ai');
    const source = 'Raised $400 for the student club.';
    expect(findInventedClaims(source, 'Raised €400 for the student club.')).toHaveLength(1);
    expect(findInventedClaims(source, 'Raised 400 dollars for the student club.')).toEqual([]);
    expect(findInventedClaims(source, 'Raised $400 for the club.')).toEqual([]);
    expect(findInventedClaims('Raised 400 for the club.', 'Raised $400 for the club.')).toEqual([]);
  });

  it('joins a line that wraps after a hyphen the same way everywhere', async () => {
    const { joinParts } = await import('../src/lib/resume-doc/layout');
    expect(joinParts(['Led a cross-', 'functional team'])).toBe('Led a cross-functional team');
    expect(joinParts(['Posted three times', 'a week'])).toBe('Posted three times a week');
  });
});
