/**
 * Round 3, batch B2: the tailored resume a visitor sends, and the Bullets
 * station drafter. Report and finding are named on each block: intern (I),
 * changer (C), firstjob (F), completeness audit (A).
 */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ApplicationDesk from '../src/components/application-desk/ApplicationDesk';
import {
  APPLICATION_DESK_KEY,
  loadApplicationDesks,
  normalizeDesk,
} from '../src/lib/application-desk';
import { APPLICATIONS_KEY } from '../src/lib/applications';
import { addedWords, draftBullet, draftFields, hasEveryPart } from '../src/lib/bullet-draft';
import { createDefaultData, createRole, STORAGE_KEY as GLOW_KEY } from '../src/lib/glowup-store';
import { closeLocalDb } from '../src/lib/local-db';
import {
  addRequirement,
  bulletsFromRequirements,
  type PostingRequirement,
} from '../src/lib/posting';
import { fromText, toDocx, toPrintModel } from '../src/lib/resume-doc';
import { rewrittenLines } from '../src/lib/resume-doc/export';
import {
  addedBulletsFor,
  bulletsByRole,
  guessRole,
  placeableRewrites,
  placeBullet,
  repeatedLines,
  resumeRoles,
  sameWork,
} from '../src/lib/resume-doc/tailor';

const MARCUS = `Marcus Bell
Riverside, CA | marcus.bell.student@example.com
Education
Inland Valley Community College, Associate in Business Administration, expected May 2027
Experience
Cashier, Valley Fresh Market, Aug 2023 - Present
- Responsible for helping customers
- Handled the cash register and counted the drawer
- Stocked shelves and did other tasks when needed
Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present
- In charge of club money
- Helped plan events and fundraisers
Skills
Excel, customer service, teamwork, hard worker`;

const DRAWER_REWRITE =
  'Ran a cash register and counted the drawer at close, so the drawer balanced at the end of my shifts.';
const CLUB_REWRITE =
  'Tracked the Business Club budget, dues and receipts in a shared Excel sheet, so officers knew what was left before planning each event.';
const DESK_CLUB =
  'Tracked the Business Club budget, dues and receipts in Excel and gave a money report at each monthly meeting';
const DESK_DRAWER =
  'Balanced my register drawer at close at Valley Fresh Market and answered customer questions at the front registers';
const EXCEL = 'Experience with Microsoft Excel';

const openAt = (path: string) => window.history.replaceState(null, '', path);

