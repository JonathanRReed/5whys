import { describe, expect, it } from 'vitest';
import { buildPrompts, TRACKS } from '../src/components/career-5whys/shared';
import {
  findInventedClaims,
  followUpWhy,
  GENERIC_PROBES,
  interviewFollowUp,
  likelyQuestions,
  messageVariants,
  rewriteBullet,
  translateWording,
  WORDING_DICTIONARY,
} from '../src/lib/local-ai';
import { mentionsKnownTool } from '../src/lib/local-ai/guards';
import { isQuestionableRequirement } from '../src/lib/local-ai/requirement-questions';
import { extractBullets } from '../src/lib/resume-game/analysis';
import { STUDENT_SAMPLE_RESUME } from '../src/lib/resume-game/samples';

const rules = { rulesOnly: true } as const;

describe('rewriteBullet rules', () => {
  it('turns "responsible for" into the verb the student already used', async () => {
    const result = await rewriteBullet(
      { line: '• Responsible for managing the club Instagram account, etc.' },
      rules
    );
    expect(result.source).toBe('rules');
    expect(result.fallbackReason).toBe('rules-only');
    expect(result.value.rewrite).toBe('Managed the club Instagram account');
    expect(result.value.changed).toBe(true);
    expect(result.inventedClaims).toEqual([]);
  });

  it('keeps "helped" and asks which part was the student\'s', async () => {
    const { value } = await rewriteBullet(
      { line: 'Helped with the rollout of the new system' },
      rules
    );
    expect(value.rewrite).toBe('Helped with the rollout of the new system');
    expect(value.changed).toBe(false);
    expect(value.notes[0]).toMatch(/which part was yours/);
  });

  it('drops a leading "I" and filler', async () => {
    const { value } = await rewriteBullet(
      { line: 'I successfully organized the spring book drive' },
      rules
    );
    expect(value.rewrite).toBe('Organized the spring book drive');
  });

  it('passes notes from the suggestion engine without its worked examples', async () => {
    const { value } = await rewriteBullet({ line: 'Worked at the library' }, rules);
    expect(value.notes.length).toBeGreaterThan(0);
    // The engine's examples carry numbers that are not the student's.
    expect(value.notes.join(' ')).not.toMatch(/1,400|12 volunteers|\$4,800/);
  });

  it('returns an empty rewrite for an empty line', async () => {
    const result = await rewriteBullet({ line: '   ' });
    expect(result.value).toEqual({ rewrite: '', changed: false, notes: [] });
    expect(result.fallbackReason).toBe('not-needed');
  });

  it('never invents a claim on any line of the student sample resume', async () => {
    for (const line of extractBullets(STUDENT_SAMPLE_RESUME)) {
      const result = await rewriteBullet({ line }, rules);
      expect(result.inventedClaims, line).toEqual([]);
    }
  });
});

describe('followUpWhy rules', () => {
  it('asks the existing contextual prompt for the next empty layer', async () => {
    const answers = [...TRACKS.interest.example.answers.slice(0, 2), '', '', ''];
    const result = await followUpWhy({ track: 'interest', topic: 'Biology', answers }, rules);
    expect(result.value.question).toBe(buildPrompts('interest', 'Biology', answers)[2]);
    expect(result.inventedClaims).toEqual([]);
  });

  it('returns null once all five are answered, without a model', async () => {
    const answers = [...TRACKS.career.example.answers];
    const result = await followUpWhy({ track: 'career', topic: 'Product manager', answers });
    expect(result.value.question).toBeNull();
    expect(result.fallbackReason).toBe('not-needed');
  });

  it('asks the first question before any answer', async () => {
    const result = await followUpWhy({ track: 'career', topic: 'Nursing', answers: [] });
    expect(result.value.question).toContain('nursing');
    expect(result.fallbackReason).toBe('not-needed');
  });
});

