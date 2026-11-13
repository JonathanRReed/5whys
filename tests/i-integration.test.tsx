/**
 * Batch I, integration: items handed back by the five fix batches that
 * crossed into files they did not own. Each block names its item.
 */
import { File as NodeFile } from 'node:buffer';
import { fireEvent, render, screen } from '@testing-library/react';
import JSZip from 'jszip';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationsPanel from '../src/components/ApplicationsPanel';
import { matchSelection } from '../src/components/application-desk/ResumeStation';
import { sendState } from '../src/components/application-desk/SendStation';
import { readReflectionForReuse as outcomeReflection } from '../src/components/career-5whys/outcome';
import { roomTarget } from '../src/components/rehearsal/RehearsalRoom';
import {
  getDesk,
  loadApplicationDesks,
  normalizeDesk,
  normalizeDeskData,
  setLastStation,
  setResumeSelection,
  updateBulletsFlow,
  updateDesk,
} from '../src/lib/application-desk';
import { loadApplications } from '../src/lib/applications';
import {
  readCareerDashboard,
  readReflectionForReuse,
  readResumeRewrites,
  readSendInputs,
  withRole,
} from '../src/lib/career-bridge';
import { createDefaultData, createRole, loadData } from '../src/lib/glowup-store';
import { questionForRequirement } from '../src/lib/local-ai/requirement-questions';
import { computeNextStep } from '../src/lib/networking-advice';
import { parsePosting } from '../src/lib/posting';
import { mentionsPay } from '../src/lib/posting/parse';
import { toDocx } from '../src/lib/resume-doc';
import { fromText } from '../src/lib/resume-doc/model';
import { placeableRewrites } from '../src/lib/resume-doc/tailor';
import {
  collectBackup,
  parseBackup,
  restoreBackup,
  STUDIO_STORAGE_KEYS,
} from '../src/lib/studio-backup';

beforeAll(() => {
  vi.stubGlobal('File', NodeFile);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
});

const put = (key: string, value: unknown) =>
  window.localStorage.setItem(key, JSON.stringify(value));

