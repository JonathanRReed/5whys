import { describe, expect, it } from 'vitest';
import { sendBlocker } from '../src/components/application-desk/SendStation';
import {
  createEmptyDesk,
  deadlineInWords,
  remapLinkedDesks,
  titleFromPosting,
} from '../src/lib/application-desk';
import {
  asks,
  CHECK_RESUME_LINE,
  conditionWarnings,
  describeStanding,
  endSentence,
  leavesOutHook,
  nameFromResume,
  runSendChecks,
  searchedFor,
  skillName,
  standing,
  tidyDoubledStop,
  whyYouDraft,
} from '../src/lib/desk-checks';
import {
  addRequirement,
  confirmAllSuggested,
  findRequirementEvidence,
  type PostingRequirement,
  type PostingSection,
  parsePosting,
  redecodeRequirements,
} from '../src/lib/posting';

function confirmed(lines: [string, PostingSection][]): PostingRequirement[] {
  let list: PostingRequirement[] = [];
  for (const [text, section] of lines) list = addRequirement(list, text, { section });
  return confirmAllSuggested(list, () => true);
}

const row = (id: string, status: 'have' | 'maybe' | 'not-yet', plan = '') => ({
  requirementId: id,
  status,
  plan,
  updatedAt: 1,
});

const letter = (parts: Partial<Record<string, string>>) => ({
  ...createEmptyDesk(1).letter,
  ...parts,
});

describe('the closing ask', () => {
  it('does not take a refusal for an ask', () => {
    expect(asks('Please do not contact me.')).toBe(false);
    expect(asks('There is no need to reply.')).toBe(false);
  });

  it('reads past a thanks that opens the sentence', () => {
    expect(asks('Thank you, I would welcome an interview.')).toBe(true);
    expect(asks('Thanks again for your time; could we talk next week?')).toBe(true);
    expect(asks('Thank you for considering my application.')).toBe(false);
  });
});

describe('length', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
  const check = (n: number) =>
    runSendChecks({
      letter: letter({ hook: words(n) }),
      title: 'Intern',
      company: 'Acme',
      requirements: [],
    }).find((c) => c.id === 'one-page');

  it('does not tick a letter too short to read as one', () => {
    expect(check(117)?.passed).toBe(false);
    expect(check(117)?.detail).toBe(
      '117 words. A letter this short reads as a note. Aim for 250 to 350.'
    );
    expect(check(90)?.passed).toBe(false);
  });

  it('ticks a letter of about a page and says it was counted, not measured', () => {
    expect(check(300)?.passed).toBe(true);
    expect(check(300)?.label).toBe('Length');
    expect(check(300)?.detail).toMatch(/counted in words, not measured/);
    expect(check(450)?.passed).toBe(false);
  });
});

describe('names in sentences', () => {
  it('does not put a second full stop after "Co."', () => {
    expect(endSentence('Coastline Supply Co.')).toBe('Coastline Supply Co.');
    expect(endSentence('Acme')).toBe('Acme.');
    const names = runSendChecks({
      letter: letter({
        hook: 'I want the Operations Intern role at Coastline Supply Co. this summer.',
      }),
      title: 'Operations Intern (Summer 2027)',
      company: 'Coastline Supply Co.',
      requirements: [],
    }).find((c) => c.id === 'names');
    expect(names?.detail).toBe('Mentions Operations Intern and Coastline Supply Co.');
    expect(tidyDoubledStop('role at Coastline Supply Co.. Would you')).toBe(
      'role at Coastline Supply Co. Would you'
    );
    expect(tidyDoubledStop('and then...')).toBe('and then...');
  });
});