describe('likelyQuestions rules', () => {
  const input = {
    jobTitle: 'Data analyst intern',
    company: 'Northwind',
    requirements: [
      'Experience with SQL and Excel',
      'Comfort presenting findings to non-technical teams',
      'Coursework in statistics',
    ],
  };

  it('ties every question to a requirement from the posting, verbatim', async () => {
    const { value, inventedClaims } = await likelyQuestions(input, rules);
    const tied = value.questions.filter((q) => q.requirement !== null);
    expect(tied).toHaveLength(3);
    for (const q of tied) expect(input.requirements).toContain(q.requirement);
    expect(inventedClaims).toEqual([]);
  });

  it('uses the question bank when a requirement names a known skill', async () => {
    const { value } = await likelyQuestions(input, rules);
    expect(value.questions[0].question).toMatch(/SQL/);
  });

  it('adds general questions with no requirement', async () => {
    const { value } = await likelyQuestions(input, rules);
    expect(value.questions.filter((q) => q.requirement === null).map((q) => q.question)).toEqual([
      'Tell me about yourself.',
      'Why are you interested in this role?',
    ]);
  });

  it('never repeats a question and stays within the limit', async () => {
    const requirements = Array.from(
      { length: 15 },
      (_, i) => `Experience with Python project ${'x'.repeat(i)}`
    );
    const { value } = await likelyQuestions({ requirements }, rules);
    const texts = value.questions.map((q) => q.question);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeLessThanOrEqual(8);
  });

  it('never names a tool the posting did not', async () => {
    // The bank's Python questions must not appear for a pandas-only line
    // when they name Python, because the posting never said Python.
    const { inventedClaims } = await likelyQuestions(
      { requirements: ['Familiar with pandas for cleaning data'] },
      rules
    );
    expect(inventedClaims).toEqual([]);
  });
});

describe('messageVariants rules', () => {
  const input = {
    opener:
      'I am excited to apply for the marketing intern role. Last spring I ran the campus radio Instagram and grew it from 240 to 610 followers.',
    role: 'Marketing intern',
    company: 'Northwind',
    contactName: 'Priya',
  };

  it('builds three messages from the opener without adding anything', async () => {
    const result = await messageVariants(input, rules);
    expect(result.value.linkedInMessage).toContain('Hi Priya');
    expect(result.value.linkedInMessage).toContain('240 to 610');
    expect(result.value.linkedInMessage.length).toBeLessThanOrEqual(200);
    expect(result.value.followUpEmail.subject).toBe(
      'Following up on my Marketing intern application'
    );
    expect(result.value.followUpEmail.body).toContain('Northwind');
    expect(result.value.introCallOpener).toContain('Last spring');
    expect(result.inventedClaims).toEqual([]);
  });

  it('greets without a name when there is no contact', async () => {
    const { value } = await messageVariants({ ...input, contactName: undefined }, rules);
    // No person to greet: "Hello,", never "Hi there" or "Hi Hiring Team".
    expect(value.linkedInMessage.startsWith('Hello,')).toBe(true);
    expect(value.followUpEmail.body.startsWith('Hello,')).toBe(true);
  });

  it('drops the opener from the LinkedIn note when it would run long', async () => {
    const { value } = await messageVariants(
      { ...input, opener: `I care about ${'radio '.repeat(60)}.` },
      rules
    );
    expect(value.linkedInMessage.length).toBeLessThanOrEqual(300);
  });

  it('writes no em dashes or exclamation marks even when the opener has them', async () => {
    const { value } = await messageVariants({ ...input, opener: 'I love radio!' }, rules);
    const all = [value.linkedInMessage, value.followUpEmail.body, value.introCallOpener].join(' ');
    expect(all).not.toMatch(/[—!]/);
  });
});

