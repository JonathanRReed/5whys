import { describe, expect, it } from 'vitest';
import { readDocument } from '../src/lib/posting/resume-lines';
import { extractDocx, fromText, toDocx, toPrintModel } from '../src/lib/resume-doc';
import { detectResumeStructure, FIRST_JOB_SAMPLE_RESUME, hasResult } from '../src/lib/resume-game';
import {
  assembleResume,
  checkDraft,
  checkStep,
  draftBullet,
  EXPERIENCE_KINDS,
  emptyDraft,
  emptyExperience,
  normalizeDraft,
  type ResumeDraft,
  readMonthYear,
  resumeFileBase,
} from '../src/lib/resume-game/first-resume';
import { normalizeStoredSession } from '../src/lib/resume-game/session';
import { BACKUP_FORMAT, parseBackup } from '../src/lib/studio-backup';

const TODAY = new Date(2026, 10, 12);

/** A second-year community college student: one part-time job, one club. */
function studentDraft(): ResumeDraft {
  return {
    ...emptyDraft(),
    name: 'Maya Torres',
    email: 'maya.torres@example.com',
    phone: '(559) 555-0142',
    city: 'Fresno, CA',
    school: 'Fresno City College',
    study: 'Business',
    finish: 'May 2027',
    experiences: [
      {
        ...emptyExperience('job'),
        role: 'Cashier',
        where: 'FreshWay Market',
        start: 'June 2024',
        current: true,
        lines: [
          {
            verb: 'Counted',
            task: 'my cash drawer at close',
            impact: 'my drawer balanced every shift',
          },
          { verb: 'Stocked', task: 'the dairy shelves before opening', impact: '' },
          {
            verb: 'Trained',
            task: 'two new cashiers on the register',
            impact: 'they ran a lane alone in their first week',
          },
        ],
      },
      {
        ...emptyExperience('club'),
        role: 'Treasurer',
        where: 'Business Club',
        start: '9/2024',
        end: 'May 2025',
        lines: [
          {
            verb: 'Tracked',
            task: 'club spending in a shared sheet',
            impact: 'we stayed in budget',
          },
          { verb: '', task: '', impact: '' },
        ],
      },
    ],
    skills: 'Spanish, Google Sheets, cash handling',
  };
}

const EXPECTED = `Maya Torres
maya.torres@example.com | (559) 555-0142 | Fresno, CA

EDUCATION
Fresno City College | Business, expected May 2027

EXPERIENCE
Cashier, FreshWay Market | Jun 2024 - Present
- Counted my cash drawer at close, so my drawer balanced every shift.
- Stocked the dairy shelves before opening.
- Trained two new cashiers on the register, so they ran a lane alone in their first week.

Treasurer, Business Club | Sep 2024 - May 2025
- Tracked club spending in a shared sheet, so we stayed in budget.

SKILLS
Spanish, Google Sheets, cash handling`;

const bulletLines = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));

describe('assembling a first resume', () => {
  it('arranges the answers into plain resume text', () => {
    expect(assembleResume(studentDraft(), TODAY)).toBe(EXPECTED);
  });

  it('leaves every empty optional part out', () => {
    const draft: ResumeDraft = {
      ...emptyDraft(),
      name: 'Sam Ortiz',
      phone: '555 201 4477',
      skipSchool: true,
      school: 'Ignored High School',
      experiences: [
        {
          ...emptyExperience('family'),
          role: 'Family caregiver',
          lines: [{ verb: 'Picked up', task: 'my two brothers from school', impact: '' }],
        },
      ],
    };
    expect(assembleResume(draft, TODAY)).toBe(`Sam Ortiz
555 201 4477

EXPERIENCE
Family caregiver
- Picked up my two brothers from school.`);
  });

  it('writes a finished school without "expected"', () => {
    const draft = { ...studentDraft(), finish: '2024', study: '' };
    expect(assembleResume(draft, TODAY)).toContain('EDUCATION\nFresno City College | 2024\n');
  });

  it('adds no word the visitor did not type, beyond the fixed frame', () => {
    const draft = studentDraft();
    const typed = JSON.stringify(draft).toLowerCase();
    const frame = new Set([
      'education',
      'experience',
      'skills',
      'expected',
      'present',
      'so',
      'jun',
      'sep',
    ]);
    const words =
      assembleResume(draft, TODAY)
        .toLowerCase()
        .match(/[a-z]+/g) ?? [];
    expect(words.filter((word) => !frame.has(word) && !typed.includes(word))).toEqual([]);
  });

  it('builds each line with the Resume Game builder and skips a line with no action', () => {
    expect(draftBullet({ verb: 'ran', task: 'the bake sale table', impact: '' })).toBe(
      'Ran the bake sale table.'
    );
    expect(draftBullet({ verb: '', task: '', impact: 'something happened' })).toBe('');
    expect(
      draftBullet({ verb: 'Made', task: 'a sign-up sheet', impact: 'So, nobody missed a shift' })
    ).toBe('Made a sign-up sheet, so nobody missed a shift.');
  });

  it('names the file after the visitor', () => {
    expect(resumeFileBase('Maya Torres')).toBe('maya-torres-resume');
    expect(resumeFileBase('')).toBe('resume');
  });
});