describe('why you, from what was marked "have it"', () => {
  const lines: [string, PostingSection][] = [
    [
      'Working knowledge of Microsoft Excel, including sorting, filters, and basic formulas',
      'required',
    ],
    ['Able to work on site in Ontario, CA, Monday through Friday', 'required'],
    ['Reliable attention to detail with numbers and records', 'required'],
    ['Customer service experience', 'preferred'],
  ];

  it('names each skill before its proof, and skips location and hours', () => {
    const requirements = confirmed(lines);
    const rows = [
      row(requirements[0].id, 'have', 'I keep the club budget in an Excel sheet with SUM formulas'),
      row(requirements[1].id, 'have', 'I live in Riverside and can drive to Ontario'),
      row(requirements[2].id, 'have', 'My register drawer balanced at close'),
    ];
    expect(whyYouDraft(requirements, rows)).toEqual([
      'Microsoft Excel: I keep the club budget in an Excel sheet with SUM formulas.',
      'Attention to detail with numbers and records: My register drawer balanced at close.',
    ]);
  });

  it('fills a missing proof with the resume line that shows it, marked to check', () => {
    const requirements = confirmed(lines);
    const rows = [row(requirements[3].id, 'have')];
    const shown = new Map([[requirements[3].id, '- Helped customers at the front registers']]);
    expect(whyYouDraft(requirements, rows, 3, shown)).toEqual([
      `Customer service: Helped customers at the front registers. ${CHECK_RESUME_LINE}`,
    ]);
    // The bracket keeps "Nothing left to fill in" open until it is read.
    const checks = runSendChecks({
      letter: letter({ whyYou: whyYouDraft(requirements, rows, 3, shown).join(' ') }),
      title: 'Intern',
      company: 'Acme',
      requirements,
    });
    expect(checks.find((c) => c.id === 'no-placeholders')?.passed).toBe(false);
  });

  it('shortens a posting line to the skill it asks for', () => {
    expect(skillName('Experience with Excel or Google Sheets')).toBe('Excel or Google Sheets');
    expect(skillName('Strong written and verbal communication skills')).toBe(
      'Written and verbal communication'
    );
  });
});

describe('where you stand', () => {
  it('leads with the required lines when only preferred ones are missing', () => {
    const requirements = confirmed([
      ['Friendly with customers', 'required'],
      ['Able to count change accurately', 'required'],
      ['Comfortable using a cash register', 'required'],
      ['Food handler card a plus', 'preferred'],
      ['Previous cashier experience preferred', 'preferred'],
    ]);
    const marks = ['have', 'maybe', 'have', 'not-yet', 'not-yet'] as const;
    const rows = requirements.map((r, i) => row(r.id, marks[i]));
    const text = describeStanding(standing(requirements, rows, null));
    expect(text).toBe(
      '2 have it, 1 maybe, 2 not yet. Of the 3 required, you have 2 and maybe 1. What you are missing is not listed as required. That is enough to apply.'
    );
    expect(text).not.toMatch(/missing more than you have/);
  });

  it('says "the one you have" instead of "the other 1"', () => {
    const requirements = confirmed([
      ['Experience with Excel', 'required'],
      ['Experience with SQL', 'required'],
    ]);
    const rows = [row(requirements[0].id, 'have'), row(requirements[1].id, 'not-yet')];
    const evidence = new Map([
      [requirements[0].id, 'none' as const],
      [requirements[1].id, 'none' as const],
    ]);
    const text = describeStanding(standing(requirements, rows, evidence));
    expect(text).toMatch(/Your resume does not show the one you have yet\. Put it into a bullet/);
    expect(text).not.toMatch(/the other 1/);
  });
});

