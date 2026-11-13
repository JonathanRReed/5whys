import { describe, expect, it } from 'vitest';
import {
  createDefaultDeskData,
  getDesk,
  remapQualifications,
  setQualification,
} from '../src/lib/application-desk';
import { findRequirementEvidence, parsePosting, requirementIdMap } from '../src/lib/posting';

describe('qualification rows after a posting is decoded again', () => {
  const before = 'Requirements\n• Experience with Python\n• Experience with MATLAB';
  const swapped = 'Requirements\n• Experience with MATLAB\n• Experience with Python';
  const inserted = `We are hiring.\n\n${before}`;

  const marked = (text: string) => {
    const parsed = parsePosting(text);
    const python = parsed.requirements.find((r) => r.text.includes('Python'));
    if (!python) throw new Error('no Python requirement');
    const data = setQualification(createDefaultDeskData(), 'a', python.id, {
      status: 'have',
      plan: 'Show my Python project',
    });
    return { parsed, data };
  };

  const redecoded = (text: string) => {
    const { parsed, data } = marked(before);
    const next = parsePosting(text);
    const map = requirementIdMap(parsed.requirements, next.requirements, parsed.text, next.text);
    const moved = remapQualifications(
      data,
      'a',
      map,
      new Set(parsed.requirements.map((r) => r.id))
    );
    const python = next.requirements.find((r) => r.text.includes('Python'));
    return { rows: getDesk(moved, 'a').qualifications, pythonId: python?.id };
  };

  it('follows the requirement when two lines swap places', () => {
    const { rows, pythonId } = redecoded(swapped);
    expect(rows).toHaveLength(1);
    expect(rows[0].requirementId).toBe(pythonId);
    expect(rows[0].plan).toBe('Show my Python project');
  });

  it('follows the requirement when text is added above it', () => {
    const { rows, pythonId } = redecoded(inserted);
    expect(rows.map((row) => row.requirementId)).toEqual([pythonId]);
  });

  it('drops the row when the requirement is removed', () => {
    const { rows } = redecoded('Requirements\n• Experience with MATLAB');
    expect(rows).toEqual([]);
  });
});

describe('a dated job title that begins with a word that is also a verb', () => {
  it('counts its years', () => {
    const today = new Date('2026-11-12');
    const resume = (title: string) =>
      `Sam Lee\nsam@example.edu\n\nEXPERIENCE\n${title} | Jan 2020 - Jan 2025\n- Built billing services used by 40 teams`;
    expect(
      findRequirementEvidence('3 years of software experience', resume('Lead Software Engineer'), {
        today,
      }).state
    ).toBe(
      findRequirementEvidence('3 years of software experience', resume('Software Engineer'), {
        today,
      }).state
    );
  });
});

describe('ninth review round', () => {
  it('does not count months that have not happened yet', async () => {
    const { readDateRange } = await import('../src/lib/posting/resume-lines');
    const today = new Date('2026-11-12');
    expect(readDateRange('Analyst | Jan 2025 - Dec 2027', today)).toEqual({
      from: { year: 2025, month: 1 },
      to: { year: 2026, month: 11 },
      ongoing: true,
    });
    expect(readDateRange('Analyst | Jan 2027 - Dec 2027', today)).toBeNull();
    expect(readDateRange('Analyst | Jan 2022 - Jan 2023', today)?.ongoing).toBe(false);
    const resume =
      'Sam Lee\nsam@example.edu\n\nEXPERIENCE\nData Analyst | Jan 2025 - Dec 2027\n- Built weekly reports for the operations team';
    expect(findRequirementEvidence('2 years of experience', resume, { today }).state).not.toBe(
      'evidence'
    );
  });

  it('reads unmarked achievement lines in a pasted resume as bullets', async () => {
    const { withAchievementLines } = await import(
      '../src/components/application-desk/ResumeStation'
    );
    const { fromText } = await import('../src/lib/resume-doc');
    const { detectResumeStructure } = await import('../src/lib/resume-game');
    const resume =
      'Maya Torres\nmaya@example.edu\n\nExperience\nCampus Radio, Social Media Lead\nGrew the Instagram account from 400 to 2,100 followers by posting three times a week\nScheduled 12 volunteer DJs each week in a shared spreadsheet';
    const found = detectResumeStructure(resume).bullets;
    expect(found.length).toBeGreaterThan(0);
    const plain = fromText(resume);
    expect(plain.lines.filter((line) => line.bullet)).toHaveLength(0);
    const doc = withAchievementLines(plain, found);
    expect(doc.lines.filter((line) => line.bullet)).toHaveLength(found.length);
  });
});