describe('the built text round-trips through every reader', () => {
  const text = assembleResume(studentDraft(), TODAY);

  it('the Resume Game scores exactly the bullet lines', () => {
    const structure = detectResumeStructure(text);
    expect(structure.bullets).toEqual(bulletLines(text));
    expect(structure.usedGlyphs).toBe(true);
  });

  it('the resume document finds the sections and the bullets', () => {
    const doc = fromText(text);
    expect(doc.sections.map((section) => section.kind)).toEqual([
      'education',
      'experience',
      'skills',
    ]);
    expect(doc.lines.filter((line) => line.bullet).map((line) => line.text.slice(2))).toEqual(
      bulletLines(text)
    );
    expect(doc.contact.email?.value).toBe('maya.torres@example.com');
    expect(doc.contact.phone?.value).toBe('(559) 555-0142');
    const model = toPrintModel(doc);
    expect(model.paragraphs[0]).toMatchObject({ kind: 'name', text: 'Maya Torres' });
    expect(model.paragraphs.filter((p) => p.kind === 'bullet').map((p) => p.text)).toEqual(
      bulletLines(text)
    );
  });

  it('the posting reader groups the bullets under two dated roles', () => {
    const read = readDocument(text, { today: TODAY });
    expect(read.roles).toHaveLength(2);
    expect(read.roles[0]).toMatchObject({ from: { year: 2024, month: 6 }, ongoing: true });
    expect(read.roles[1]).toMatchObject({
      from: { year: 2024, month: 9 },
      to: { year: 2025, month: 5 },
      ongoing: false,
    });
    const experience = read.lines.filter((line) => line.kind === 'experience');
    expect(experience.map((line) => line.text.slice(2))).toEqual(bulletLines(text));
    expect(experience.map((line) => line.role)).toEqual([0, 0, 0, 1]);
    const kind = (start: string) => read.lines.find((line) => line.text.startsWith(start))?.kind;
    expect(kind('Maya Torres')).toBe('contact');
    expect(kind('maya.torres@example.com')).toBe('contact');
    expect(kind('Fresno City College')).toBe('education');
    expect(kind('Spanish')).toBe('skills');
  });

  it('a .docx of it holds every line', async () => {
    const bytes = await toDocx(fromText(text));
    const back = await extractDocx(bytes, 'resume.docx');
    const written = back.lines.map((line) => line.text.replace(/^[-•]\s+/, '').trim());
    for (const line of text.split('\n').filter((l) => l.trim())) {
      expect(written).toContain(line.replace(/^- /, ''));
    }
    expect(back.lines.filter((line) => line.bullet)).toHaveLength(bulletLines(text).length);
  });
});

describe('reading dates the way a student types them', () => {
  it.each([
    ['June 2024', 'Jun 2024'],
    ['jun. 2024', 'Jun 2024'],
    ['Sept 2023', 'Sep 2023'],
    ['6/2024', 'Jun 2024'],
    ['Fall 2025', 'Fall 2025'],
    ['2023', '2023'],
  ])('%s reads as %s', (typed, written) => {
    expect(readMonthYear(typed)?.text).toBe(written);
  });

  it.each(['', 'last summer', '13/2024', '24', 'June'])('%j is not a date', (typed) => {
    expect(readMonthYear(typed)).toBeNull();
  });
});

