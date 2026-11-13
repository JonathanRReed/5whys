/**
 * Regression tests from the two user-story walkthroughs (career changer,
 * finding 4; student, finding 13), using the postings they used.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  audienceForStage,
  CAREER_CHANGER_MUST_ASK,
  detectSkillsFromText,
  getQuestionById,
  getRepeatedTerms,
  planRehearsal,
  postingRepeatedTerms,
  QUESTION_BANK,
  questionsFor,
  type RehearsalQuestion,
  storiesForQuestion,
} from '../src/lib/glowup-banks';
import {
  type DecodedBullet,
  requirementBullets,
  type Story,
  skillCounts,
} from '../src/lib/glowup-store';
import { likelyQuestionsRules } from '../src/lib/local-ai/rules';
import {
  decodePostingToBullets,
  SAMPLE_POSTING,
  SAMPLE_POSTING_COMPANY,
  SAMPLE_POSTING_TITLE,
} from '../src/lib/posting';

const NORTHGATE = readFileSync(
  'tests/fixtures/postings/northgate-operations-coordinator.txt',
  'utf8'
);

/** What the rehearsal room builds, without the component. */
function roomFor(
  posting: string,
  stage: Parameters<typeof audienceForStage>[0],
  names: { company?: string; jobTitle?: string } = {}
) {
  const audience = audienceForStage(stage);
  const { bullets } = decodePostingToBullets(posting);
  const requirements = requirementBullets(bullets).map((b) => b.text);
  const { questions } = likelyQuestionsRules({ ...names, requirements, audience });
  const fromPosting: RehearsalQuestion[] = questions
    .filter((q) => q.requirement)
    .map((q) => ({ ...q, skillIds: q.skillIds ?? [] }));
  const postingSkillIds = new Set(
    requirements.flatMap((line) => detectSkillsFromText(line).map((s) => s.skillId))
  );
  return { plan: planRehearsal({ audience, fromPosting, postingSkillIds }), requirements };
}

