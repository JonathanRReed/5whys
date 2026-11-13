import { describe, expect, it } from 'vitest';
import {
  ANSWER_RULE,
  isNonAnswer,
  NON_ANSWER_FOLLOW_UP,
  nonAnswerFollowUp,
} from '../src/lib/non-answer';
import { detectResumeStructure } from '../src/lib/resume-game';

describe('a reply that does not count yet says why', () => {
  it('counts down a short reply and keeps the gentle question for a placeholder', () => {
    expect(nonAnswerFollowUp('Organized schedules')).toBe(`Add 1 more word. ${ANSWER_RULE}`);
    expect(nonAnswerFollowUp('Tutoring')).toBe(`Add 2 more words. ${ANSWER_RULE}`);
    expect(nonAnswerFollowUp('idk')).toBe(NON_ANSWER_FOLLOW_UP);
    expect(nonAnswerFollowUp('i dont know')).toBe(NON_ANSWER_FOLLOW_UP);
  });

  it('does not count a held key as words, and still counts real long words', () => {
    expect(isNonAnswer(`${'asdf'.repeat(20)} ${'jkl'.repeat(20)} ${'qwe'.repeat(20)}`)).toBe(true);
    expect(isNonAnswer('Internationalization helps accessibility')).toBe(false);
  });
});

describe('a job title is not an achievement', () => {
  const resume = [
    'Sam Rivera',
    'Experience',
    'Research Assistant, Department of Economics',
    '- Cleaned survey data for 3 faculty studies',
    '- Presented findings to a class of 40 students',
    'Shift Lead | Campus Cafe',
    '- Trained 4 new baristas on opening tasks',
  ].join('\n');

  it('keeps the title lines out of the scored bullets', () => {
    const { bullets } = detectResumeStructure(resume);
    expect(bullets).toHaveLength(3);
    expect(bullets.join(' ')).not.toMatch(/Research Assistant|Shift Lead/);
  });

  it('still scores an unmarked sentence that mentions a title word', () => {
    const { bullets } = detectResumeStructure(
      ['Experience', 'Managed assistant schedules, payroll, and events for a 12 person team.'].join(
        '\n'
      )
    );
    expect(bullets).toHaveLength(1);
  });
});
