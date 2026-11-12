import { describe, expect, it } from 'vitest';
import { hiringCondition } from '../src/lib/posting/conditions';

describe('conditions of hiring', () => {
  it.each([
    ['We are unable to sponsor visas for this role', 'work-authorization'],
    ['Must be legally authorized to work in the United States', 'work-authorization'],
    ['US citizenship required', 'work-authorization'],
    ['Ability to obtain a security clearance', 'security-clearance'],
    ['Native English speaker', 'native-speaker'],
    ['Native speaker of Spanish preferred', 'native-speaker'],
    ['We want a digital native who lives on social media', 'age-coded'],
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
  ])('leaves "%s" as a qualification', (text) => {
    expect(hiringCondition(text)).toBeNull();
  });

  it('never tells the visitor what their own case is', () => {
    for (const text of ['Unable to sponsor visas', 'Native English speaker', 'Must be 18+']) {
      const note = hiringCondition(text)?.note ?? '';
      expect(note).not.toMatch(/you (?:are|will be) (?:not )?(?:eligible|protected)|illegal/i);
      expect(note).not.toContain('—');
    }
  });
});