describe('translateWording rules', () => {
  it.each([
    ['I helped with the rollout', ['adoption', 'cross-functional coordination']],
    ['I trained everyone on the new system', ['training', 'change adoption']],
    [
      "I ran the club's Instagram",
      ['social media management', 'content planning', 'audience growth'],
    ],
  ])('maps "%s" to the professional terms', async (phrase, expected) => {
    const result = await translateWording({ phrase }, rules);
    const terms = result.value.suggestions.map((s) => s.term);
    for (const term of expected) expect(terms).toContain(term);
    expect(result.value.honestUse).toBeTruthy();
    expect(result.inventedClaims).toEqual([]);
  });

  it("prefers the posting's words for the same work and marks them", async () => {
    const { value } = await translateWording(
      {
        phrase: "I ran the club's Instagram",
        postingTerms: ['social media', 'financial modeling'],
      },
      rules
    );
    expect(value.suggestions[0]).toEqual({ term: 'social media', fromPosting: true });
    expect(value.suggestions.map((s) => s.term)).not.toContain('financial modeling');
  });

  it('never offers a posting tool the student did not name', async () => {
    const { value } = await translateWording(
      { phrase: "I ran the club's Instagram", postingTerms: ['Hootsuite', 'social media'] },
      rules
    );
    expect(value.suggestions.map((s) => s.term)).not.toContain('Hootsuite');
  });

  it('offers a posting tool the student did name', async () => {
    const { value } = await translateWording(
      { phrase: 'I made a budget tracker in Excel', postingTerms: ['Excel'] },
      rules
    );
    expect(value.suggestions[0]).toEqual({ term: 'Excel', fromPosting: true });
  });

  it('suggests nothing for a phrase it does not recognize', async () => {
    const { value } = await translateWording({ phrase: 'I like turtles' }, rules);
    expect(value).toEqual({ suggestions: [], honestUse: null });
  });

  it('does not turn helping into leading', async () => {
    const { value } = await translateWording(
      { phrase: 'I helped plan the spring fundraiser' },
      rules
    );
    for (const s of value.suggestions) expect(s.term).not.toMatch(/\blead|manag|direct|head/i);
  });
});

describe('the wording dictionary', () => {
  it('has at least 40 entries with unique ids', () => {
    expect(WORDING_DICTIONARY.length).toBeGreaterThanOrEqual(40);
    expect(new Set(WORDING_DICTIONARY.map((e) => e.id)).size).toBe(WORDING_DICTIONARY.length);
  });

  it('names no tools, numbers, or capitals in any term', () => {
    for (const entry of WORDING_DICTIONARY) {
      for (const term of entry.terms) {
        expect(mentionsKnownTool(term), `${entry.id}: ${term}`).toBe(false);
        expect(term, entry.id).toMatch(/^[a-z][a-z -]*$/);
      }
    }
  });

  it('writes honest-use notes in the site voice', () => {
    for (const entry of WORDING_DICTIONARY) {
      expect(entry.honestUse, entry.id).not.toMatch(/[—!]/);
      expect(entry.honestUse, entry.id).toMatch(/\.$/);
      expect(entry.honestUse[0], entry.id).toMatch(/[A-Z]/);
    }
  });

  it('never claims ownership the phrase does not carry', () => {
    for (const entry of WORDING_DICTIONARY) {
      for (const term of entry.terms) {
        // Checked against an empty input, only ownership can be invented by a
        // lowercase term with no digits or tools; "leadership" needs a role.
        const claims = findInventedClaims('', term).filter((c) => c.kind === 'ownership');
        if (entry.id === 'officer' || entry.id === 'ran-meetings') continue;
        expect(claims, `${entry.id}: ${term}`).toEqual([]);
      }
    }
  });

  it('matches plain student phrases', () => {
    const samples: Record<string, string> = {
      'front-desk': 'I answered phones at the front desk',
      register: 'I worked the cash register at Target',
      tutoring: 'I tutored my classmates in chemistry',
      childcare: 'I babysat my neighbors every weekend',
      fundraising: 'We did a bake sale for the robotics team',
      caregiving: 'I took care of my grandma after school',
      'caught-errors': 'I caught mistakes in the grade sheet',
    };
    for (const [id, phrase] of Object.entries(samples)) {
      const entry = WORDING_DICTIONARY.find((e) => e.id === id);
      expect(entry?.match.test(phrase), id).toBe(true);
    }
  });
});

