import { describe, expect, it } from 'vitest';
import {
  computeSynthesis,
  firstSentence,
  getAnswerNudge,
  normalizeSnapshot,
  normalizeTopic,
  topicLabel,
} from '../src/components/career-5whys/shared';

describe('normalizeTopic', () => {
  it('strips sentence lead-ins so a topic reads as a noun phrase', () => {
    expect(normalizeTopic('I want to work in product management')).toBe('product management');
    expect(normalizeTopic('I want to be a nurse practitioner.')).toBe('nurse practitioner');
    expect(normalizeTopic("I'd like to get into game design")).toBe('game design');
    expect(normalizeTopic('a career in climate policy')).toBe('climate policy');
    expect(normalizeTopic('I like biology')).toBe('biology');
  });

  it('leaves short noun phrases alone', () => {
    expect(normalizeTopic('Product manager')).toBe('Product manager');
    expect(normalizeTopic('  UX research  ')).toBe('UX research');
  });
});

describe('topicLabel', () => {
  it('uses the normalized topic when it can be spliced into a sentence', () => {
    expect(topicLabel('I want to work in product management', 'career')).toBe('product management');
  });

  it('falls back to the neutral label for sentence-shaped topics', () => {
    expect(topicLabel('I think I want a job that pays well and is interesting', 'career')).toBe(
      'this path'
    );
    expect(topicLabel('', 'interest')).toBe('this interest');
  });
});

describe('firstSentence', () => {
  it('keeps the whole first sentence and ends it with a period', () => {
    expect(
      firstSentence(
        'I need to be the one who decides what gets built, not the one who apologizes for it. That is the whole thing.'
      )
    ).toBe('I need to be the one who decides what gets built, not the one who apologizes for it.');
    expect(firstSentence('agency over prevention')).toBe('agency over prevention.');
    expect(firstSentence('')).toBe('');
  });
});

describe('getAnswerNudge', () => {
  it('returns null for empty or whitespace-only answers', () => {
    expect(getAnswerNudge('', '')).toBeNull();
    expect(getAnswerNudge('   \n\t  ', 'Some previous answer')).toBeNull();
  });

  it('returns short answer prompt when word count is less than 8 words', () => {
    const nudge = getAnswerNudge('I want to build software.', '');
    expect(nudge).toBe(
      'Short answer. Push one level deeper: name a value, a constraint, a moment, a person, or a fear.'
    );
  });

  it('returns null for answers with 8 or more words that are not near repeats', () => {
    const answer =
      'I want to build software because I enjoy solving complex problems for real people.';
    expect(getAnswerNudge(answer, '')).toBeNull();
  });

  it('returns near repeat prompt when current answer mostly restates previous answer', () => {
    const previous =
      'I want to build software architecture for enterprise platforms and infrastructure';
    const current = 'I want to build software systems for enterprise platforms and infrastructure';
    const nudge = getAnswerNudge(current, previous);
    expect(nudge).toBe(
      'This mostly restates your last answer. Go one level down: what does it protect, cost, or prove?'
    );
  });

  it('prioritizes near repeat prompt over short answer prompt', () => {
    // Both previous and current have enough significant tokens to trigger isNearRepeat
    const previous = 'building complex backend scalable systems design';
    const current = 'building complex backend scalable systems architecture';
    const nudge = getAnswerNudge(current, previous);
    expect(nudge).toBe(
      'This mostly restates your last answer. Go one level down: what does it protect, cost, or prove?'
    );
  });

  it('handles multi-space word separation correctly when calculating word count', () => {
    // 8 words separated by multiple spaces
    const answer = 'One   two   three   four   five   six   seven   eight';
    expect(getAnswerNudge(answer, '')).toBeNull();

    // 7 words separated by multiple spaces
    const shortAnswer = 'One   two   three   four   five   six   seven';
    expect(getAnswerNudge(shortAnswer, '')).not.toBeNull();
  });

  it('ignores empty or whitespace-only previous answers when checking near repeat', () => {
    const answer =
      'I want to build software architecture for enterprise platforms and infrastructure';
    expect(getAnswerNudge(answer, '   ')).toBeNull();
  });
});

describe('computeSynthesis', () => {
  const answers = [
    'I keep fixing the product instead of apologizing for it.',
    'I am tired of being downstream of decisions I could see coming.',
    'I want to be in the room where the tradeoffs get made.',
    'Staying means getting better at absorbing damage instead of preventing it.',
    'I need my work to change outcomes, not just soften them. Agency is what I am chasing.',
  ];

  it('quotes a sentence-shaped topic instead of splicing it', () => {
    const result = computeSynthesis(answers, 'I want to work in product management', 'career');
    expect(result.isComplete).toBe(true);
    expect(result.whyStatement).toContain(
      'You started with "I want to work in product management"'
    );
    expect(result.whyStatement).not.toContain('about I want');
    expect(result.root).toBe('I need my work to change outcomes, not just soften them.');
    expect(result.nextStep).toContain('product management');
    expect(result.nextStep).not.toContain('I want to work in');
  });

  it('reports progress while the chain is incomplete', () => {
    const result = computeSynthesis(answers.slice(0, 2), 'Product manager', 'career');
    expect(result.isComplete).toBe(false);
    expect(result.sequentialCount).toBe(2);
    expect(result.whyStatement).toContain('Layer 2 of 5 answered');
    expect(result.nextStep).toBe('');
  });
});

describe('normalizeSnapshot', () => {
  it('derives the root reason and next step for snapshots saved before version 3', () => {
    const legacy = {
      id: 'snap_1',
      timestamp: '2026-01-01T00:00:00.000Z',
      whyStatement: 'old statement',
      track: 'interest',
      topic: 'Biology',
      responses: [
        'The part where a tiny mechanism explains a huge visible thing.',
        'Chemistry has mechanisms too, but I do not care until it connects to a living thing.',
        'Tenth grade, when a doctor drew the dopamine pathway on a napkin.',
        'I need work that turns confusing, scary things into explanations people can act on.',
        'A path fits if I can trace a line from mechanism to a person. Bench work probably does not.',
      ],
      theme: '',
      alignment: '',
      version: 2,
    };
    const snapshot = normalizeSnapshot(legacy);
    expect(snapshot?.whyStatement).toBe('old statement');
    expect(snapshot?.rootReason).toBe(
      'A path fits if I can trace a line from mechanism to a person.'
    );
    expect(snapshot?.nextStep).toMatch(/biology/i);
    expect(snapshot).not.toHaveProperty('theme');
  });
});
