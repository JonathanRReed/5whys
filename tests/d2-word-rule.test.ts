import { afterEach, describe, expect, it } from 'vitest';
import {
  ANSWER_RULE,
  answerWordCount,
  isNonAnswer,
  isRealAnswer,
  nonAnswerFollowUp,
  setWordBreakerForTests,
} from '../src/lib/non-answer';

afterEach(() => setWordBreakerForTests(true));

describe('the answer rule counts words in any language', () => {
  it('counts a Chinese sentence written without spaces', () => {
    expect(answerWordCount('我喜歡用數據幫助醫院的病人')).toBeGreaterThanOrEqual(3);
    expect(isRealAnswer('我喜歡用數據幫助醫院的病人')).toBe(true);
  });

  it('counts Japanese and Thai, which also skip spaces', () => {
    expect(isRealAnswer('データ分析が好きです')).toBe(true);
    expect(isRealAnswer('ฉันชอบวิเคราะห์ข้อมูล')).toBe(true);
  });

  it('keeps accented, Cyrillic and Devanagari letters whole', () => {
    expect(answerWordCount('Me encanta el análisis')).toBe(4);
    expect(answerWordCount('café au lait')).toBe(3);
    expect(answerWordCount('мне нравится анализ')).toBe(3);
    expect(answerWordCount('मुझे डेटा पसंद है')).toBe(4);
  });

  it('still treats "I do not know" as a non-answer, in Chinese and Spanish too', () => {
    expect(isNonAnswer('I do not know')).toBe(true);
    expect(isNonAnswer('我不知道')).toBe(true);
    expect(isNonAnswer('我真的不知道')).toBe(true);
    expect(isNonAnswer('no sé nada')).toBe(true);
    expect(isNonAnswer('n/a')).toBe(true);
  });

  it('does not count a held key as words, in any script', () => {
    expect(answerWordCount('aaaaaaa bbbbbb cccccc')).toBe(0);
    expect(isRealAnswer('啊啊啊啊啊啊啊啊')).toBe(false);
    expect(isRealAnswer('ああああああああ')).toBe(false);
    const mash = 'ejbueoirnoirbnn'.repeat(4);
    expect(isNonAnswer(`${mash} ${mash} ${mash}`)).toBe(true);
  });

  it('works without the browser word breaker', () => {
    setWordBreakerForTests(false);
    expect(isRealAnswer('我喜歡用數據幫助醫院的病人')).toBe(true);
    expect(answerWordCount('Me encanta el análisis')).toBe(4);
    expect(isRealAnswer('啊啊啊啊啊啊')).toBe(false);
    expect(isNonAnswer('我不知道')).toBe(true);
  });

  it('states the rule without assuming spaces, and counts down in the same words', () => {
    expect(ANSWER_RULE).toBe('3 words or more counts as an answer. Any language works.');
    expect(nonAnswerFollowUp('數據')).toBe(`Add 2 more words. ${ANSWER_RULE}`);
  });
});
