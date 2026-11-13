import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DecodeSection from '../src/components/interview-glow-up/DecodeSection';
import InterviewHUD from '../src/components/interview-glow-up/InterviewHUD';
import PacketSection from '../src/components/interview-glow-up/PacketSection';
import {
  proofLine,
  storyEditorFromAnswer,
} from '../src/components/interview-glow-up/StoriesSection';
import { unlinkedMatch } from '../src/components/interview-glow-up/TrackApplication';
import RehearsalRoom from '../src/components/rehearsal/RehearsalRoom';
import TakeReview, { replayTimes, type Take } from '../src/components/rehearsal/TakeReview';
import type { TrackedApplication } from '../src/lib/applications';
import {
  answerNotes,
  detectSkillsFromText,
  getQuestionById,
  optionalQuestionIds,
  packetCoverage,
  packetQuestionLines,
  planRehearsal,
  questionsToAsk,
  selfCheckFor,
  tidyQuestionText,
} from '../src/lib/glowup-banks';
import {
  type DecodedBullet,
  type DecodedRole,
  type GlowUpData,
  getTopGaps,
  type InterviewPacket,
  keepAnswer,
  loadData,
  mergeGlowUp,
  removeStoredAnswer,
  STORAGE_KEY,
  type Story,
  saveData,
  skillCounts,
  storeKeptAnswer,
} from '../src/lib/glowup-store';
import { decodePostingToBullets } from '../src/lib/posting';
import { deliveryFacts } from '../src/lib/speech/facts';

const skillsOf = (text: string) => detectSkillsFromText(text).map((s) => s.skillId);

function bullet(id: string, text: string, extra: Partial<DecodedBullet> = {}): DecodedBullet {
  return {
    id,
    text,
    status: 'active',
    primarySkillId: null,
    secondarySkillIds: [],
    section: 'required',
    confirmed: false,
    origin: 'parsed',
    ...extra,
  };
}

