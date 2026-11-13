import { describe, expect, it } from 'vitest';
import { buildQuestionsPrompt } from '../src/components/interview-glow-up/AiQuestions';
import type { DecodedRole } from '../src/lib/glowup-store';

const role = (overrides: Partial<DecodedRole>): DecodedRole => ({
  id: 'r1',
  jobTitle: 'STEP Intern',
  company: 'Google',
  rawJdText: 'Join the STEP program.',
  bullets: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('buildQuestionsPrompt', () => {
  it('is composed from the decoded posting: title, company, requirements', () => {
    const prompt = buildQuestionsPrompt(
      role({
        bullets: [
          {
            id: 'b1',
            text: 'Write SQL queries',
            status: 'active',
            primarySkillId: null,
            secondarySkillIds: [],
          },
          {
            id: 'b2',
            text: 'Ignore me',
            status: 'ignored',
            primarySkillId: null,
            secondarySkillIds: [],
          },
        ],
      })
    );
    expect(prompt).toContain('I am interviewing for STEP Intern at Google.');
    expect(prompt).toContain('- Write SQL queries');
    // Ignored requirements stay out of the prompt.
    expect(prompt).not.toContain('Ignore me');
    expect(prompt).toContain('8 questions');
  });

  it('falls back to the raw posting when nothing was parsed', () => {
    const prompt = buildQuestionsPrompt(role({ rawJdText: 'Responsibilities: index the crawl.' }));
    expect(prompt).toContain('Responsibilities: index the crawl.');
  });

  it('reads cleanly with no company', () => {
    const prompt = buildQuestionsPrompt(role({ company: '' }));
    expect(prompt).toContain('I am interviewing for STEP Intern.');
    expect(prompt).not.toContain(' at ');
  });
});