describe('interviewFollowUp rules', () => {
  it('asks for the student\'s own part when the answer says "we"', async () => {
    const { value } = await interviewFollowUp(
      { question: 'Tell me about a team project.', answer: 'We built an app and we presented it.' },
      rules
    );
    expect(value.followUp).toBe(GENERIC_PROBES.ownership);
  });

  it('asks what happened when there is no result', async () => {
    const { value } = await interviewFollowUp(
      {
        question: 'Tell me about a challenge.',
        answer: 'I rewrote the sign-up form for the club.',
      },
      rules
    );
    expect(value.followUp).toBe(GENERIC_PROBES.result);
  });

  it('asks for a specific moment when the answer is short', async () => {
    const { value } = await interviewFollowUp(
      {
        question: 'Tell me about a challenge.',
        answer: 'I rewrote the form and sign-ups improved.',
      },
      rules
    );
    expect(value.followUp).toBe(GENERIC_PROBES.moment);
  });

  it('asks for the hardest part, then for reflection', async () => {
    const long =
      'I noticed the club sign-up form lost people halfway, so I rewrote it over a weekend, tested it with five friends, and moved the fields people skipped, and in the end sign-ups improved at the fall fair.';
    const first = await interviewFollowUp({ question: 'Q', answer: long }, rules);
    expect(first.value.followUp).toBe(GENERIC_PROBES.difficulty);
    const second = await interviewFollowUp(
      { question: 'Q', answer: `${long} The hard part was convincing the board.` },
      rules
    );
    expect(second.value.followUp).toBe(GENERIC_PROBES.reflection);
  });

  it('asks for the situation when the answer is empty', async () => {
    const result = await interviewFollowUp({ question: 'Q', answer: '' });
    expect(result.value.followUp).toBe(GENERIC_PROBES.empty);
    expect(result.fallbackReason).toBe('not-needed');
  });

  it('writes probes in the site voice', () => {
    for (const probe of Object.values(GENERIC_PROBES)) {
      expect(probe).toMatch(/^[A-Z][^—!]*\?$/);
    }
  });
});

describe('fail closed on bad input', () => {
  it('coerces missing fields instead of throwing', async () => {
    const broken = {} as never;
    await expect(rewriteBullet(broken)).resolves.toMatchObject({ source: 'rules' });
    await expect(followUpWhy(broken)).resolves.toMatchObject({ source: 'rules' });
    await expect(likelyQuestions(broken)).resolves.toMatchObject({ source: 'rules' });
    await expect(messageVariants(broken)).resolves.toMatchObject({ source: 'rules' });
    await expect(translateWording(broken)).resolves.toMatchObject({ source: 'rules' });
    await expect(interviewFollowUp(broken)).resolves.toMatchObject({ source: 'rules' });
  });
});