function makeStory(id: string, extra: Partial<Story> = {}): Story {
  return {
    id,
    primarySkillId: 'lab-technique',
    otherSkillIds: [],
    trigger: `Story ${id}`,
    hook: 'The gel kept smearing.',
    proofSnippet: '',
    play: 'I remade the buffer and reran the samples. Then I wrote down the fix.',
    proof: 'The next six runs were clean. My PI added the step to the protocol.',
    confidence: 60,
    readiness: 'solid',
    questionPrompts: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function makeRole(bullets: DecodedBullet[], extra: Partial<DecodedRole> = {}): DecodedRole {
  return {
    id: 'r1',
    jobTitle: 'Research Technician I',
    company: 'Halvorsen Institute',
    rawJdText: '',
    bullets,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function makePacket(extra: Partial<InterviewPacket> = {}): InterviewPacket {
  return {
    id: 'p1',
    roleId: 'r1',
    mode: 'prep',
    topStoryIds: [],
    customQuestions: [],
    notes: '',
    panicAnswer: '',
    companyIntel: { keywords: [], notes: '', links: [] },
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function data(extra: Partial<GlowUpData> = {}): GlowUpData {
  return {
    version: 1,
    roles: [],
    stories: [],
    packets: [],
    currentRoleId: null,
    currentPacketId: null,
    ...extra,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ============================================================================
// senior.md 1: the decoder reads the fields a student applies to
// ============================================================================

describe('skill tagging for the fields a student applies to', () => {
  it('reads a lab posting as lab work, not SQL or admin', () => {
    expect(
      skillsOf('Run PCR, qPCR, and gel electrophoresis on samples submitted by research groups')
    ).toEqual(['lab-technique']);
    expect(skillsOf('Extract DNA and RNA from tissue and cell culture samples')).toContain(
      'lab-technique'
    );
    expect(
      skillsOf('Hands-on laboratory experience from coursework, research, or employment')
    ).toEqual(['lab-technique', 'research']);
    expect(skillsOf('Undergraduate research experience')).toEqual(['research']);
    expect(skillsOf('Ability to follow written protocols and ask questions')).toEqual([
      'procedures-safety',
    ]);
  });

  it('does not call a records database SQL; a query line still is', () => {
    const records = skillsOf(
      'Record results in the electronic lab notebook and sample tracking database'
    );
    expect(records).not.toContain('sql');
    expect(records).toContain('lab-technique');
    expect(skillsOf('Write SQL queries against the reporting database')).toContain('sql');
    expect(skillsOf('Query the database to pull weekly numbers')).toContain('sql');
  });

  it('tells following an SOP from writing one', () => {
    const following = skillsOf('Prepare reagents and buffers according to SOPs');
    expect(following).toContain('procedures-safety');
    expect(following).not.toContain('process-documentation');
    const writing = skillsOf('Update and maintain SOPs for the team');
    expect(writing).toContain('process-documentation');
    expect(writing).not.toContain('procedures-safety');
  });

  it.each([
    ['Handle cash and card payments accurately at the register', 'cash-handling'],
    ['Greet customers and keep shelves stocked', 'inventory'],
    ['Prepare food following food safety guidelines', 'food-service'],
    ['Supervise children ages 3 to 5 and plan age-appropriate activities', 'childcare'],
    ['Assist patients with activities of daily living and take vital signs', 'patient-care'],
    ['Operate a forklift and pallet jack; pick and pack orders', 'logistics'],
    ['Perform preventive maintenance and minor repairs using hand tools', 'trades'],
    ['Tutor students in algebra and help with homework', 'teaching'],
    ['Meet sales goals by recommending products', 'sales'],
  ])('tags "%s" as %s', (line, skill) => {
    expect(skillsOf(line)).toContain(skill);
  });

  it('keeps the old readings where the new words would mislead', () => {
    // Supervising children is care, not managing people.
    expect(skillsOf('Supervise children during free play')).not.toContain('leadership');
    expect(skillsOf('Supervise a team of five cashiers')).toContain('leadership');
    // Payments at a register are not fintech; payment systems still are.
    expect(skillsOf('Process customer payments at the register')).not.toContain('finance');
    expect(skillsOf('Build payments infrastructure for a fintech')).toContain('finance');
    // Software maintenance is not trade work.
    expect(skillsOf('Maintenance of the codebase and software releases')).not.toContain('trades');
  });

  it('gives each new skill a question to rehearse', () => {
    for (const id of [
      'lab-technique',
      'research',
      'procedures-safety',
      'food-service',
      'childcare',
      'teaching',
      'patient-care',
      'trades',
      'cash-handling',
      'sales',
    ]) {
      const coverage = packetCoverage(
        [bullet('b', 'line', { primarySkillId: id })],
        [],
        undefined,
        'student'
      );
      expect(coverage.rows[0].question, id).not.toBeNull();
    }
  });
});

// ============================================================================
// pros.md 4: every gap, and what was set aside
// ============================================================================

describe('gaps and set-aside lines', () => {
  it('lists every gap, most tested first, not only three', () => {
    const bullets = ['logistics', 'leadership', 'operations', 'budgeting', 'adaptability'].map(
      (skill, i) => bullet(`b${i}`, `line ${i}`, { primarySkillId: skill })
    );
    bullets.push(bullet('b9', 'budget again', { primarySkillId: 'budgeting' }));
    const gaps = getTopGaps(data(), bullets);
    expect(gaps).toHaveLength(5);
    expect(gaps[0]).toBe('budgeting');
  });

  it('lists set-aside lines after a reload and brings one back as a duty', () => {
    const posting = [
      'Director of Operations',
      'Responsibilities',
      '- Lead the regional fulfillment team across three sites',
      '- Own the fulfillment budget and P&L for logistics, about $30M a year',
      'Requirements',
      '- Ten years of operations leadership',
      'Salary range: $150,000 to $180,000',
    ].join('\n');
    const { parsed, bullets } = decodePostingToBullets(posting);
    const role = makeRole(bullets, { rawJdText: posting, parsedJdText: parsed.text });
    const setData = vi.fn();
    render(
      <DecodeSection
        data={data({ roles: [role], currentRoleId: role.id })}
        setData={setData}
        currentRole={role}
      />
    );
    const list = screen.getByTestId('set-aside');
    const kept = bullets.map((b) => b.text);
    const asideTexts = parsed.setAside.filter((l) => l.reason !== 'heading').map((l) => l.text);
    expect(asideTexts.length).toBeGreaterThan(0);
    for (const text of asideTexts) {
      if (!kept.includes(text)) expect(within(list).getByText(text)).toBeInTheDocument();
    }
    const first = asideTexts.find((t) => !kept.includes(t)) as string;
    fireEvent.click(within(list).getAllByRole('button', { name: /Bring back/ })[0]);
    const next = setData.mock.calls.at(-1)?.[0] as GlowUpData;
    const back = next.roles[0].bullets.find((b) => b.text === first);
    expect(back?.section).toBe('responsibility');
    expect(back?.status).toBe('active');
  });
});

// ============================================================================
// complete.md 1: two tabs, one store
// ============================================================================

describe('merging a tab onto newer saved work', () => {
  const base = data({
    roles: [makeRole([], { company: '' })],
    stories: [makeStory('s1'), makeStory('s2')],
    currentRoleId: 'r1',
  });

  it('keeps what this tab changed and what another tab changed', () => {
    const ours = {
      ...base,
      stories: [makeStory('s1', { trigger: 'Edited here' }), base.stories[1]],
    };
    const theirs = {
      ...base,
      roles: [makeRole([], { company: 'NEW COMPANY FROM DESK' })],
      stories: [...base.stories, makeStory('s3')],
    };
    const merged = mergeGlowUp(base, ours, theirs);
    expect(merged.roles[0].company).toBe('NEW COMPANY FROM DESK');
    expect(merged.stories.map((s) => s.trigger)).toEqual(['Edited here', 'Story s2', 'Story s3']);
  });

  it('keeps a delete made here, unless the other tab changed that record since', () => {
    const ours = { ...base, stories: [base.stories[0]] };
    expect(mergeGlowUp(base, ours, base).stories.map((s) => s.id)).toEqual(['s1']);
    const theirs = { ...base, stories: [base.stories[0], makeStory('s2', { trigger: 'Newer' })] };
    expect(mergeGlowUp(base, ours, theirs).stories.map((s) => s.trigger)).toEqual([
      'Story s1',
      'Newer',
    ]);
  });

  it('drops a current id that points at nothing', () => {
    const theirs = { ...base, roles: [], currentRoleId: null };
    expect(mergeGlowUp(base, base, theirs).currentRoleId).toBeNull();
  });
});

// ============================================================================
// complete.md 16: the competency view and packet coverage
// ============================================================================

describe('packet coverage', () => {
  const bullets = [
    bullet('b1', 'Run PCR and gels', { primarySkillId: 'lab-technique' }),
    bullet('b2', 'Follow written protocols', { primarySkillId: 'procedures-safety' }),
    bullet('b3', 'Catch errors in records', { primarySkillId: 'attention-to-detail' }),
    bullet('b4', 'Some line', { primarySkillId: null }),
  ];

  it('counts only packed, written stories, by readiness, with no percentage', () => {
    const packed = makeStory('s1', { readiness: 'rough' });
    const library = makeStory('s2', { primarySkillId: 'procedures-safety' });
    const idk = makeStory('s3', { primarySkillId: 'attention-to-detail', play: 'idk' });
    const coverage = packetCoverage(
      bullets,
      [packed, library, idk],
      makePacket({ topStoryIds: ['s1', 's3', 'deleted'] }),
      'student'
    );
    expect(coverage.total).toBe(3);
    expect(coverage.untagged).toBe(1);
    expect(coverage.covered).toBe(1);
    expect(coverage.byReadiness).toEqual({ rehearsed: 0, solid: 0, rough: 1 });
    expect(coverage.rows[1].story).toBeNull(); // in the library, not packed
    expect(coverage.rows[2].story).toBeNull(); // packed, but "idk"
  });

  it('prefers the most ready packed story for a line', () => {
    const coverage = packetCoverage(
      bullets,
      [makeStory('s1', { readiness: 'rough' }), makeStory('s2', { readiness: 'rehearsed' })],
      makePacket({ topStoryIds: ['s1', 's2'] }),
      'student'
    );
    expect(coverage.rows[0].story?.id).toBe('s2');
    expect(coverage.byReadiness.rehearsed).toBe(1);
  });

  it('shows each requirement with a question, strong answer, mistake, and story', () => {
    const role = makeRole(bullets);
    const packet = makePacket({ topStoryIds: ['s1'] });
    render(
      <PacketSection
        data={data({ roles: [role], stories: [makeStory('s1')], packets: [packet] })}
        setData={vi.fn()}
        currentRole={role}
        currentPacket={packet}
        onLaunchHUD={vi.fn()}
        onGoToStories={vi.fn()}
        onGoToDecode={vi.fn()}
      />
    );
    expect(screen.getByTestId('packet-coverage')).toHaveTextContent(
      'Stories in this packet answer 1 of 3 requirements: 0 rough, 1 solid, 0 rehearsed.'
    );
    const view = screen.getByTestId('competency-view');
    expect(within(view).getByText('Run PCR and gels')).toBeInTheDocument();
    expect(within(view).getByText(/Your story: Story s1 \(Solid\)/)).toBeInTheDocument();
    expect(within(view).getAllByText('A strong answer shows').length).toBeGreaterThan(0);
    // One cheat-sheet button on this tab, at the bottom.
    expect(screen.getAllByRole('button', { name: 'Open the cheat sheet (HUD)' })).toHaveLength(1);
    expect(screen.getByTestId('packet-hud-missing')).toHaveTextContent(
      'Not on your cheat sheet yet: keywords, a fallback story, and questions to ask them.'
    );
  });
});

// ============================================================================
// senior.md 11, pros.md 13: the HUD
// ============================================================================

describe('the cheat sheet (HUD)', () => {
  it('shows what you did and the whole proof on the collapsed card, and links to rehearsal', () => {
    const story = makeStory('s1', {
      proof:
        'Escalations to VPs stopped within a quarter. Peak late orders fell from 4.1% to 1.6% the next season.',
    });
    render(
      <InterviewHUD
        packet={makePacket({ topStoryIds: ['s1'] })}
        stories={[story]}
        role={makeRole([])}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('hud-play')).toHaveTextContent('I remade the buffer and reran');
    expect(screen.getByTestId('hud-proof')).toHaveTextContent('from 4.1% to 1.6%');
    expect(screen.getByRole('link', { name: 'Rehearse these questions' })).toHaveAttribute(
      'href',
      '/interview-glow-up/rehearse/'
    );
    expect(screen.getByTestId('hud-missing')).toHaveTextContent(
      'Not on this cheat sheet yet: keywords, a fallback story, and questions to ask them.'
    );
  });

  it('picks the proof sentence that holds the number for the one-line snippet', () => {
    expect(
      proofLine(
        'Escalations to VPs stopped within a quarter. Peak late orders fell from 4.1% to 1.6% the next season.'
      )
    ).toBe('Peak late orders fell from 4.1% to 1.6% the next season.');
    expect(proofLine('Cut wait times by 40%. Customers noticed.')).toBe('Cut wait times by 40%.');
  });
});

// ============================================================================
// pros.md 8: register
// ============================================================================

it('offers senior questions to ask, and keeps the student list for students', () => {
  expect(questionsToAsk('experienced')).toContain(
    'What does this role need to deliver in the first year?'
  );
  expect(questionsToAsk('experienced')).not.toContain(
    'How will I learn the job in the first weeks?'
  );
  expect(questionsToAsk('student')).toContain('How will I learn the job in the first weeks?');
});

// ============================================================================
// pros.md 11, firstjob.md 11, complete.md 15: rehearsal questions
// ============================================================================

describe('rehearsal questions', () => {
  it('reads a posting duty as spoken English', () => {
    expect(
      tidyQuestionText(
        'Tell me about a time you had to build a operating cadence: weekly KPI reviews, quarterly business reviews with 3PL partners.'
      )
    ).toBe('Tell me about a time you had to build an operating cadence.');
    expect(tidyQuestionText('Walk me through how you would train a user on an new tool.')).toBe(
      'Walk me through how you would train a user on a new tool.'
    );
  });

  it('asks about a leadership line the posting questions leave out', () => {
    const fromPosting = Array.from({ length: 8 }, (_, i) => ({
      question: `How have you used tool ${i}, and for what?`,
      requirement: `Tool ${i}`,
      skillIds: ['data-analysis'],
    }));
    const plan = planRehearsal({
      audience: 'experienced',
      fromPosting,
      requirements: [
        {
          text: 'Proven ability to lead through change and influence without authority',
          skillIds: ['leadership'],
        },
      ],
    });
    const people = plan.find((q) => q.requirement?.startsWith('Proven ability to lead'));
    expect(people?.question).toBe(
      'Tell me about a time you got something done without authority over the people involved.'
    );
  });

  it('asks the packet questions the visitor ticked, right after the opener', () => {
    const plan = planRehearsal({
      audience: 'student',
      chosen: [
        { question: 'What would you do on your first day?', requirement: null, skillIds: [] },
      ],
    });
    expect(plan[0].questionId).toBe('q-intro');
    expect(plan[1].question).toBe('What would you do on your first day?');
  });

  it('lists the questions in a saved list, never its notes', () => {
    expect(
      packetQuestionLines(
        '1. Tell me about a time you used SQL.\n   Tests: Write SQL queries\n\n- Why this lab?\nSome note\n2) How do you check your work?'
      )
    ).toEqual([
      'Tell me about a time you used SQL.',
      'Why this lab?',
      'How do you check your work?',
    ]);
  });

  it('fits the checklist to the question', () => {
    const sponsorship = selfCheckFor({ questionId: 'q-work-authorization' }).map((c) => c.label);
    expect(sponsorship).toContain('I answered yes or no first');
    expect(sponsorship).not.toContain('I said what happened because of it');
    expect(selfCheckFor({ questionId: 'q-intro' }).map((c) => c.label)).toContain(
      'I ended on why I want this job'
    );
    expect(selfCheckFor(null).map((c) => c.label)).toContain('I said what happened because of it');
  });

  it('offers first-job questions to a student', () => {
    const ids = optionalQuestionIds('student');
    expect(ids).toContain('q-availability');
    expect(ids).toContain('q-upset-customer');
    expect(ids).not.toContain('q-chg-why-change');
    expect(getQuestionById('q-availability')?.text).toBe('What days and hours can you work?');
    expect(optionalQuestionIds('career-changer')).toContain('q-chg-why-change');
  });

  it('notes what a written answer has, as questions, from words it can quote', () => {
    const dani = answerNotes('im dani im a senior and i like robotics and i babysit my cousin', {
      company: 'Greenleaf Grocery',
      jobTitle: 'Cashier',
      askAboutJob: true,
    });
    expect(dani).toEqual([
      {
        id: 'job',
        found: false,
        text: 'Does it say why this job? It does not mention Greenleaf Grocery or the work yet.',
      },
      {
        id: 'example',
        found: false,
        text: 'Is there one example? Try one thing you did, and what happened.',
      },
    ]);
    const better = answerNotes(
      'I want to work at Greenleaf Grocery. Last summer I counted the till at the pool snack bar every night.',
      { company: 'Greenleaf Grocery', jobTitle: 'Cashier', askAboutJob: true }
    );
    expect(better[0]).toMatchObject({ found: true, text: 'It names "Greenleaf Grocery".' });
    expect(better[1].found).toBe(true);
    expect(better[1].text).toContain('Last summer I counted the till');
  });
});

// ============================================================================
// firstjob.md 11, senior.md 17, complete.md 18: kept answers
// ============================================================================

describe('kept answers', () => {
  it('keeps an answer only on request, survives a reload, and can be deleted', () => {
    saveData(data());
    const kept = storeKeptAnswer({
      roleId: null,
      question: 'Tell me about yourself.',
      questionId: 'q-intro',
      skillIds: [],
      text: 'I am Dani.',
      mode: 'typed',
    });
    expect(kept).not.toBeNull();
    expect(loadData().answers?.[0].text).toBe('I am Dani.');
    expect(removeStoredAnswer(kept?.id as string)).toBe(true);
    expect(loadData().answers).toEqual([]);
  });

  it('leaves an older save without answers as it was', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data()));
    expect('answers' in loadData()).toBe(false);
  });

  it('opens a story draft from a kept answer, with the question attached', () => {
    const { answer } = keepAnswer(data(), {
      roleId: 'r1',
      question: 'Tell me about a time you caught a mistake everyone else missed.',
      questionId: 'q-detail-catch',
      skillIds: ['attention-to-detail'],
      text: '  I noticed the labels were swapped.  ',
      mode: 'typed',
    });
    const editor = storyEditorFromAnswer(answer);
    expect(editor.editingId).toBe('new');
    expect(editor.formData.play).toBe('I noticed the labels were swapped.');
    expect(editor.formData.primarySkillId).toBe('attention-to-detail');
    expect(editor.formData.questionPrompts).toEqual(['q-detail-catch']);
  });

  it('counts the answers given, keeps one, and lists it on the next visit', async () => {
    saveData(data());
    render(<RehearsalRoom />);
    fireEvent.click(await screen.findByRole('radio', { name: /In writing/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with the first question' }));
    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: 'I am a senior and I like robotics.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review my answer' }));
    expect(await screen.findByTestId('answer-notes')).toBeInTheDocument();
    expect(
      screen.getByText('Filler words, pace and pauses are counted only when you answer out loud.')
    ).toBeInTheDocument();
    // Skip the rest.
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    for (let i = 0; i < 20; i++) {
      const skip = screen.queryByRole('button', {
        name: /Skip to the next question|Skip and finish/,
      });
      if (!skip) break;
      fireEvent.click(skip);
    }
    const summary = await screen.findByTestId('rehearsal-summary');
    expect(summary.textContent).toMatch(/^You answered 1 of \d+ questions\.$/);
    expect(loadData().answers ?? []).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Keep this answer/ }));
    expect(loadData().answers?.[0]).toMatchObject({
      question: 'Tell me about yourself.',
      text: 'I am a senior and I like robotics.',
      mode: 'typed',
    });
    cleanup();
    render(<RehearsalRoom />);
    const kept = await screen.findByTestId('kept-answers');
    expect(within(kept).getByText('I am a senior and I like robotics.')).toBeInTheDocument();
    expect(within(kept).getByRole('link', { name: /Use as a story draft/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/interview-glow-up\/workspace\/\?draft=/)
    );
  });

  it('lists packet questions to tick, and asks a ticked one first', async () => {
    const role = makeRole([]);
    saveData(
      data({
        roles: [role],
        currentRoleId: role.id,
        packets: [makePacket({ aiQuestions: '1. Why this lab?\n   Tests: fit' })],
      })
    );
    render(<RehearsalRoom />);
    const list = await screen.findByTestId('rehearsal-packet-questions');
    const box = within(list).getByRole('checkbox', { name: 'Why this lab?' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('radio', { name: /In writing/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with the first question' }));
    expect(screen.getByTestId('rehearsal-question')).toHaveTextContent('Tell me about yourself.');
    fireEvent.click(screen.getByRole('button', { name: 'Skip to the next question' }));
    expect(screen.getByTestId('rehearsal-question')).toHaveTextContent('Why this lab?');
  });
});

// ============================================================================
// complete.md 19: replay from a counted moment
// ============================================================================

describe('replay from the counts', () => {
  const segments = [
    { text: 'Um so I started', start: 0, end: 2 },
    { text: 'with the schedule', start: 6, end: 8 },
  ];
  const take: Take = {
    question: 'Tell me about a schedule.',
    audio: {
      blob: new Blob(['x'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 9000,
    },
    text: 'Um so I started with the schedule',
    segments,
    durationSeconds: 9,
  } as Take;

  it('gives times only while the transcript lines up with its segments', () => {
    const aligned = deliveryFacts({ text: take.text, segments, durationSeconds: 9 });
    expect(replayTimes(aligned)).toEqual({ fillers: { um: [0] }, pauses: [2] });
    const edited = deliveryFacts({
      text: 'Um so I began with the schedule',
      segments,
      durationSeconds: 9,
    });
    expect(replayTimes(edited).fillers).toEqual({});
  });

  it('plays the recording from a second before the counted moment', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:take');
    URL.revokeObjectURL = vi.fn();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    render(
      <TakeReview
        take={take}
        transcribing={false}
        canTranscribe
        onTextChange={vi.fn()}
        onKeep={null}
        kept={false}
        onRetry={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
        countDelivery
        onCountDeliveryChange={vi.fn()}
      />
    );
    const pause = await screen.findByRole('button', { name: 'Play the pause at 0:02' });
    const audio = document.querySelector('audio') as HTMLAudioElement;
    await act(async () => fireEvent.click(pause));
    expect(audio.currentTime).toBe(1);
    expect(play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play "um" at 0:00' })).toBeInTheDocument();
  });
});

// ============================================================================
// senior.md 8 (workspace part): link instead of a second application
// ============================================================================

it('finds an unlinked application with the same title to link the role to', () => {
  const app = (extra: Partial<TrackedApplication>): TrackedApplication => ({
    id: 'a1',
    title: 'Research Technician I',
    company: '',
    deadline: null,
    roleId: null,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  });
  const role = { jobTitle: 'research technician i', company: 'Halvorsen Institute' };
  expect(unlinkedMatch([app({})], role)?.id).toBe('a1');
  expect(unlinkedMatch([app({ roleId: 'other' })], role)).toBeNull();
  expect(unlinkedMatch([app({ company: 'Elsewhere Labs' })], role)).toBeNull();
  expect(unlinkedMatch([app({ title: 'Pharmacy technician' })], role)).toBeNull();
});

it('decodes the research technician posting as lab work first, with no SQL', () => {
  const posting = readFileSync('tests/fixtures/postings/research-technician.txt', 'utf8');
  const { bullets } = decodePostingToBullets(posting);
  const { counts } = skillCounts(bullets);
  expect(counts[0]).toEqual({ skillId: 'lab-technique', count: 8 });
  expect(counts.map((c) => c.skillId).slice(0, 3)).toEqual([
    'lab-technique',
    'procedures-safety',
    'research',
  ]);
  expect(counts.map((c) => c.skillId)).not.toContain('sql');
  expect(counts.map((c) => c.skillId)).not.toContain('process-documentation');
});
