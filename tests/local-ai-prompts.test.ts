import { describe, expect, it } from 'vitest';
import {
  buildFollowUpWhyPrompt,
  buildInterviewFollowUpPrompt,
  buildLikelyQuestionsPrompt,
  buildMessageVariantsPrompt,
  buildRewriteBulletPrompt,
  buildTranslateWordingPrompt,
  type ModelPrompt,
} from '../src/lib/local-ai';

const builders: [string, () => ModelPrompt, () => ModelPrompt][] = [
  [
    'rewriteBullet',
    () => buildRewriteBulletPrompt({ line: 'Responsible for the club Instagram' }),
    () =>
      buildRewriteBulletPrompt({ line: 'Responsible for the club Instagram' }, { claims: ['40%'] }),
  ],
  [
    'followUpWhy',
    () =>
      buildFollowUpWhyPrompt({
        track: 'interest',
        topic: 'Biology',
        answers: ['The part where a tiny mechanism explains a huge visible thing.'],
      }),
    () =>
      buildFollowUpWhyPrompt(
        {
          track: 'career',
          topic: 'Nursing',
          answers: ['I like helping people when they are scared.'],
        },
        { claims: [] }
      ),
  ],
  [
    'likelyQuestions',
    () =>
      buildLikelyQuestionsPrompt({
        jobTitle: 'Data analyst intern',
        company: 'Northwind',
        requirements: ['Experience with SQL', 'Comfort presenting findings'],
      }),
    () =>
      buildLikelyQuestionsPrompt(
        { requirements: ['Experience with SQL'] },
        { claims: ['Tableau', '2024'] }
      ),
  ],
  [
    'messageVariants',
    () =>
      buildMessageVariantsPrompt({
        opener: 'Last spring I ran the campus radio Instagram.',
        role: 'Marketing intern',
        company: 'Northwind',
        contactName: 'Priya',
      }),
    () =>
      buildMessageVariantsPrompt(
        {
          opener: 'Last spring I ran the campus radio Instagram.',
          role: 'Marketing intern',
          company: 'Northwind',
        },
        { claims: ['Monday'] }
      ),
  ],
  [
    'translateWording',
    () =>
      buildTranslateWordingPrompt({
        phrase: 'I trained everyone on the new system',
        postingTerms: ['change management', 'onboarding'],
      }),
    () =>
      buildTranslateWordingPrompt(
        { phrase: 'I trained everyone on the new system' },
        { claims: ['led'] }
      ),
  ],
  [
    'interviewFollowUp',
    () =>
      buildInterviewFollowUpPrompt({
        question: 'Tell me about a team project.',
        answer: 'We built an app for class.',
      }),
    () =>
      buildInterviewFollowUpPrompt(
        { question: 'Tell me about a team project.', answer: 'We built an app for class.' },
        { claims: ['3'] }
      ),
  ],
];

describe.each(builders)('%s prompt', (_name, build, buildRetry) => {
  it('matches its snapshot', () => {
    expect(build()).toMatchSnapshot();
  });

  it('matches its retry snapshot', () => {
    expect(buildRetry()).toMatchSnapshot();
  });

  it('is pure: the same input gives the same prompt', () => {
    expect(build()).toEqual(build());
  });

  it('keeps the model to the input, forbids rating, and sets the voice', () => {
    const { system } = build();
    expect(system).toContain('Use only facts that are in the input.');
    expect(system).toContain('Never rate, score, or grade');
    expect(system).toContain('plain sentence case');
    expect(system).toContain('Do not use em dashes');
  });

  it('is short and has no em dashes of its own', () => {
    const { system, user } = build();
    expect(system.length + user.length).toBeLessThan(1500);
    expect(system + user).not.toContain('—');
  });

  it('gets stricter on retry and names what was rejected', () => {
    const retry = buildRetry();
    expect(retry.system).toContain('Your last answer broke these rules.');
  });
});

describe('prompt inputs', () => {
  it('clips long fields so a prompt stays short', () => {
    const prompt = buildRewriteBulletPrompt({ line: 'word '.repeat(2000) });
    expect(prompt.user.length).toBeLessThan(1300);
  });

  it('caps the number of requirements', () => {
    const requirements = Array.from({ length: 50 }, (_, i) => `Requirement ${i}`);
    const prompt = buildLikelyQuestionsPrompt({ requirements });
    expect(prompt.user.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(20);
  });

  it('names the rejected claims on retry', () => {
    const prompt = buildRewriteBulletPrompt({ line: 'x' }, { claims: ['40%', 'Hootsuite'] });
    expect(prompt.system).toContain('40%, Hootsuite');
  });
});