describe('conditions before you send', () => {
  it('says what needing sponsorship means against a posting that will not sponsor', () => {
    const [visa, auth] = confirmed([
      ['We are unable to sponsor an employment visa at this time.', 'required'],
      ['Must be legally authorized to work in the United States.', 'required'],
    ]);
    expect(conditionWarnings([visa, auth], [row(visa.id, 'not-yet')])).toEqual([
      'You said you will need sponsorship, and this posting says it does not sponsor. Ask the recruiter before you apply.',
    ]);
    expect(conditionWarnings([visa], [row(visa.id, 'have')])).toEqual([]);
  });

  it('arms "Mark as sent" with what is still open, placeholders first', () => {
    const draft = letter({ whyYou: 'Scheduling: [your proof]' });
    const checks = runSendChecks({ letter: draft, title: 'A', company: 'B', requirements: [] });
    expect(sendBlocker(draft, checks, [])).toBe('The letter still has [your proof].');
    expect(sendBlocker(letter({}), [], [])).toBeNull();
  });
});

describe('what the qualifications station says it looked for', () => {
  it('names the words it searched, so a "none" can be checked', () => {
    const result = findRequirementEvidence(
      'Experience in retail, food service, or a warehouse',
      'Experience\nTutor, Westside Library, 2023 - 2025\n- Helped students with homework'
    );
    expect(searchedFor(result)).toBe(
      'We looked for "retail", "food service" or "warehouse" and did not find them. If your work counts, say it in a bullet in those words.'
    );
  });
});

describe('small readings', () => {
  it('takes a name only from a first line that is a name', () => {
    expect(nameFromResume('Marcus Bell\nRiverside, CA')).toBe('Marcus Bell');
    expect(nameFromResume('RENEE ALVARADO\nDayton')).toBe('Renee Alvarado');
    expect(nameFromResume('Riverside, CA | marcus@example.com')).toBeNull();
    expect(nameFromResume('Experience\nCashier')).toBeNull();
  });

  it('notices a LinkedIn note that left the hook out', () => {
    const hook = 'Last spring I balanced the Business Club budget to the cent every month.';
    expect(leavesOutHook('Hello, I am applying for the Operations Intern role.', hook)).toBe(true);
    expect(leavesOutHook(`Hello, ${hook} Could we talk?`, hook)).toBe(false);
  });

  it('writes a deadline in words, so a day-first date read month-first shows', () => {
    expect(deadlineInWords('2027-12-01')).toBe('Wednesday, December 1, 2027');
    expect(deadlineInWords('2027-02-31')).toBe('');
  });

  it('takes a role title from the first line of a brought posting', () => {
    expect(titleFromPosting('\nMarketing Intern\nNew University')).toBe('Marketing Intern');
    expect(
      titleFromPosting(
        'We are a growing company looking for someone to join our small and friendly team today.'
      )
    ).toBe('');
  });
});

describe('decoding again keeps the decisions of every linked desk', () => {
  it('moves qualification rows when text above a requirement changes', () => {
    const before = 'Requirements\n- Experience with Excel\n- Customer service experience';
    const after =
      'Intro line added at the top.\n\nRequirements\n- Experience with Excel\n- Customer service experience';
    const first = confirmAllSuggested(parsePosting(before).requirements, () => true);
    const redecoded = redecodeRequirements(first, before, parsePosting(after).requirements, after);
    expect(redecoded.requirements.filter((r) => r.status === 'confirmed')).toHaveLength(2);
    const excel = first.find((r) => r.text.includes('Excel'));
    const moved = redecoded.moved.get(excel?.id ?? '');
    expect(moved).toBeDefined();
    expect(moved).not.toBe(excel?.id);

    const desk = createEmptyDesk(1);
    desk.qualifications = [{ ...row(excel?.id ?? '', 'have', 'Pivot tables at work') }];
    const data = { version: 1, desks: { a: desk, b: structuredClone(desk) } };
    const next = remapLinkedDesks(
      data,
      ['a', 'b', 'missing'],
      redecoded.moved,
      redecoded.parsedIds
    );
    expect(next.desks.a.qualifications[0].requirementId).toBe(moved);
    expect(next.desks.b.qualifications[0].requirementId).toBe(moved);
    expect(next.desks.b.qualifications[0].plan).toBe('Pivot tables at work');
    expect(next.desks.missing).toBeUndefined();
  });
});