describe('the question bank', () => {
  it('keeps every id the earlier bank had, so saved stories still resolve', () => {
    const before = [
      'q-intro',
      'q-why-company',
      'q-why-role',
      'q-strengths',
      'q-weaknesses',
      'q-five-years',
      'q-stu-resume',
      'q-stu-no-exp',
      'q-stu-major',
      'q-stu-class-project',
      'q-stu-group-conflict',
      'q-stu-overwhelmed',
      'q-stu-balance',
      'q-stu-internship',
      'q-stu-club',
      'q-stu-parttime',
      'q-stu-course',
      'q-stu-feedback',
      'q-stu-teach',
      'q-lead-project',
      'q-lead-conflict',
      'q-lead-mentor',
      'q-lead-decision',
      'q-ps-complex',
      'q-ps-debug',
      'q-ps-tradeoff',
      'q-ps-ambiguity',
      'q-comm-explain',
      'q-comm-disagree',
      'q-comm-feedback',
      'q-team-collab',
      'q-team-difficult',
      'q-team-remote',
      'q-own-initiative',
      'q-own-failure',
      'q-own-improve',
      'q-adapt-change',
      'q-adapt-learn',
      'q-adapt-pressure',
      'q-time-priority',
      'q-time-missed',
      'q-detail-catch',
      'q-detail-process',
      'q-py-project',
      'q-py-quality',
      'q-js-build',
      'q-js-async',
      'q-java-design',
      'q-sql-question',
      'q-sql-slow',
      'q-ml-endtoend',
      'q-ml-overfit',
      'q-sec-risk',
      'q-sec-explain',
      'q-fe-ui',
      'q-fe-perf',
      'q-mob-app',
      'q-data-decision',
      'q-data-messy',
      'q-ux-feedback',
      'q-ux-research',
      'q-fin-accuracy',
      'q-health-sensitive',
      'q-ecom-funnel',
      'q-tech-design',
      'q-tech-scale',
      'q-tech-learn',
    ];
    for (const id of before) expect(getQuestionById(id), id).toBeDefined();
  });

  it('tags every question with who it suits and both notes, in the site voice', () => {
    const ids = new Set<string>();
    for (const q of QUESTION_BANK) {
      expect(ids.has(q.id), q.id).toBe(false);
      ids.add(q.id);
      expect(q.audiences.length, q.id).toBeGreaterThan(0);
      for (const a of q.audiences) expect(AUDIENCES).toContain(a);
      for (const text of [q.text, q.strongAnswer, q.commonMistake]) {
        expect(text.trim().length, q.id).toBeGreaterThan(10);
        expect(text, q.id).not.toMatch(/[—!]/);
      }
    }
  });

  it('has at least twelve questions each for career changers and experienced candidates', () => {
    const only = (audience: string) =>
      QUESTION_BANK.filter(
        (q) => q.audiences.includes(audience as never) && q.audiences.length < AUDIENCES.length
      );
    expect(only('career-changer').length).toBeGreaterThanOrEqual(12);
    expect(only('experienced').length).toBeGreaterThanOrEqual(12);
  });

  it('asks a career changer about the change, leaving, and the time since', () => {
    expect(getQuestionById('q-chg-why-change')?.text).toBe(
      'Why are you moving from your last field into this one?'
    );
    expect(getQuestionById('q-chg-gap')?.text).toBe(
      'What have you been doing since your last role?'
    );
    expect(getQuestionById('q-chg-left-last-job')?.text).toBe(
      'Tell me about leaving your last job.'
    );
  });

  it('keeps coursework and club questions away from a career changer', () => {
    for (const id of ['q-stu-overwhelmed', 'q-stu-club', 'q-stu-major', 'q-stu-no-exp']) {
      expect(getQuestionById(id)?.audiences).not.toContain('career-changer');
      expect(getQuestionById(id)?.audiences).not.toContain('experienced');
    }
  });

  it('offers a technical question only when the posting asks for that technology', () => {
    const ops = ['communication', 'attention-to-detail', 'logistics', 'operations'];
    const offered = questionsFor('attention-to-detail', {
      audience: 'career-changer',
      postingSkillIds: ops,
    }).map((q) => q.text);
    expect(offered).not.toContain('How do you keep a growing Python codebase readable and tested?');
    const withPython = questionsFor('attention-to-detail', {
      audience: 'experienced',
      postingSkillIds: [...ops, 'python'],
    }).map((q) => q.id);
    expect(withPython).toContain('q-py-quality');
  });

  it('reads the career review stage, defaulting to a student', () => {
    expect(audienceForStage(undefined)).toBe('student');
    expect(audienceForStage('student')).toBe('student');
    expect(audienceForStage('early')).toBe('early-career');
    expect(audienceForStage('mid')).toBe('experienced');
    expect(audienceForStage('senior')).toBe('experienced');
    expect(audienceForStage('transition')).toBe('career-changer');
  });
});

describe('requirement lines', () => {
  const bullet = (over: Partial<DecodedBullet>): DecodedBullet => ({
    id: Math.random().toString(36),
    text: 'x',
    status: 'active',
    primarySkillId: null,
    secondarySkillIds: [],
    ...over,
  });

  it('uses only confirmed lines when any are confirmed', () => {
    const lines = [
      bullet({ text: 'A', section: 'required', confirmed: true }),
      bullet({ text: 'B', section: 'required' }),
      bullet({ text: 'C', section: 'unclassified', confirmed: true }),
      bullet({ text: 'D', section: 'preferred', confirmed: true, status: 'ignored' }),
    ];
    expect(requirementBullets(lines).map((b) => b.text)).toEqual(['A', 'C']);
  });

  it('otherwise uses required, duty, and preferred lines, never unsorted or ignored ones', () => {
    const lines = [
      bullet({ text: 'Northgate Logistics Partners, Columbus, OH', section: 'unclassified' }),
      bullet({ text: 'Pref', section: 'preferred' }),
      bullet({ text: 'Duty', section: 'responsibility' }),
      bullet({ text: 'Req', section: 'required' }),
      bullet({ text: 'Gone', section: 'required', status: 'ignored' }),
      bullet({ text: 'Legacy' }),
    ];
    expect(requirementBullets(lines).map((b) => b.text)).toEqual(['Req', 'Duty', 'Pref']);
  });
});

