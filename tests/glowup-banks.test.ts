import { describe, expect, it } from 'vitest';
import {
  getGeneralQuestions,
  getQuestionById,
  getQuestionsForSkill,
  QUESTION_BANK,
  QUESTION_MAP,
  resolveQuestionText,
} from '../src/lib/glowup-banks';

describe('glowup-banks question bank lookups', () => {
  it('pre-indexes all questions into QUESTION_MAP', () => {
    expect(QUESTION_MAP.size).toBe(QUESTION_BANK.length);
    for (const question of QUESTION_BANK) {
      expect(QUESTION_MAP.get(question.id)).toBe(question);
    }
  });

  it('retrieves questions by ID using getQuestionById in O(1) map lookup', () => {
    const qIntro = getQuestionById('q-intro');
    expect(qIntro).toBeDefined();
    expect(qIntro?.text).toBe('Tell me about yourself.');

    const qPyProject = getQuestionById('q-py-project');
    expect(qPyProject).toBeDefined();
    expect(qPyProject?.category).toBe('technical');

    expect(getQuestionById('non-existent-id')).toBeUndefined();
  });

  it('retrieves questions by skill ID using getQuestionsForSkill', () => {
    const pythonQuestions = getQuestionsForSkill('python');
    expect(pythonQuestions.length).toBeGreaterThan(0);
    expect(pythonQuestions.every((q) => q.skillIds.includes('python'))).toBe(true);

    const leadershipQuestions = getQuestionsForSkill('leadership');
    expect(leadershipQuestions.length).toBeGreaterThan(0);
    expect(leadershipQuestions.every((q) => q.skillIds.includes('leadership'))).toBe(true);

    expect(getQuestionsForSkill('non-existent-skill')).toEqual([]);
  });

  it('retrieves general questions using getGeneralQuestions', () => {
    const generalQuestions = getGeneralQuestions();
    expect(generalQuestions.length).toBeGreaterThan(0);
    expect(generalQuestions.every((q) => q.skillIds.includes('general'))).toBe(true);
  });

  it('resolves question IDs and custom text strings using resolveQuestionText', () => {
    expect(resolveQuestionText('q-intro')).toBe('Tell me about yourself.');
    const customPrompt = 'How do you handle unexpected production outages?';
    expect(resolveQuestionText(customPrompt)).toBe(customPrompt);
  });
});


it('returns independent skill lists so callers cannot mutate the question bank index', () => {
  const expected = QUESTION_BANK.filter((question) => question.skillIds.includes('general'));
  const first = getGeneralQuestions();
  first.splice(0, first.length);
  expect(getGeneralQuestions()).toEqual(expected);
});
