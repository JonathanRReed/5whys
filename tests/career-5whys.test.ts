import { describe, expect, it } from 'vitest';
import {
  computeSynthesis,
  firstSentence,
  getAnswerNudge,
  normalizeSnapshot,
  normalizeTopic,
  suggestNextStep,
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

describe('suggestNextStep', () => {
  describe('career track', () => {
    it('suggests networking step when answer mentions people', () => {
      const step = suggestNextStep(
        'career',
        'software engineering',
        'I want to help students succeed.'
      );
      expect(step).toBe(
        'Book 30 minutes with one person doing software engineering today. Ask what their week actually looks like, then check whether your root reason survives the answer.'
      );
    });

    it('suggests building step when answer mentions building', () => {
      const step = suggestNextStep(
        'career',
        'UX Design',
        'I love to design interactive prototypes.'
      );
      expect(step).toBe(
        'Ship one small piece of the actual work of UX Design this month, no title required. If doing it feeds your root reason, the path holds.'
      );
    });

    it('suggests learning step when answer mentions learning', () => {
      const step = suggestNextStep(
        'career',
        'data science',
        'I am curious about machine learning mechanisms.'
      );
      expect(step).toBe(
        "Take one short course or read one practitioner's honest writeup of data science. Compare the day-to-day against your root reason, not the job posting."
      );
    });

    it('falls back to default recommendation when no keywords match', () => {
      const step = suggestNextStep('career', 'finance', 'I want financial stability and autonomy.');
      expect(step).toBe(
        'Talk to one person two years into finance. Trade your five whys for theirs and see if the roots match.'
      );
    });
  });

  describe('interest track', () => {
    it('suggests talking to practitioners when answer mentions people', () => {
      const step = suggestNextStep('interest', 'coaching', 'I enjoy mentoring kids.');
      expect(step).toBe(
        'Find one person who turned coaching into work and ask one question: which part survived becoming a job?'
      );
    });

    it('suggests making something small when answer mentions building', () => {
      const step = suggestNextStep('interest', 'woodworking', 'I like to craft physical objects.');
      expect(step).toBe(
        'Make one small thing from woodworking this week. Two hours, zero stakes. Notice whether you want a second session.'
      );
    });

    it('suggests deep dive research when answer mentions learning', () => {
      const step = suggestNextStep('interest', 'astrophysics', 'I want to understand cosmology.');
      expect(step).toBe(
        'Go one level deeper than class goes: one lecture, paper, or video on the exact part of astrophysics you named. Boredom or pull, either result is data.'
      );
    });

    it('falls back to default recommendation when no keywords match', () => {
      const step = suggestNextStep('interest', 'gardening', 'It gives me peace of mind.');
      expect(step).toBe(
        'Give gardening two focused hours this week in any form. Wanting a third hour is the signal you are looking for.'
      );
    });
  });

  describe('keyword logic and precedence', () => {
    it('prioritizes people over building and learning keywords', () => {
      const text = 'I want to TEACH students how to BUILD software and LEARN new skills.';
      const careerStep = suggestNextStep('career', 'teaching', text);
      const interestStep = suggestNextStep('interest', 'teaching', text);

      expect(careerStep).toContain('Book 30 minutes with one person');
      expect(interestStep).toContain('Find one person who turned teaching into work');
    });

    it('prioritizes building over learning keywords when people keywords are absent', () => {
      const text = 'I want to CREATE tools while STUDYING new techniques.';
      const careerStep = suggestNextStep('career', 'tooling', text);
      const interestStep = suggestNextStep('interest', 'tooling', text);

      expect(careerStep).toContain('Ship one small piece of the actual work');
      expect(interestStep).toContain('Make one small thing from tooling');
    });

    it('handles uppercase input and word boundaries correctly', () => {
      expect(suggestNextStep('career', 'nursing', 'PATIENTS and HEALTH')).toContain(
        'Book 30 minutes'
      );
      // A word embedded inside another word must not trigger a people suggestion.
      expect(suggestNextStep('career', 'acting', 'impersonate someone')).not.toContain(
        'Book 30 minutes'
      );
    });

    it('uses fallback topic label when topic is a sentence', () => {
      const step = suggestNextStep(
        'career',
        'I think I want a job that pays well',
        'I love to build products.'
      );
      expect(step).toBe(
        'Ship one small piece of the actual work of this path this month, no title required. If doing it feeds your root reason, the path holds.'
      );
    });
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


describe('reflection coaching limits', () => {
  it.each(['career', 'interest'] as const)('treats completed %s answers as a working hypothesis', (track) => {
    const result = computeSynthesis(Array(5).fill('I want to help people understand useful ideas.'), 'Teaching', track);
    expect(result.isComplete).toBe(true);
    expect(result.whyStatement).toContain('working hypothesis');
    expect(result.whyStatement).not.toMatch(/the real reason|really about|Act on that/);
    expect(result.whyStatement).toContain('I want to help people understand useful ideas.');
  });
});
