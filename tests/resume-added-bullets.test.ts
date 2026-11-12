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
  it('is the same resume after a small edit, and a different one after a paste', async () => {
    const { sameResume } = await import('../src/components/application-desk/ResumeStation');
    const doc = fromText(RESUME);
    expect(sameResume(doc, RESUME)).toBe(true);
    expect(sameResume(doc, RESUME.replace('2,100 followers', '2,400 followers'))).toBe(true);
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