describe('What this job tests', () => {
  it('counts requirement lines with a denominator instead of percentages', () => {
    const { bullets } = decodePostingToBullets(NORTHGATE);
    const { counts, total } = skillCounts(bullets);
    expect(total).toBe(requirementBullets(bullets).length);
    for (const { count } of counts) expect(count).toBeLessThanOrEqual(total);
    const ids = counts.map((c) => c.skillId);
    expect(ids[0]).toBe('logistics');
    expect(ids).not.toContain('ecommerce');
    expect(ids).not.toContain('leadership');
    expect(ids).toEqual(expect.arrayContaining(['scheduling', 'inventory', 'customer-service']));
  });

  it('counts a line once per skill, however it is tagged', () => {
    const { counts, total } = skillCounts([
      {
        id: 'a',
        text: 'x',
        status: 'active',
        section: 'required',
        primarySkillId: 'communication',
        secondarySkillIds: ['communication', 'teamwork'],
      },
    ]);
    expect(total).toBe(1);
    expect(counts).toEqual([
      { skillId: 'communication', count: 1 },
      { skillId: 'teamwork', count: 1 },
    ]);
  });
});

describe('repeated phrases', () => {
  it("leave out the employer's own name and the job title", () => {
    const posting = `Marketing Intern
Lakeview County Parks | Summer

About Lakeview County
Lakeview County runs forty parks. The marketing intern supports the parks team.

What you will do
- Write social media posts for Lakeview County events
- Write social media posts about volunteer days
- Track social media results in a spreadsheet`;
    const terms = postingRepeatedTerms(posting, {
      company: 'Lakeview County Parks',
      jobTitle: 'Marketing Intern',
    }).map((t) => t.term);
    expect(terms).not.toContain('lakeview county');
    expect(terms).not.toContain('marketing intern');
    expect(terms).toContain('social media');
  });

  it('find the employer in the header when no company was typed', () => {
    const posting = `Operations Coordinator
Northgate Logistics Partners, Columbus, OH

Northgate Logistics Partners serves retail brands.
- Coordinate carrier schedules for Northgate Logistics Partners clients
- Report carrier schedules weekly`;
    expect(getRepeatedTerms(posting).map((t) => t.term)).toContain('northgate logistics');
    const terms = postingRepeatedTerms(posting).map((t) => t.term);
    expect(terms.some((t) => t.includes('northgate'))).toBe(false);
    expect(terms).toContain('carrier schedules');
  });
});

describe('the rehearsal room for the career changer (Northgate posting)', () => {
  const { plan, requirements } = roomFor(NORTHGATE, 'transition', {
    company: 'Northgate Logistics Partners',
    jobTitle: 'Operations Coordinator',
  });
  const texts = plan.map((q) => q.question);

  it('opens with "Tell me about yourself"', () => {
    expect(texts[0]).toBe('Tell me about yourself.');
  });

  it('always asks about the change, leaving the last job, and the time since', () => {
    for (const id of CAREER_CHANGER_MUST_ASK) {
      expect(texts).toContain(getQuestionById(id)?.text);
    }
  });

  it('never asks about the address, the employer pitch, coursework, or clubs', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/Tell me about a time you showed this/);
      expect(text).not.toMatch(/Columbus|Northgate|hybrid/);
      expect(text).not.toMatch(/coursework|club|student organization|major/i);
    }
  });

  it('ties each posting question to a real requirement, verbatim', () => {
    const tied = plan.filter((q) => q.requirement);
    expect(tied.length).toBeGreaterThanOrEqual(4);
    for (const q of tied) expect(requirements).toContain(q.requirement);
  });

  it('asks about tools and duties the way an interviewer would', () => {
    expect(texts).toContain('How have you used Excel, and for what?');
    expect(texts).toContain(
      'Tell me about your experience in operations, logistics, or supply chain.'
    );
    expect(texts).toContain(
      'Tell me about a time you had to coordinate daily inbound and outbound shipment schedules with carriers and warehouse leads.'
    );
  });

  it('carries what a strong answer shows and a common mistake for every question', () => {
    for (const q of plan) {
      expect(q.strongAnswer, q.question).toBeTruthy();
      expect(q.commonMistake, q.question).toBeTruthy();
    }
  });
});