/** The paragraphs of a .docx, read from its document.xml. */
async function docxParagraphs(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  return [...xml.matchAll(/<w:p>(.*?)<\/w:p>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  );
}

// ============================================================================
// Item 1: a rewrite carries the occurrence of its line
// ============================================================================

describe('item 1: rewrites name which occurrence of a repeated line they replace', () => {
  const RESUME = [
    'Jordan Lee',
    'jordan@example.edu',
    'EXPERIENCE',
    'Library aide, City Library',
    '- Answered questions at the front desk.',
    'Front desk, Campus Gym',
    '- Answered questions at the front desk.',
  ].join('\n');
  const BETTER = 'Answered about 40 member questions a shift at the gym front desk.';

  beforeEach(() => {
    put('resume-game-session-v2', {
      resumeText: RESUME,
      bullets: [
        {
          id: 'b1',
          original: '- Answered questions at the front desk.',
          improved: '- Answered questions at the front desk.',
          edited: false,
        },
        {
          id: 'b2',
          original: '- Answered questions at the front desk.',
          improved: BETTER,
          edited: true,
        },
      ],
      lastAnalyzedAt: null,
    });
  });

  it('counts unedited lines too, so the second line is occurrence 1', () => {
    expect(readResumeRewrites()).toEqual([
      { original: '- Answered questions at the front desk.', improved: BETTER, occurrence: 1 },
    ]);
  });

  it('lands on the second line in the downloaded .docx, and only there', async () => {
    const doc = fromText(RESUME);
    const rewrites = readResumeRewrites();
    // Without the occurrence the rewrite could not be placed: it was left out.
    expect(
      placeableRewrites(
        doc,
        rewrites.map(({ original, improved }) => ({ original, improved }))
      ).unplaced
    ).toHaveLength(1);
    const placeable = placeableRewrites(doc, rewrites);
    expect(placeable.unplaced).toEqual([]);
    const lines = await docxParagraphs(await toDocx(doc, { rewrites: placeable.rewrites }));
    const gym = lines.findIndex((line) => line.startsWith('Front desk, Campus Gym'));
    expect(gym).toBeGreaterThan(-1);
    const better = lines.findIndex((line) => line.includes(BETTER));
    expect(better).toBeGreaterThan(gym);
    const library = lines.findIndex((line) => line.startsWith('Library aide'));
    const original = lines.findIndex((line) =>
      line.includes('Answered questions at the front desk')
    );
    expect(original).toBeGreaterThan(library);
    expect(original).toBeLessThan(gym);
    expect(lines.filter((line) => line.includes(BETTER))).toHaveLength(1);
  });
});

// ============================================================================
// Items 2, 3, 11: the desk keeps the draft, repeated choices, and the station
// ============================================================================

describe('item 2: the bullet draft is part of the desk', () => {
  it('is absent until written, and an update sets and clears it', () => {
    const empty = normalizeDeskData({ desks: { a: {} } });
    expect(getDesk(empty, 'a').bullets.draft).toBeUndefined();
    const drafted = updateBulletsFlow(empty, 'a', {
      draft: { verb: 'Ran', task: 'the bake sale', result: '' },
    });
    expect(getDesk(drafted, 'a').bullets.draft).toEqual({
      verb: 'Ran',
      task: 'the bake sale',
      result: '',
    });
    const edited = updateBulletsFlow(drafted, 'a', { draft: { result: 'raised $300' } });
    expect(getDesk(edited, 'a').bullets.draft).toEqual({
      verb: 'Ran',
      task: 'the bake sale',
      result: 'raised $300',
    });
    // Other changes keep it.
    const typed = updateBulletsFlow(edited, 'a', { impact: 'More people came' });
    expect(getDesk(typed, 'a').bullets.draft?.result).toBe('raised $300');
    expect(getDesk(updateBulletsFlow(typed, 'a', { draft: null }), 'a').bullets.draft).toBe(
      undefined
    );
  });

  it('normalizes a hand-edited draft and drops one of the wrong shape', () => {
    expect(
      normalizeDesk({ bullets: { draft: { verb: 3, task: 'Counted', result: null } } }).bullets
        .draft
    ).toEqual({ verb: '', task: 'Counted', result: '' });
    expect(normalizeDesk({ bullets: { draft: 'Ran it' } }).bullets.draft).toBeUndefined();
  });
});

describe('item 3: two identical lines chosen are both remembered', () => {
  const LINE = 'answered questions at the front desk.';

  it('keeps the repeat when saving and when reading back', () => {
    const saved = setResumeSelection(normalizeDeskData({}), 'a', ['l4', 'l6'], [LINE, LINE]);
    expect(getDesk(saved, 'a').resumeSelection?.bulletTexts).toEqual([LINE, LINE]);
    const reread = normalizeDeskData(JSON.parse(JSON.stringify(saved)));
    expect(getDesk(reread, 'a').resumeSelection?.bulletTexts).toEqual([LINE, LINE]);
    // Matched back after a reload: both lines, not one.
    const bullets = [
      { id: 'l4', key: LINE },
      { id: 'l5', key: 'counted the drawer.' },
      { id: 'l6', key: LINE },
    ];
    expect(matchSelection(bullets, getDesk(reread, 'a').resumeSelection).ids).toEqual(['l4', 'l6']);
  });
});

describe('item 11: the station last opened is kept in the desk, not as work', () => {
  it('remembers it without moving the time of the work', () => {
    const data = updateDesk(normalizeDeskData({}), 'a', (desk) => desk);
    const before = getDesk(data, 'a').updatedAt;
    const next = setLastStation(data, 'a', 'letter');
    expect(getDesk(next, 'a').lastStation).toBe('letter');
    expect(getDesk(next, 'a').updatedAt).toBe(before);
    // Already remembered: nothing to write.
    expect(setLastStation(next, 'a', 'letter')).toBe(next);
  });

  it('reads back a valid station only', () => {
    expect(normalizeDesk({ lastStation: 'send' }).lastStation).toBe('send');
    expect(normalizeDesk({ lastStation: 'kitchen' }).lastStation).toBeUndefined();
    expect(normalizeDesk({ lastStation: 4 }).lastStation).toBeUndefined();
  });
});

// ============================================================================
// Item 5: the dashboard's "Mark as sent" has the desk's gate
// ============================================================================

describe('item 5: the dashboard arms "Mark as sent" when the letter is not ready', () => {
  function seed(hook: string) {
    put('career-applications', {
      version: 1,
      activeId: 'a',
      applications: [
        {
          id: 'a',
          title: 'Library aide',
          company: 'City Library',
          deadline: null,
          roleId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    put('career-application-desk', {
      version: 1,
      desks: { a: { letter: { hook, whyYou: '', whyThem: '', closingAsk: '' } } },
    });
  }

  it('reads the same blocker the desk computes', () => {
    seed('I shelved books for two years. [your proof]');
    const inputs = readSendInputs('a');
    expect(inputs).not.toBeNull();
    const blocker = inputs
      ? sendState(inputs.letter, inputs.title, inputs.company, inputs.requirements, inputs.rows)
          .blocker
      : null;
    expect(blocker).toBe('The letter still has [your proof].');
    expect(readSendInputs('missing')).toBeNull();
  });

  it('asks in place first, and marks only on the second press', () => {
    seed('I shelved books for two years. [your proof]');
    const { applications } = readCareerDashboard();
    render(
      <ApplicationsPanel
        applications={applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as sent: Library aide' }));
    expect(loadApplications().applications[0].sentOn ?? null).toBeNull();
    const confirm = screen.getByRole('button', {
      name: /The letter still has \[your proof\]\. Mark as sent anyway/,
    });
    fireEvent.click(confirm);
    expect(loadApplications().applications[0].sentOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("marks at once when nothing is open (a letter not written is the visitor's choice)", () => {
    seed('');
    const inputs = readSendInputs('a');
    expect(
      inputs &&
        sendState(inputs.letter, inputs.title, inputs.company, inputs.requirements, inputs.rows)
          .blocker
    ).toBeNull();
    const { applications } = readCareerDashboard();
    render(
      <ApplicationsPanel
        applications={applications}
        readiness={{ resumeScored: false, practiceRounds: 0, storyCount: 0 }}
        onChanged={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as sent: Library aide' }));
    expect(loadApplications().applications[0].sentOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================================
// Item 6: a dollar figure is pay only beside a pay word
// ============================================================================

describe('item 6: pay is told from money the job handles', () => {
  it.each([
    '$18 an hour',
    'Salary range: $44,000 to $48,000 per year',
    'Pay is $17.50 per hour, paid weekly.',
    'Starting at $45K a year',
    'A $500 signing bonus after 90 days',
  ])('"%s" is pay', (line) => {
    expect(mentionsPay(line)).toBe(true);
  });

  it.each([
    'Own the fulfillment budget and P&L, about $30M a year',
    'Manage a $2M budget',
    'Process invoices up to $5,000',
    'Grow a $40M book of business across 12 accounts',
  ])('"%s" is not pay', (line) => {
    expect(mentionsPay(line)).toBe(false);
  });

  it('keeps a duty with a figure and sets pay aside', () => {
    const posting = [
      'Operations Manager',
      'What you will do',
      '- Own the fulfillment budget and P&L, about $30M a year',
      '- Manage a $2M budget for seasonal staffing',
      '- Process invoices up to $5,000 without a second approval',
      'Pay',
      '- $18 an hour',
      'Salary range: $44,000 to $48,000 per year',
    ].join('\n');
    const parsed = parsePosting(posting);
    const kept = parsed.requirements.map((r) => r.text);
    expect(kept).toContain('Own the fulfillment budget and P&L, about $30M a year');
    expect(kept).toContain('Manage a $2M budget for seasonal staffing');
    expect(kept).toContain('Process invoices up to $5,000 without a second approval');
    expect(kept.some((text) => text.includes('$18'))).toBe(false);
    expect(kept.some((text) => text.includes('$44,000'))).toBe(false);
    const pay = parsed.setAside.filter((line) => line.text.includes('$'));
    expect(pay.length).toBeGreaterThanOrEqual(2);
    for (const line of pay) expect(['job-details', 'outside-requirements']).toContain(line.reason);
  });
});

// ============================================================================
// Item 7: questions built from a duty read as spoken English at the source
// ============================================================================

describe('item 7: a duty becomes a question without a pasted list or a wrong article', () => {
  it('drops the list after a colon and says "an" before a vowel sound', () => {
    const past = questionForRequirement(
      'Build our operating cadence: weekly KPI reviews, quarterly business reviews with 3PL partners',
      { audience: 'experienced', taskIndex: 0 }
    );
    expect(past?.question).toBe('Tell me about a time you had to build an operating cadence.');
  });

  it('keeps "a" before a consonant sound and fixes "an" before one', () => {
    const walk = questionForRequirement('Train a user on an new tool', {
      audience: 'student',
      taskIndex: 0,
    });
    expect(walk?.question).toBe('Walk me through how you would train a user on a new tool.');
  });
});

// ============================================================================
// Item 8: the dashboard reads practice and reflections the way the tools do
// ============================================================================

describe('item 8a: kept rehearsal answers count as interview practice', () => {
  it('counts them, by role, and says so in the ledger', () => {
    const glow = createRole(createDefaultData(), {
      jobTitle: 'Library aide',
      company: 'City Library',
      rawJdText: '',
      bullets: [],
    });
    const roleId = glow.currentRoleId as string;
    put('interview-glow-up-data', {
      ...glow,
      answers: [
        {
          id: 'k1',
          roleId,
          question: 'Tell me about yourself.',
          skillIds: [],
          text: 'I am a senior.',
          mode: 'typed',
          createdAt: 5,
          updatedAt: 5,
        },
        {
          id: 'k2',
          roleId: null,
          question: 'Why this job?',
          skillIds: [],
          text: 'I like books.',
          mode: 'typed',
          createdAt: 6,
          updatedAt: 6,
        },
      ],
    });
    put('career-applications', {
      version: 1,
      activeId: 'a',
      applications: [
        {
          id: 'a',
          title: 'Library aide',
          company: 'City Library',
          deadline: null,
          roleId,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const data = readCareerDashboard();
    expect(data.hasData).toBe(true);
    expect(data.glowup?.answerCount).toBe(2);
    expect(data.applications[0].keptAnswers).toBe(1);
  });
});

describe('item 8b: a written rep gets the written next step on the dashboard', () => {
  it('matches what the tool shows for a written scenario', () => {
    const ratings = { confidence: 4, clarity: 2, rapport: 4, authenticity: 4 };
    const draft = 'Hi Ms. Patel. I saw your talk. I study biology. Could we talk? Are you hiring?';
    put('networking-practice-sessions', [
      {
        id: 's1',
        scenarioId: 'linkedin',
        scenarioTitle: 'LinkedIn note',
        createdAt: '2026-11-12T10:00:00.000Z',
        ratings,
        attempts: [
          {
            id: 't1',
            script: draft,
            label: 'Take 1',
            durationSeconds: 30,
            createdAt: '2026-11-12T10:00:00.000Z',
          },
        ],
      },
    ]);
    const written = computeNextStep(ratings, { written: true, draft });
    expect(written).not.toBe(computeNextStep(ratings));
    expect(readCareerDashboard().networking?.nextStep).toBe(written);
  });
});

describe('item 8c: a chain started from an experience reads as one', () => {
  it('uses the experience next step on the dashboard', () => {
    const answers = [
      'On Saturdays I close the bakery alone and write the list for the morning crew.',
      'Writing the list for the morning crew, so they know exactly what to do.',
      'It means I left things easier for someone else, and my work keeps going.',
      'In group projects I make the shared doc and the checklist for everyone.',
      'A job would have to let me set things up so a team runs smoothly.',
    ];
    put('career-why-session-v2', {
      track: 'interest',
      start: 'experience',
      topic: 'Closing the bakery',
      responses: answers,
    });
    const step = readCareerDashboard().reflection?.nextStep ?? '';
    expect(step).toMatch(/the part you liked most/);
  });
});

describe('item 8d: one networking rep produces one next action', () => {
  it('lists the rep once across next actions and suggestions', () => {
    put('networking-practice-sessions', [
      {
        id: 's1',
        scenarioId: 'career-fair',
        scenarioTitle: 'Career fair',
        createdAt: '2026-11-12T10:00:00.000Z',
        ratings: { confidence: 2, clarity: 4, rapport: 4, authenticity: 4 },
      },
    ]);
    const data = readCareerDashboard();
    const fromRep = [...data.nextActions, ...data.recommendations].filter(
      (item) => item.tool === 'Networking Practice'
    );
    expect(fromRep).toHaveLength(1);
  });
});

describe('item 8e: the bridge offers the reflection for reuse, as before', () => {
  const answers = [
    'I like helping people get better at something they find hard at first.',
    'Because I remember how good it felt when a coach finally explained it well.',
    'It showed me that patience can change how someone sees themselves.',
    'I want my work to leave people more confident than I found them.',
    'Growth for other people is the value at the root of all of it for me.',
  ];
  const cases: Array<[string, () => void]> = [
    ['nothing saved', () => {}],
    [
      'an unfinished session',
      () =>
        put('career-why-session-v2', { track: 'career', topic: 'Teaching', responses: ['One'] }),
    ],
    [
      'a finished session with a statement',
      () =>
        put('career-why-session-v2', {
          track: 'career',
          topic: 'Teaching',
          responses: answers,
          statement: 'Mine',
          mustOffer: 'Time with students',
        }),
    ],
    [
      'a finished experience session',
      () =>
        put('career-why-session-v2', {
          track: 'interest',
          start: 'experience',
          topic: 'Tutoring my brother',
          responses: answers,
        }),
    ],
    [
      'only a snapshot',
      () =>
        put('career-why-history', [
          {
            id: 'h1',
            track: 'career',
            topic: 'Nursing',
            responses: answers,
            timestamp: '2026-11-01T00:00:00Z',
          },
        ]),
    ],
    ['a corrupt history', () => window.localStorage.setItem('career-why-history', '{')],
  ];
  it.each(cases)('agrees with the Five Whys reader for %s', (_name, seed) => {
    seed();
    expect(readReflectionForReuse()).toEqual(outcomeReflection());
  });
});

// ============================================================================
// Item 10: links that name the role, and the rehearsal room reading them
// ============================================================================

describe('item 10: a link names the role it is about', () => {
  it('adds the role to a link, keeping its query and hash', () => {
    expect(withRole('/interview-glow-up/rehearse/', 'r 1')).toBe(
      '/interview-glow-up/rehearse/?role=r%201'
    );
    expect(withRole('/interview-glow-up/workspace/?tab=packet', 'r1')).toBe(
      '/interview-glow-up/workspace/?tab=packet&role=r1'
    );
    expect(withRole('/x/?a=1#b', 'r1')).toBe('/x/?a=1&role=r1#b');
    expect(withRole('/x/', null)).toBe('/x/');
  });

  it('the rehearsal room opens on the role or application named, and ignores an unknown id', () => {
    let glow = createRole(createDefaultData(), {
      jobTitle: 'First',
      company: '',
      rawJdText: '',
      bullets: [],
    });
    const first = glow.currentRoleId as string;
    glow = createRole(glow, { jobTitle: 'Second', company: '', rawJdText: '', bullets: [] });
    const second = glow.currentRoleId as string;
    const apps = [
      { id: 'a1', roleId: first },
      { id: 'a2', roleId: second },
    ];
    // No parameter: the current role, and the application tracking it.
    expect(roomTarget(glow, apps, '')).toMatchObject({ applicationId: 'a2', asked: false });
    expect(roomTarget(glow, apps, '').role?.id).toBe(second);
    // A role named.
    const byRole = roomTarget(glow, apps, `?role=${first}`);
    expect(byRole.role?.id).toBe(first);
    expect(byRole).toMatchObject({ applicationId: 'a1', asked: true });
    // An application named.
    const byApp = roomTarget(glow, apps, '?application=a1');
    expect(byApp.role?.id).toBe(first);
    expect(byApp.applicationId).toBe('a1');
    // Unknown ids change nothing.
    const unknown = roomTarget(glow, apps, '?role=nope&application=nope');
    expect(unknown.role?.id).toBe(second);
    expect(unknown).toMatchObject({ applicationId: 'a2', asked: false });
  });

  it('the dashboard cards carry the role', () => {
    const glow = createRole(createDefaultData(), {
      jobTitle: 'Library aide',
      company: 'City Library',
      rawJdText: 'Shelve books',
      bullets: [],
    });
    const roleId = glow.currentRoleId as string;
    put('interview-glow-up-data', glow);
    put('career-applications', {
      version: 1,
      activeId: 'a',
      applications: [
        {
          id: 'a',
          title: 'Library aide',
          company: 'City Library',
          deadline: null,
          roleId,
          sentOn: '2026-11-01',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const rec = readCareerDashboard().recommendations.find((r) => r.tool === 'Interview Glow Up');
    expect(rec?.href).toBe(`/interview-glow-up/rehearse/?role=${encodeURIComponent(roleId)}`);
  });
});

// ============================================================================
// Item 12: the backup checks the new fields and carries them
// ============================================================================

const NEW_FIELDS = {
  'career-why-session-v2': {
    track: 'interest',
    start: 'experience',
    topic: 'Closing the bakery',
    responses: ['a', 'b', 'c', 'd', 'e'],
    rootIndex: 2,
    statement: 'I like leaving things easier for the next person',
    mustOffer: 'A team to set up',
    canGiveUp: 'A big title',
  },
  'career-why-history': [
    {
      id: 'h1',
      track: 'interest',
      start: 'experience',
      topic: 'Closing the bakery',
      responses: ['a', 'b', 'c', 'd', 'e'],
      timestamp: '2026-11-01T00:00:00.000Z',
      statement: 'Saved statement',
      mustOffer: 'Saved must',
      canGiveUp: 'Saved give',
    },
  ],
  'interview-glow-up-data': {
    version: 1,
    roles: [],
    stories: [],
    packets: [],
    answers: [
      {
        id: 'k1',
        roleId: null,
        question: 'Tell me about yourself.',
        questionId: 'q-intro',
        requirement: null,
        skillIds: ['communication'],
        text: 'I am a senior.',
        mode: 'spoken',
        createdAt: 5,
        updatedAt: 6,
      },
    ],
  },
  'career-applications': {
    version: 1,
    activeId: null,
    applications: [
      {
        id: 'a',
        title: 'Clerk',
        company: '',
        deadline: null,
        roleId: null,
        setAside: { on: '2026-11-10', reason: 'Needs a car' },
        createdAt: 1,
        updatedAt: 2,
      },
    ],
  },
  'career-application-desk': {
    version: 1,
    desks: {
      a: {
        bullets: {
          experience: 'Closed the bakery',
          impact: '',
          reflection: '',
          bullets: [],
          draft: { verb: 'Closed', task: 'the bakery', result: 'on time' },
        },
        offer: {
          basePay: 44000,
          basePayTo: 48000,
          payPeriod: 'year',
          oneTimeBonus: 500,
          received: true,
          answerBy: '2026-12-01',
          editedAt: 7,
        },
        lastStation: 'letter',
        updatedAt: 8,
      },
    },
  },
};

describe('item 12: the backup checks and carries every new field', () => {
  it('comes back whole after export, clear, and import', async () => {
    for (const [key, value] of Object.entries(NEW_FIELDS)) put(key, value);
    const exported = JSON.stringify(await collectBackup());
    window.localStorage.clear();
    await restoreBackup(parseBackup(exported), true);

    const session = JSON.parse(window.localStorage.getItem('career-why-session-v2') ?? '{}');
    expect(session).toMatchObject({
      start: 'experience',
      rootIndex: 2,
      statement: 'I like leaving things easier for the next person',
      mustOffer: 'A team to set up',
      canGiveUp: 'A big title',
    });
    const history = JSON.parse(window.localStorage.getItem('career-why-history') ?? '[]');
    expect(history[0]).toMatchObject({
      start: 'experience',
      statement: 'Saved statement',
      mustOffer: 'Saved must',
      canGiveUp: 'Saved give',
    });
    expect(loadData().answers).toEqual([
      expect.objectContaining({
        id: 'k1',
        questionId: 'q-intro',
        mode: 'spoken',
        text: 'I am a senior.',
      }),
    ]);
    expect(loadApplications().applications[0].setAside).toEqual({
      on: '2026-11-10',
      reason: 'Needs a car',
    });
    const desk = getDesk(loadApplicationDesks(), 'a');
    expect(desk.bullets.draft).toEqual({ verb: 'Closed', task: 'the bakery', result: 'on time' });
    expect(desk.lastStation).toBe('letter');
    expect(desk.offer).toMatchObject({
      basePay: 44000,
      basePayTo: 48000,
      oneTimeBonus: 500,
      received: true,
      answerBy: '2026-12-01',
      editedAt: 7,
    });
    for (const key of STUDIO_STORAGE_KEYS) {
      if (key in NEW_FIELDS) expect(window.localStorage.getItem(key)).not.toBeNull();
    }
  });

  const file = (stores: Record<string, unknown>) =>
    JSON.stringify({ format: '5whys-career-studio', version: 2, exportedAt: '', stores });

  it.each([
    [
      'a statement that is not text',
      'career-why-session-v2',
      { ...NEW_FIELDS['career-why-session-v2'], statement: 5 },
    ],
    [
      'an unknown start',
      'career-why-session-v2',
      { ...NEW_FIELDS['career-why-session-v2'], start: 'dream' },
    ],
    [
      'a root index that is text',
      'career-why-history',
      [{ ...NEW_FIELDS['career-why-history'][0], rootIndex: '2' }],
    ],
    [
      'must offer as a list',
      'career-why-history',
      [{ ...NEW_FIELDS['career-why-history'][0], mustOffer: ['x'] }],
    ],
    [
      'an answer with a numeric text',
      'interview-glow-up-data',
      { ...NEW_FIELDS['interview-glow-up-data'], answers: [{ id: 'k', text: 4 }] },
    ],
    [
      'answers that are not a list',
      'interview-glow-up-data',
      { ...NEW_FIELDS['interview-glow-up-data'], answers: {} },
    ],
    [
      'an answer mode that is neither',
      'interview-glow-up-data',
      { ...NEW_FIELDS['interview-glow-up-data'], answers: [{ id: 'k', mode: 'sung' }] },
    ],
    [
      'a set-aside that is text',
      'career-applications',
      { applications: [{ id: 'a', title: 'Clerk', setAside: 'yes' }] },
    ],
    [
      'a draft verb that is a number',
      'career-application-desk',
      { desks: { a: { bullets: { draft: { verb: 1 } } } } },
    ],
    ['a station that is a number', 'career-application-desk', { desks: { a: { lastStation: 3 } } }],
    [
      'an offer marked received with text',
      'career-application-desk',
      { desks: { a: { offer: { received: 'yes' } } } },
    ],
    [
      'an answer-by date that is a number',
      'career-application-desk',
      { desks: { a: { offer: { answerBy: 20261201 } } } },
    ],
  ])('refuses %s', (_name, key, value) => {
    expect(() => parseBackup(file({ [key]: value }))).toThrow(/invalid data/);
  });
});
