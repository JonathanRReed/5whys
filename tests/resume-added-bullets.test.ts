import { describe, expect, it } from 'vitest';
import { countRewrites, fromText, toPrintModel } from '../src/lib/resume-doc';

const RESUME = `Maya Torres
maya@example.edu

Experience
Campus Radio, Social Media Lead
- Posted three times a week
- Grew the Instagram account from 400 to 2,100 followers

Education
State University, B.A. Communication`;

describe('bullets added to a tailored copy', () => {
  const doc = fromText(RESUME);
  const bullets = toPrintModel(doc).paragraphs.filter((p) => p.kind === 'bullet');

  it('places an added bullet after the chosen line', () => {
    const model = toPrintModel(doc, {
      addedBullets: [{ afterLineId: bullets[0].lineId, text: '- Scheduled 30 volunteers a week' }],
    });
    const texts = model.paragraphs.map((p) => p.text);
    const at = texts.indexOf('Posted three times a week');
    expect(texts[at + 1]).toBe('Scheduled 30 volunteers a week');
    expect(model.paragraphs[at + 1].kind).toBe('bullet');
    expect(texts[at + 2]).toContain('Grew the Instagram');
  });

  it('keeps two additions after the same line in the order given', () => {
    const model = toPrintModel(doc, {
      addedBullets: [
        { afterLineId: bullets[1].lineId, text: 'First added' },
        { afterLineId: bullets[1].lineId, text: 'Second added' },
      ],
    });
    const texts = model.paragraphs.map((p) => p.text);
    expect(texts.indexOf('Second added')).toBe(texts.indexOf('First added') + 1);
    expect(texts.indexOf('First added')).toBe(
      texts.findIndex((t) => t.includes('Grew the Instagram')) + 1
    );
  });

  it('keeps a bullet in place when the line it follows is left out, and never at the top', () => {
    const model = toPrintModel(doc, {
      bulletLineIds: new Set([bullets[1].lineId]),
      addedBullets: [{ afterLineId: bullets[0].lineId, text: 'Added anyway' }],
    });
    const texts = model.paragraphs.map((p) => p.text);
    expect(texts.indexOf('Added anyway')).toBe(
      texts.findIndex((t) => t.includes('Grew the Instagram')) - 1
    );
  });

  it('puts a bullet whose line is not in the resume after the last bullet', () => {
    const texts = toPrintModel(doc, {
      addedBullets: [{ afterLineId: 'gone', text: 'Added anyway' }],
    }).paragraphs.map((p) => p.text);
    expect(texts.indexOf('Added anyway')).toBe(
      texts.findIndex((t) => t.includes('Grew the Instagram')) + 1
    );
  });

  it('ignores an empty addition and leaves the resume as it was with none', () => {
    expect(
      toPrintModel(doc, { addedBullets: [{ afterLineId: bullets[0].lineId, text: '  ' }] })
    ).toEqual(toPrintModel(doc));
  });
});

describe('rewritten lines in the clean copy', () => {
  const doc = fromText(RESUME);
  const rewrites = [
    {
      original: 'Posted three times a week',
      improved: 'Posted three times a week, which doubled replies from listeners',
    },
    { original: 'A line that is not in the resume', improved: 'Something else' },
    { original: 'Grew the Instagram account from 400 to 2,100 followers', improved: '  ' },
  ];

  it('replaces a line with its new wording and leaves the rest alone', () => {
    const texts = toPrintModel(doc, { rewrites }).paragraphs.map((p) => p.text);
    expect(texts).toContain('Posted three times a week, which doubled replies from listeners');
    expect(texts).not.toContain('Posted three times a week');
    expect(texts).toContain('Grew the Instagram account from 400 to 2,100 followers');
    expect(texts).not.toContain('Something else');
  });

  it('counts only rewrites that match a line and change it', () => {
    expect(countRewrites(doc, rewrites)).toBe(1);
    expect(countRewrites(doc, undefined)).toBe(0);
    expect(
      countRewrites(doc, [
        { original: '- posted three times a week', improved: 'Posted three times a week' },
      ])
    ).toBe(0);
  });
});

describe('a saved resume document and the text beside it', () => {
  it('is the same resume only while the text still says what it says', async () => {
    const { sameResume } = await import('../src/components/application-desk/ResumeStation');
    const doc = fromText(RESUME);
    expect(sameResume(doc, RESUME)).toBe(true);
    // Line breaks and bullet marks may differ; the words may not.
    expect(sameResume(doc, RESUME.replace(/\n- /g, '\n• '))).toBe(true);
    // A correction typed into the text is not in the saved document.
    expect(sameResume(doc, RESUME.replace('maya@example.edu', 'maya.t@example.edu'))).toBe(false);
    expect(sameResume(doc, RESUME.replace('2,100 followers', '2,400 followers'))).toBe(false);
    expect(
      sameResume(
        doc,
        'Jordan Lee\n\nExperience\nWarehouse lead\n- Ran the evening shift for six years\n- Cut late orders from 40 a week to 6'
      )
    ).toBe(false);
  });
});