describe('checking each step', () => {
  it('asks for a name and one way to reach you', () => {
    const messages = checkStep(emptyDraft(), 'you').map((error) => error.message);
    expect(messages).toEqual([
      'Add your name.',
      'Add an email or a phone number, so someone can reach you.',
    ]);
    expect(checkStep({ ...emptyDraft(), name: 'A B', phone: '555 201 4477' }, 'you')).toEqual([]);
    expect(checkStep({ ...emptyDraft(), name: 'A B', email: 'maya' }, 'you')[0].message).toMatch(
      /needs an @/
    );
  });

  it('lets school be skipped or left empty', () => {
    expect(checkStep({ ...emptyDraft(), skipSchool: true }, 'school')).toEqual([]);
    expect(checkStep(emptyDraft(), 'school')).toEqual([]);
    expect(checkStep({ ...emptyDraft(), finish: 'soon' }, 'school').map((e) => e.field)).toEqual([
      'first-resume-school',
      'first-resume-finish',
    ]);
  });

  it('needs a role and one line with an action and what was done', () => {
    const fields = checkStep(emptyDraft(), 'experience', TODAY).map((error) => error.field);
    expect(fields).toEqual(['first-resume-exp-0-role', 'first-resume-exp-0-line-0-verb']);
    expect(checkStep(studentDraft(), 'experience', TODAY)).toEqual([]);
  });

  it('checks dates in text', () => {
    const draft = studentDraft();
    draft.experiences[1] = { ...draft.experiences[1], end: '2023' };
    expect(checkStep(draft, 'experience', TODAY)[0].message).toBe('This ends before it starts.');
    draft.experiences[1] = { ...draft.experiences[1], end: '' };
    expect(checkStep(draft, 'experience', TODAY)[0].message).toMatch(/I still do this/);
    draft.experiences[1] = { ...draft.experiences[1], start: '2030', current: true };
    expect(checkStep(draft, 'experience', TODAY)[0].message).toBe(
      'This start date is in the future.'
    );
  });

  it('asks for the missing part of a half-written line', () => {
    const draft = studentDraft();
    draft.experiences[0].lines[1] = { verb: '', task: 'the shelves', impact: '' };
    expect(checkStep(draft, 'experience', TODAY).map((error) => error.message)).toEqual([
      'Start with one action word, like Ran, Made, or Trained.',
    ]);
  });

  it('reports every step with its place', () => {
    expect(checkDraft(emptyDraft(), TODAY).map((error) => error.step)).toEqual([0, 0, 2, 2]);
    expect(checkDraft(studentDraft(), TODAY)).toEqual([]);
  });
});

describe('keeping the form in the Resume Game session', () => {
  it('older sessions have no form, and gain none', () => {
    const session = normalizeStoredSession({ resumeText: 'Ran the club.' });
    expect('draft' in session).toBe(false);
  });

  it('a saved form comes back as it was', () => {
    const draft = studentDraft();
    const session = normalizeStoredSession(JSON.parse(JSON.stringify({ resumeText: '', draft })));
    expect(session.draft).toEqual(draft);
  });

  it('an unreadable form is repaired or dropped, never guessed at', () => {
    expect(normalizeDraft('nope')).toBeUndefined();
    expect(normalizeDraft([])).toBeUndefined();
    const repaired = normalizeDraft({
      step: 99,
      name: 7,
      experiences: [{ kind: 'pirate', lines: 'x' }, null, {}, {}, {}],
    });
    expect(repaired?.step).toBe(3);
    expect(repaired?.name).toBe('');
    expect(repaired?.experiences).toHaveLength(3);
    expect(repaired?.experiences[0].kind).toBe('job');
    expect(repaired?.experiences[0].lines).toHaveLength(1);
  });

  it('a backup with the form in the session restores', () => {
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 2,
        stores: {
          'resume-game-session-v2': { resumeText: '', bullets: [], draft: studentDraft() },
        },
      })
    );
    expect(Object.keys(backup.stores)).toEqual(['resume-game-session-v2']);
  });
});

describe('the examples the form shows', () => {
  it('teach results the Resume Game scorer recognizes', () => {
    for (const kind of Object.values(EXPERIENCE_KINDS)) {
      for (const line of kind.lines) {
        if (line.impact) expect(hasResult(draftBullet(line)), draftBullet(line)).toBe(true);
      }
    }
  });
});

describe('the first-job sample', () => {
  it('reads as a high-school resume with lines to score', () => {
    const structure = detectResumeStructure(FIRST_JOB_SAMPLE_RESUME);
    expect(structure.bullets).toEqual([
      'Responsible for the register on weekend shifts',
      'Helped with stocking shelves',
      'Watched kids after school',
      'Participated in the canned food drive',
    ]);
    expect(readDocument(FIRST_JOB_SAMPLE_RESUME, { today: TODAY }).roles).toHaveLength(3);
  });
});
