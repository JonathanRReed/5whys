/**
 * The career changer's two-column Word resume: a CORE SKILLS sidebar of
 * bulleted keywords, certifications, a gap, and roles from 2005. Findings 1
 * and 11 of the career changer review.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractDocx,
  fromText,
  listedLineIds,
  listedLineTexts,
  toEditorText,
} from '../src/lib/resume-doc';
import {
  analyzeResumeLength,
  buildDeepSignalReport,
  createBulletRecord,
  detectResumeStructure,
  generateBulletSuggestions,
  highlightResume,
  readDatesNote,
} from '../src/lib/resume-game';

const today = new Date(2026, 10, 13);
const SKILLS = [
  'Inventory Control',
  'Scheduling & Labor',
  'P&L Management',
  'Vendor Relations',
  'Safety (OSHA 10)',
  'Excel',
  'WMS (Manhattan)',
  'Training & Coaching',
  'Hard worker',
  'Team player',
];
const fixtureText = readFileSync('tests/fixtures/changer-docx/two-column-skills.txt', 'utf8');

async function readFixture() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/changer-docx/two-column-skills.docx'));
  const doc = await extractDocx(bytes, 'Dana_Kowalczyk_Resume_2015.docx');
  return { doc, text: toEditorText(doc) };
}

describe('a bulleted skills list is not scored (finding 1)', () => {
  it('reads the uploaded .docx the way the fixture text records it', async () => {
    const { text } = await readFixture();
    expect(`${text}\n`).toBe(fixtureText);
  });

  it('scores the 15 work lines and none of the sidebar keywords', async () => {
    const { text } = await readFixture();
    const structure = detectResumeStructure(text);
    expect(structure.bullets).toHaveLength(15);
    for (const skill of SKILLS) expect(structure.bullets).not.toContain(skill);
    expect(structure.bullets[0]).toBe(
      'Responsible for day-to-day operations of a 220,000 sq ft distribution center'
    );
    expect(structure.skipped.skills).toBeGreaterThanOrEqual(10);
    expect(structure.note).toMatch(/^Scored the 15 bulleted lines\./);
  });

  it('leaves certifications out of scoring too', () => {
    const structure = detectResumeStructure(
      'CERTIFICATIONS\n- ServSafe Manager, 2012\n- Forklift Certified, 2018\nEXPERIENCE\n- Trained 12 new hires on RF scanners'
    );
    expect(structure.bullets).toEqual(['Trained 12 new hires on RF scanners']);
  });

  it('never puts a keyword at the top of the next steps', async () => {
    const { text } = await readFixture();
    const records = detectResumeStructure(text).bullets.map(createBulletRecord);
    const lowest = [...records].sort((a, b) => a.baselineScore - b.baselineScore)[0];
    expect(SKILLS).not.toContain(lowest.original);
    const steps = records.flatMap((bullet, index) =>
      generateBulletSuggestions(bullet, index).map(() => bullet.original)
    );
    for (const skill of SKILLS) expect(steps).not.toContain(skill);
  });

  it('does not mark the sidebar as achievement lines', async () => {
    const { text } = await readFixture();
    const html = highlightResume(text);
    const skillLine = html.split('\n').find((line) => line.includes('Inventory Control'));
    expect(skillLine).toBeDefined();
    expect(skillLine).not.toMatch(/<mark/);
  });

  it('uses the file sections when the sidebar is read between experience lines', async () => {
    const { doc } = await readFixture();
    const interleaved = [
      'EXPERIENCE',
      'Operations Manager, Midwest Fulfillment Partners    Apr 2018 - Aug 2026',
      '- Coordinated with carriers and three client accounts on daily shipping cutoffs',
      '- Inventory Control',
      '- Excel',
      '- Ran safety meetings and investigated incidents',
      '- Team player',
    ].join('\n');
    const withoutDoc = detectResumeStructure(interleaved).bullets;
    expect(withoutDoc).toContain('Excel');
    const withDoc = detectResumeStructure(interleaved, { listedLines: listedLineTexts(doc) });
    expect(withDoc.bullets).toEqual([
      'Coordinated with carriers and three client accounts on daily shipping cutoffs',
      'Ran safety meetings and investigated incidents',
    ]);
  });

  it('ends a skills list at the next heading or job title', () => {
    expect(
      detectResumeStructure(
        'SKILLS\n- Excel\n- Forklift\nWarehouse Lead, Acme    Jan 2020 - Present\n- Cut dock-to-stock time from 6 hours to 3'
      ).bullets
    ).toEqual(['Cut dock-to-stock time from 6 hours to 3']);
    expect(
      detectResumeStructure(
        'Core Skills\n- Excel\nSelected Accomplishments\n- Cut dock-to-stock time from 6 hours to 3'
      ).bullets
    ).toEqual(['Cut dock-to-stock time from 6 hours to 3']);
  });

  it('keeps every bullet of a resume without a skills heading', () => {
    expect(
      detectResumeStructure('EXPERIENCE\n- Stocked shelves\n- Trained 4 new cashiers').bullets
    ).toEqual(['Stocked shelves', 'Trained 4 new cashiers']);
  });

  it('lists only the sections the resume names in its headings', async () => {
    const { text } = await readFixture();
    const sections = analyzeResumeLength(text).sections;
    expect(sections).toEqual(
      expect.arrayContaining(['summary', 'experience', 'education', 'skills', 'certifications'])
    );
    expect(sections).not.toContain('projects');
    // The parent's sub-story: "school" and "volunteer" inside lines are not sections.
    const parent = analyzeResumeLength(
      'EXPERIENCE\n- Organized the school book fair for 300 families\n- Led volunteer drivers for a food pantry'
    ).sections;
    expect(parent).toEqual(['experience']);
    expect(analyzeResumeLength('VOLUNTEER EXPERIENCE\n- Led drivers').sections).toEqual(
      expect.arrayContaining(['volunteering'])
    );
  });

  it('counts the scored lines, not the keywords, in the report', async () => {
    const { text } = await readFixture();
    const records = detectResumeStructure(text).bullets.map(createBulletRecord);
    expect(buildDeepSignalReport(records, text).bulletCount).toBe(15);
  });
});

describe('a factual note on dates (finding 11)', () => {
  it('names the gap and the older role, as information', () => {
    const note = readDatesNote(fixtureText, today);
    expect(note?.sentences).toEqual([
      'No role is listed between 2015 and March 2017.',
      'Time between jobs is common. If you want to, one short honest line can say what it was, such as caregiving, study, or a layoff.',
      '1 role ended more than 15 years ago: Assistant Manager, Brickhouse Grill 2005 - 2008.',
      'People with long careers often shorten older roles to one line each, or group them under a heading such as Earlier experience.',
    ]);
    for (const sentence of note?.sentences ?? []) {
      expect(sentence).not.toMatch(/[—!]|hide|remove|score|red flag|problem/i);
    }
  });

  it('says nothing when the dates run on without a gap', () => {
    const resume = readFileSync('tests/fixtures/postings/changer-resume.txt', 'utf8');
    expect(readDatesNote(resume, today)).toBeNull();
    expect(
      readDatesNote('Cashier | Jan 2025 - Present\n- Rang up 200 customers a shift', today)
    ).toBeNull();
  });

  it('does not count six months or less as a gap', () => {
    const resume = [
      'Server, Lakeside Diner | Jan 2020 - Jun 2022',
      '- Served 80 tables a night',
      'Barista, Bean Co | Dec 2022 - Present',
      '- Trained 3 new baristas',
    ].join('\n');
    expect(readDatesNote(resume, today)).toBeNull();
    const longer = resume.replace('Dec 2022', 'Mar 2023');
    expect(readDatesNote(longer, today)?.sentences[0]).toBe(
      'No role is listed between June 2022 and March 2023.'
    );
  });

  it('agrees with the roles the experience arithmetic reads', () => {
    // Education years are not roles: "Coursework ..., 2003-2005" is not older work.
    const note = readDatesNote(fixtureText, today);
    expect(note?.olderRoles.map((role) => role.heading)).toEqual([
      'Assistant Manager, Brickhouse Grill 2005 - 2008',
    ]);
  });

  it('fits the length note to a long career', async () => {
    const { text } = await readFixture();
    expect(analyzeResumeLength(text).recommendation).not.toMatch(/starting out/);
    expect(
      analyzeResumeLength(`${'Built a thing for the campus club. '.repeat(50)}`).recommendation
    ).toMatch(/starting out|Short resume/);
  });
});

describe('structured copy helpers', () => {
  it('lists skills and certification lines of a pasted resume', () => {
    const doc = fromText(
      'SKILLS\nExcel\nCERTIFICATIONS\nServSafe Manager\nEXPERIENCE\n- Ran a shift'
    );
    expect(listedLineTexts(doc)).toEqual(['Excel', 'ServSafe Manager']);
  });
});

describe('the Desk can leave the sidebar out of its bullets', () => {
  it('names the Word list items that sit under Core Skills', async () => {
    const { doc } = await readFixture();
    const listed = listedLineIds(doc);
    const offered = doc.lines.filter((line) => line.bullet && !listed.has(line.id));
    expect(offered).toHaveLength(15);
    for (const skill of SKILLS) expect(offered.map((line) => line.text)).not.toContain(skill);
  });
});