describe('review fixes', () => {
  const TWO_JOBS = `Maya Torres\nmaya@example.edu\n\nExperience\nCampus Radio, Social Media Lead\n- Posted three times a week\n\nCity Library, Desk Assistant\n- Shelved returns every morning\n- Helped 40 visitors a day find books`;

  it('keeps an added bullet under its own job when the line it follows is left out', () => {
    const doc = fromText(TWO_JOBS);
    const bullets = toPrintModel(doc).paragraphs.filter((p) => p.kind === 'bullet');
    const model = toPrintModel(doc, {
      bulletLineIds: new Set(bullets.slice(1).map((b) => b.lineId)),
      addedBullets: [{ afterLineId: bullets[0].lineId, text: 'Ran the station Instagram' }],
    });
    const texts = model.paragraphs.map((p) => p.text);
    expect(texts).not.toContain('Posted three times a week');
    expect(texts.indexOf('Ran the station Instagram')).toBe(
      texts.indexOf('Campus Radio, Social Media Lead') + 1
    );
    expect(texts.indexOf('Ran the station Instagram')).toBeLessThan(
      texts.indexOf('City Library, Desk Assistant')
    );
  });

  it('does not read the day and year of a full date as a month and year', async () => {
    const { datesIn } = await import('../src/lib/resume-doc/dates');
    expect(datesIn('Graduated 05/12/2024')).toEqual([]);
    expect(datesIn('Intern 05/2024 to 08/2024').map((d) => d.text)).toEqual(['05/2024', '08/2024']);
  });
});

describe('a saved bullet choice and an edited resume', () => {
  it('follows the bullets by their words, not their positions', async () => {
    const { selectedIds } = await import('../src/components/application-desk/ResumeStation');
    const before = [
      { id: 'text:2', key: 'posted three times a week' },
      { id: 'text:3', key: 'grew the account' },
    ];
    const saved = { bulletIds: ['text:3'], bulletTexts: ['grew the account'] };
    expect(selectedIds(before, saved)).toEqual(['text:3']);
    // A line was added above: the same bullets now sit at other positions.
    const after = [
      { id: 'text:3', key: 'posted three times a week' },
      { id: 'text:4', key: 'grew the account' },
    ];
    expect(selectedIds(after, saved)).toEqual(['text:4']);
    // A different resume: nothing chosen for it yet, so everything is in.
    const other = [{ id: 'text:2', key: 'ran the evening shift' }];
    expect(selectedIds(other, saved)).toEqual(['text:2']);
    expect(selectedIds(after, { bulletIds: [], bulletTexts: [] })).toEqual([]);
    expect(selectedIds(after, null)).toEqual(['text:3', 'text:4']);
  });

  it('reads a job at a university as work, not schooling', async () => {
    const { findRequirementEvidence } = await import('../src/lib/posting');
    const resume = `Sam Lee\nsam@example.edu\n\nEXPERIENCE\nLibrary Assistant, State University | Jan 2024 - Dec 2025\n- Shelved returns and helped visitors find books`;
    const city = resume.replace('State University', 'City Library');
    const a = findRequirementEvidence('1 year of library experience', resume);
    const b = findRequirementEvidence('1 year of library experience', city);
    expect(a.state).toBe(b.state);
  });
});

describe('sixth review round', () => {
  it('counts two adjacent dated jobs as two jobs', async () => {
    const { findRequirementEvidence } = await import('../src/lib/posting');
    const today = new Date('2026-11-12');
    const resume = `Sam Lee\nsam@example.edu\n\nEXPERIENCE\nLibrary Assistant | Jan 2022 - Jan 2023\nData Analyst | Jan 2023 - Jan 2025\n- Built weekly reports for the operations team`;
    const single = `Sam Lee\nsam@example.edu\n\nEXPERIENCE\nData Analyst | Jan 2022 - Jan 2025\n- Built weekly reports for the operations team`;
    expect(findRequirementEvidence('2 years of experience', resume, { today }).state).toBe(
      findRequirementEvidence('2 years of experience', single, { today }).state
    );
  });

  it('finds a placeholder left in the greeting or the signature', async () => {
    const { runSendChecks } = await import('../src/lib/desk-checks');
    const letter = {
      hook: 'I ran the campus food pantry schedule for a year.',
      whyYou: 'Scheduling: I moved 30 volunteers to a shared calendar.',
      whyThem: 'Your mobile pantry reaches students who cannot travel.',
      closingAsk: 'Could we talk for 15 minutes?',
      recipient: '[Hiring Manager]',
      sender: '[Your name]',
      messages: { linkedin: null, 'follow-up-email': null, 'intro-call': null },
    };
    const check = runSendChecks({
      letter,
      title: 'Intern',
      company: 'Food Bank',
      requirements: [],
    }).find((c) => c.id === 'no-placeholders');
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain('[Hiring Manager]');
  });
});