describe('the rehearsal room for a student (sample posting)', () => {
  const { plan } = roomFor(SAMPLE_POSTING, null, {
    company: SAMPLE_POSTING_COMPANY,
    jobTitle: SAMPLE_POSTING_TITLE,
  });
  const texts = plan.map((q) => q.question);

  it('opens with the opener, closes with why this role, and asks no career-change question', () => {
    expect(texts[0]).toBe('Tell me about yourself.');
    expect(texts[texts.length - 1]).toBe('Why are you interested in this role?');
    for (const id of CAREER_CHANGER_MUST_ASK) {
      expect(texts).not.toContain(getQuestionById(id)?.text);
    }
  });

  it('skips eligibility lines and the perks line', () => {
    for (const q of plan) {
      expect(q.requirement ?? '').not.toMatch(/enrolled|lift 25 pounds|We offer|Other duties/);
    }
  });

  it('asks a student how they would do the job, not for a time they already did it first', () => {
    expect(texts).toContain(
      'Walk me through how you would schedule and confirm 30 or more volunteers each week.'
    );
  });
});

describe('the rehearsal room without a posting', () => {
  it('still gives a full session in the visitor register', () => {
    const student = planRehearsal({ audience: 'student' }).map((q) => q.question);
    expect(student.length).toBe(8);
    const changer = planRehearsal({ audience: 'career-changer' }).map((q) => q.question);
    expect(changer.length).toBe(9);
    expect(changer).toContain('Tell me about leaving your last job.');
    expect(changer.join(' ')).not.toMatch(/club|coursework|class project/i);
  });
});

describe('stories that fit a question', () => {
  const story = (over: Partial<Story>): Story => ({
    id: Math.random().toString(36),
    primarySkillId: 'general',
    otherSkillIds: [],
    trigger: '',
    hook: '',
    proofSnippet: '',
    play: '',
    proof: '',
    confidence: 60,
    questionPrompts: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });
  // The career changer's three saved stories.
  const shrink = story({
    trigger: 'Shrink',
    primarySkillId: 'inventory',
    otherSkillIds: ['problem-solving'],
    hook: 'Shrink in the garden center was the worst in the district.',
    play: 'I started a weekly cycle count and retrained the back-of-house crew on receiving.',
  });
  const planogram = story({
    trigger: 'Planogram reset',
    primarySkillId: 'project-coordination',
    otherSkillIds: ['scheduling'],
    hook: 'A full-store reset had to happen in one weekend without closing.',
    play: 'I built the schedule by aisle and ran the crews in shifts.',
  });
  const scanner = story({
    trigger: 'Scanner rollout',
    primarySkillId: 'adaptability',
    hook: 'The store moved to handheld scanners for receiving and counts.',
    play: 'I trained every associate and wrote a one-page how-to guide.',
  });
  const stories = [scanner, planogram, shrink];

  it('puts stories tagged with the skill first', () => {
    const matches = storiesForQuestion(
      {
        question: 'Walk me through how you would support inventory reconciliation.',
        requirement: 'Support inventory reconciliation and resolve discrepancies with clients',
      },
      stories
    );
    expect(matches[0].story.trigger).toBe('Shrink');
    expect(matches[0].matchedSkillIds).toContain('inventory');
  });

  it('uses the skills the question carries before detecting them', () => {
    const matches = storiesForQuestion(
      { question: 'Tell me about a schedule you kept together.', skillIds: ['scheduling'] },
      stories
    );
    expect(matches.map((m) => m.story.trigger)).toEqual(['Planogram reset']);
  });

  it('falls back to shared words when no skill matches', () => {
    const matches = storiesForQuestion(
      { question: 'Tell me about training associates on new handheld scanners.', skillIds: [] },
      stories
    );
    expect(matches[0]?.story.trigger).toBe('Scanner rollout');
    expect(matches[0]?.sharedWords.length).toBeGreaterThanOrEqual(2);
  });

  it('returns nothing for a question no story fits', () => {
    expect(
      storiesForQuestion({ question: 'Tell me about leaving your last job.' }, stories)
    ).toEqual([]);
  });
});