describe('likelyQuestions rules: questions from real requirements', () => {
  it('never turns an address, an employer description, or pay into a question', async () => {
    // The rehearsal room asked "Tell me about a time you showed this:" about these.
    const { value } = await likelyQuestions(
      {
        company: 'Northgate Logistics Partners',
        requirements: [
          'Northgate Logistics Partners, Columbus, OH (hybrid, 3 days on site)',
          'Harbor Freight Logistics is a mid-size logistics company',
          'Northgate is a growing third-party logistics provider serving retail and consumer goods brands.',
          'Larkfield Brands, Inc. (remote within Ohio, up to 25% travel)',
          "We're looking for a self-starter who thrives in a fast-paced environment and can wear many hats.",
          'Compensation: $58,000 - $66,000 per year, plus annual bonus up to 5%. Full benefits.',
          'Other duties as assigned',
        ],
      },
      rules
    );
    expect(value.questions.filter((q) => q.requirement !== null)).toEqual([]);
    for (const q of value.questions) expect(q.question).not.toMatch(/showed this/);
  });

  it('skips eligibility lines: degrees, certificates, lifting', async () => {
    const { value } = await likelyQuestions(
      {
        requirements: [
          "Bachelor's degree in business, supply chain, or related field, or equivalent experience",
          'Lean or Six Sigma Yellow Belt',
          'Must be able to lift 25 pounds and work Saturday mornings',
          'Currently enrolled in a college or university program',
        ],
      },
      rules
    );
    expect(value.questions.filter((q) => q.requirement !== null)).toEqual([]);
  });

  it('asks how a tool was used', async () => {
    const { value } = await likelyQuestions(
      {
        requirements: [
          'Advanced Excel skills (pivot tables, VLOOKUP/XLOOKUP)',
          'Experience with a warehouse management system (WMS) such as Manhattan, Blue Yonder, or similar',
          'Proficiency with Smartsheet, MS Project, or similar project management tools',
        ],
      },
      rules
    );
    expect(value.questions.map((q) => q.question)).toEqual(
      expect.arrayContaining([
        'How have you used Excel, and for what?',
        'How have you used a warehouse management system, and for what?',
        'How have you used Smartsheet or MS Project, and for what?',
      ])
    );
  });

  it('asks a student to walk through a duty and anyone else for a time they did it', async () => {
    const duty =
      'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads';
    const student = await likelyQuestions({ requirements: [duty], audience: 'student' }, rules);
    expect(student.value.questions[0].question).toBe(
      'Walk me through how you would coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads.'
    );
    const changer = await likelyQuestions(
      { requirements: [duty], audience: 'career-changer' },
      rules
    );
    expect(changer.value.questions[0].question).toBe(
      'Tell me about a time you had to coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads.'
    );
  });

  it('asks a behavioural bank question for a quality, with its notes', async () => {
    const { value } = await likelyQuestions(
      {
        requirements: ['Ability to manage multiple priorities in a fast-paced environment'],
        audience: 'career-changer',
      },
      rules
    );
    const [first] = value.questions;
    expect(first.questionId).toBe('q-time-priority');
    expect(first.strongAnswer).toBeTruthy();
    expect(first.commonMistake).toBeTruthy();
  });

  it('asks about years of experience in the posting’s own field words', async () => {
    const { value } = await likelyQuestions(
      {
        requirements: [
          '2+ years of experience in operations, logistics, supply chain, or a related field',
        ],
      },
      rules
    );
    expect(value.questions[0].question).toBe(
      'Tell me about your experience in operations, logistics, or supply chain.'
    );
  });

  it('asks a career changer why they are changing fields among the general questions', async () => {
    const { value } = await likelyQuestions(
      { requirements: [], audience: 'career-changer' },
      rules
    );
    expect(value.questions.map((q) => q.question)).toEqual([
      'Tell me about yourself.',
      'Why are you moving from your last field into this one?',
    ]);
  });
});

describe('interviewFollowUp rules for questions about the person', () => {
  it('does not ask "what was your part" about a layoff', async () => {
    const { value } = await interviewFollowUp(
      {
        question: 'Tell me about leaving your last job.',
        answer: 'We were all laid off when the store closed.',
      },
      rules
    );
    expect(value.followUp).not.toBe(GENERIC_PROBES.ownership);
    expect(value.followUp).toBe('What did you learn there that you would bring here?');
  });

  it('asks for an example after a short answer to a question with no story', async () => {
    const { value } = await interviewFollowUp(
      { question: 'Why do you think you would be good at this?', answer: 'I am organized.' },
      rules
    );
    expect(value.followUp).toBe(GENERIC_PROBES.example);
  });
});

describe('isQuestionableRequirement', () => {
  it.each([
    'Northgate Logistics Partners, Columbus, OH (hybrid, 3 days on site)',
    'Harbor Freight Logistics is a mid-size logistics company',
    'You will be the glue between the floor, our carriers, and our account managers.',
    'This is a great opportunity for a rockstar who is passionate about retail.',
    'Pay: $24.00 - $28.00 per hour, non-exempt, overtime eligible.',
    "Bachelor's degree in business, supply chain, or related field",
    'Part time, paid',
  ])('rejects "%s"', (line) => {
    expect(isQuestionableRequirement(line, { company: 'Northgate Logistics Partners' })).toBe(
      false
    );
  });

  it.each([
    'Coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads',
    'Advanced Excel skills (pivot tables, VLOOKUP/XLOOKUP)',
    'Strong communication skills and attention to detail',
    '2+ years of experience in operations, logistics, supply chain, or a related field',
    'Proficiency with Smartsheet, MS Project, or similar project management tools',
  ])('accepts "%s"', (line) => {
    expect(isQuestionableRequirement(line)).toBe(true);
  });
});