/** One application, Marcus's resume with two lines rewritten, and a desk. */
function seedMarcus(desk: unknown) {
  const requirements = [EXCEL, 'Strong attention to detail'].reduce<PostingRequirement[]>(
    (list, line) => addRequirement(list, line),
    []
  );
  const glow = createRole(createDefaultData(), {
    jobTitle: 'Operations Intern',
    company: 'Coastline Supply Co.',
    rawJdText: EXCEL,
    parsedJdText: EXCEL,
    bullets: bulletsFromRequirements(requirements),
  });
  localStorage.setItem(GLOW_KEY, JSON.stringify(glow));
  localStorage.setItem(
    APPLICATIONS_KEY,
    JSON.stringify({
      version: 1,
      activeId: 'a',
      applications: [
        {
          id: 'a',
          title: 'Operations Intern',
          company: 'Coastline Supply Co.',
          deadline: null,
          roleId: glow.currentRoleId,
          sentOn: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
  );
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({
      resumeText: MARCUS,
      bullets: [
        {
          original: '- Handled the cash register and counted the drawer',
          improved: DRAWER_REWRITE,
          edited: true,
        },
        { original: '- In charge of club money', improved: CLUB_REWRITE, edited: true },
      ],
      lastAnalyzedAt: null,
    })
  );
  localStorage.setItem(
    APPLICATION_DESK_KEY,
    JSON.stringify({ version: 1, desks: { a: normalizeDesk(desk, 1) } })
  );
}

const deskWith = (texts: string[]) => ({
  bullets: {
    experience: '',
    impact: '',
    reflection: '',
    bullets: [0, 1].map((i) => ({ bulletId: null, text: texts[i] ?? '', included: true })),
  },
});

beforeEach(() => {
  localStorage.clear();
  openAt('/');
});
afterEach(async () => {
  cleanup();
  localStorage.clear();
  await closeLocalDb();
});

describe('I 13, C 9: the drafter finds the action, and never doubles it', () => {
  it('skips "am" and drafts from the sentence that says what was done', () => {
    const experience =
      'I am the treasurer of the Business Club. I keep the club budget in an Excel sheet with sorting and SUM formulas.';
    const impact = 'The officers knew what was left before each event.';
    const fields = draftFields(experience, impact);
    expect(fields.verb).toBe('Keep');
    expect(fields.task).toBe('the club budget in an Excel sheet with sorting and SUM formulas');
    const draft = draftBullet(fields);
    expect(draft).toBe(
      'Keep the club budget in an Excel sheet with sorting and SUM formulas, so the officers knew what was left before each event.'
    );
    expect(addedWords(draft, experience, impact)).toEqual([]);
  });

  it('finds "I built" after a lead-in such as "At Brightline"', () => {
    const fields = draftFields(
      'At Brightline I built the weekly schedule and the inventory count sheets in Excel.',
      ''
    );
    expect(fields).toEqual({
      verb: 'Built',
      task: 'the weekly schedule and the inventory count sheets in Excel',
      result: '',
    });
  });

  it('takes the visitor\'s own "I built" off when they type the verb', () => {
    expect(
      draftBullet({ verb: 'Built', task: 'at Brightline I built the weekly schedule', result: '' })
    ).toBe('Built the weekly schedule.');
    expect(
      draftBullet({ verb: 'Created', task: 'As lead, I made the weekly schedule', result: '' })
    ).toBe('Created the weekly schedule.');
    // A task that does not start with the speaker is left as written.
    expect(draftBullet({ verb: 'Ran', task: 'the count', result: '' })).toBe('Ran the count.');
  });

  it('reads a word after "I" as the action, but never a form of "be" or "have"', () => {
    expect(draftFields('I watch my cousin three afternoons a week.', '').verb).toBe('Watch');
    expect(draftFields('I have built two websites for clubs.', '').verb).toBe('Built');
    expect(draftFields("I'm the captain of the team.", '').verb).toBe('');
    const only = draftFields('I am the treasurer of the Business Club.', '');
    expect(only).toEqual({ verb: '', task: 'the treasurer of the Business Club', result: '' });
    // "Served as" then reads as a bullet.
    expect(draftBullet({ ...only, verb: 'Served as' })).toBe(
      'Served as the treasurer of the Business Club.'
    );
    // "I helped with" is near the work, not the work: no verb is taken.
    expect(draftFields('I helped with the bake sale.', '').verb).toBe('');
  });

  it('knows when a line already has every part', () => {
    expect(hasEveryPart(DRAWER_REWRITE)).toBe(true);
    expect(hasEveryPart('Responsible for helping customers')).toBe(false);
  });
});

describe('I 1: every desk bullet under the job it belongs to, no line twice', () => {
  const doc = fromText(MARCUS);
  const roles = resumeRoles(doc);

  it('reads the jobs on the resume', () => {
    expect(roles.map((role) => role.label)).toEqual([
      'Cashier, Valley Fresh Market, Aug 2023 - Present',
      'Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present',
    ]);
  });

  it('puts a bullet under the job it names, and asks when it names none', () => {
    expect(guessRole(DESK_CLUB, roles)?.role.label).toMatch(/^Treasurer/);
    expect(guessRole(DESK_CLUB, roles)?.words).toEqual(['Business', 'Club']);
    expect(guessRole(DESK_DRAWER, roles)?.role.label).toMatch(/^Cashier/);
    // "Valley" is in both titles, so it decides nothing.
    expect(guessRole('Drove to Valley events', roles)).toBeNull();
    expect(placeBullet('Answered phones', null, roles)).toEqual({ kind: 'unplaced' });
    // A saved place that is no longer in the resume is no place.
    expect(placeBullet(DESK_CLUB, 'text:999', roles)).toEqual({ kind: 'unplaced' });
    const chosen = placeBullet('Answered phones', roles[1].id, roles);
    expect(chosen.kind === 'chosen' && chosen.afterLineId).toBe(roles[1].lastLineId);
  });

  it('never puts a bullet under education or skills, even with no job', () => {
    const school = fromText(
      'Ava Lee\nava@example.com\nEducation\nNorth High School, 2027\nSkills\n- Excel'
    );
    expect(resumeRoles(school)).toEqual([]);
    expect(placeBullet('Ran the bake sale', null, [])).toEqual({ kind: 'new-section' });
  });

  it('places both bullets under their jobs in the file and flags each repeat', () => {
    const added = addedBulletsFor(
      [DESK_CLUB, DESK_DRAWER].map((text) => ({ text, placement: placeBullet(text, null, roles) }))
    );
    const rewrites = [
      { original: '- Handled the cash register and counted the drawer', improved: DRAWER_REWRITE },
      { original: '- In charge of club money', improved: CLUB_REWRITE },
    ];
    const model = toPrintModel(doc, { addedBullets: added, rewrites });
    const texts = model.paragraphs.map((p) => p.text);
    const treasurer = texts.findIndex((t) => t.startsWith('Treasurer'));
    expect(texts.indexOf(DESK_CLUB)).toBeGreaterThan(treasurer);
    expect(texts.indexOf(DESK_DRAWER)).toBeLessThan(treasurer);
    expect(texts.indexOf(DESK_DRAWER)).toBeGreaterThan(
      texts.findIndex((t) => t.startsWith('Cashier'))
    );
    const repeats = repeatedLines(model.paragraphs);
    // In the order of the file: the drawer bullet is under the first job.
    expect(repeats.map((r) => [r.addedId, r.otherText])).toEqual([
      ['added-1', DRAWER_REWRITE],
      ['added-0', CLUB_REWRITE],
    ]);
  });

  it('tells two different lines apart', () => {
    expect(sameWork(DESK_CLUB, DESK_DRAWER)).toBe(false);
    expect(sameWork('Stocked shelves and did other tasks when needed', DESK_DRAWER)).toBe(false);
    expect(sameWork(DESK_DRAWER, DRAWER_REWRITE)).toBe(true);
  });
});

describe('A 2: a rewrite goes on the line it came from, under the right job', () => {
  const twoShops = `Jo Park
jo@example.com
Experience
Campus Shop, Clerk, 2023 - 2024
- Tracked inventory for the campus shop.
Food Pantry, Volunteer, 2024 - Present
- Tracked inventory for the campus shop.`;
  const doc = fromText(twoShops);
  const improved = 'Tracked inventory for the food pantry, ending weekly shortages.';

  it('places a rewrite with its occurrence on that line in the file', async () => {
    const rewrites = [
      { original: '- Tracked inventory for the campus shop.', improved, occurrence: 1 },
    ];
    const wording = rewrittenLines(doc, rewrites);
    const roles = resumeRoles(doc);
    expect([...wording.keys()]).toEqual(roles[1].bulletIds);
    const bytes = await toDocx(doc, { rewrites });
    const xml =
      (await (await JSZip.loadAsync(bytes)).file('word/document.xml')?.async('string')) ?? '';
    const lines = xml
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .filter((line) => line.trim());
    const pantry = lines.findIndex((line) => line.startsWith('Food Pantry'));
    expect(lines.indexOf(improved)).toBeGreaterThan(pantry);
    expect(lines.indexOf('Tracked inventory for the campus shop.')).toBeLessThan(pantry);
  });

  it('leaves out a rewrite that cannot say which of two equal lines it replaces', () => {
    const rewrites = [{ original: '- Tracked inventory for the campus shop.', improved }];
    const { rewrites: placeable, unplaced } = placeableRewrites(doc, rewrites);
    expect(placeable).toEqual([]);
    expect(unplaced).toEqual(rewrites);
    // A line that appears once is placed without an occurrence.
    expect(
      placeableRewrites(fromText(MARCUS), [{ original: '- In charge of club money', improved }])
        .unplaced
    ).toEqual([]);
  });
});

describe('F 12: the Bullets station offers the lines already on the resume', () => {
  it('groups them under their jobs, in the rewritten wording', () => {
    const groups = bulletsByRole(fromText(MARCUS), [
      { original: '- In charge of club money', improved: CLUB_REWRITE },
    ]);
    expect(groups.map((g) => g.label.split(',')[0])).toEqual(['Cashier', 'Treasurer']);
    expect(groups[1].lines[0]).toBe(CLUB_REWRITE);
    expect(groups[0].lines).toContain('Responsible for helping customers');
  });

  it('puts a chosen line in step 1', async () => {
    seedMarcus(deskWith([]));
    openAt('/application/?id=a&station=bullets');
    render(<ApplicationDesk />);
    const pick = await screen.findByLabelText('Start from a line on your resume');
    fireEvent.change(pick, { target: { value: CLUB_REWRITE } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this line' }));
    await waitFor(() =>
      expect(loadApplicationDesks().desks.a.bullets.experience).toBe(CLUB_REWRITE)
    );
  });

  it('keeps a draft while the visitor visits another station', async () => {
    seedMarcus({
      bullets: {
        experience: 'I am the treasurer. I keep the club budget in Excel.',
        impact: '',
        reflection: '',
        bullets: [],
      },
    });
    openAt('/application/?id=a&station=bullets');
    render(<ApplicationDesk />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Draft a bullet from what I wrote' })
    );
    expect(screen.getByTestId('bullet-draft')).toHaveTextContent('Keep the club budget in Excel.');
    fireEvent.click(screen.getByRole('tab', { name: /Resume/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Bullets/ }));
    expect(await screen.findByTestId('bullet-draft')).toHaveTextContent(
      'Keep the club budget in Excel.'
    );
  });
});

describe('I 1, I 2, C 2: the Resume station on the desk', () => {
  it('matches the posting on the rewritten lines and the desk bullets', async () => {
    seedMarcus(deskWith([DESK_CLUB]));
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    const count = await screen.findByTestId('resume-selection-count');
    // The rewritten club line names Excel; as first pasted it did not.
    expect(count).toHaveTextContent('1 mention a confirmed requirement');
    expect(screen.getAllByText(`Answers: ${EXCEL}`)).toHaveLength(2);
    // One match: narrowing is not offered.
    expect(screen.queryByRole('button', { name: /Only the ones that match/ })).toBeNull();
    expect(
      screen.getByText(/Only 1 line names something this posting asks for\. Keep everything/)
    ).toBeVisible();
  });

  it('says where each desk bullet goes, flags repeats, and resolves one in place', async () => {
    seedMarcus(deskWith([DESK_CLUB, DESK_DRAWER]));
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    expect(await screen.findByTestId('desk-bullet-place-note-0')).toHaveTextContent(
      'Under Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present, because it names Business Club.'
    );
    expect(screen.getByTestId('desk-bullet-place-note-1')).toHaveTextContent(
      'Under Cashier, Valley Fresh Market, Aug 2023 - Present, because it names Fresh Market.'
    );
    const repeat = screen.getByTestId('desk-bullet-repeat-1');
    expect(repeat).toHaveTextContent('a line under Cashier, Valley Fresh Market');
    fireEvent.click(within(repeat).getByRole('button', { name: 'Use this one in its place' }));
    await waitFor(() =>
      expect(screen.getByTestId('desk-bullet-place-note-1')).toHaveTextContent(
        `in place of "${DRAWER_REWRITE.slice(0, 40)}`
      )
    );
    expect(screen.queryByTestId('desk-bullet-repeat-1')).toBeNull();
    const summary = screen.getByTestId('resume-copy-summary');
    expect(summary).toHaveTextContent('4 of 5 bullets from your resume');
    expect(summary).toHaveTextContent('Not in it, from your resume:');
    expect(summary).toHaveTextContent(DRAWER_REWRITE.slice(0, 50));
    expect(summary).toHaveTextContent('One bullet written on this desk says much the same');
    // Leaving the other one out clears the last repeat.
    fireEvent.click(
      within(screen.getByTestId('desk-bullet-repeat-0')).getByRole('button', {
        name: 'Leave this one out',
      })
    );
    await waitFor(() => expect(summary).not.toHaveTextContent('says much the same'));
    expect(summary).toHaveTextContent(
      'Not in it: bullet 1 written on this desk, which you left out.'
    );
    expect(loadApplicationDesks().desks.a.bullets.bullets[0].included).toBe(false);
  });

  it('keeps an unplaced bullet out of the file and says so', async () => {
    seedMarcus(deskWith(['Answered phones for the front office']));
    openAt('/application/?id=a&station=resume');
    render(<ApplicationDesk />);
    const summary = await screen.findByTestId('resume-copy-summary');
    expect(summary).toHaveTextContent(
      'Not in it: bullet 1 written on this desk, until you choose where it goes.'
    );
    fireEvent.click(screen.getByText('Read the file line by line'));
    const details = summary.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    const preview = await screen.findByTestId('resume-copy-preview');
    expect(preview).not.toHaveTextContent('Answered phones');
    expect(preview).toHaveTextContent(CLUB_REWRITE);
  });
});
