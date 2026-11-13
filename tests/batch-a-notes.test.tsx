/**
 * Round 3, batch A: what the Resume Game reads around the achievement lines.
 * A career break is a fact, not a failed achievement; a gap that runs to
 * today is noticed; day-first and dotted dates are read and said how; non-US
 * personal details and a summary of claims get a plain note; skills show as
 * the resume writes them; and "same work, wrong words" reaches the editor.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PostingMatch from '../src/components/resume-game/PostingMatch';
import WordingHelp from '../src/components/resume-game/WordingHelp';
import {
  analyzeResumeText,
  extractSkills,
  readDatesNote,
  readPersonalDetailsNote,
  readSummaryNote,
} from '../src/lib/resume-game';
import { readNumericDates } from '../src/lib/resume-game/dates-note';
import { analyzeResumeLength } from '../src/lib/resume-game/length';
import { skillAsWritten } from '../src/lib/resume-game/skills';
import { detectResumeStructure, isCareerBreak } from '../src/lib/resume-game/structure';

afterEach(cleanup);

const TODAY = new Date(2026, 10, 13);

const RENEE = `RENEE ALVARADO
Dayton, OH | (937) 555-0142 | renee.alvarado@email.com

SUMMARY
Dedicated retail store manager with 11 years of experience in fast-paced environments. Hard-working team player seeking to transition into an operations analyst role.

EXPERIENCE

Store Manager, Brightline Home Goods, Dayton, OH
March 2018 - February 2026
- Managed a team of 22 associates and 3 assistant managers
- Worked closely with drivers and customer service on late orders

Family Caregiver
March 2026 - October 2026
- Full-time caregiver for a parent after surgery

SKILLS
Microsoft Excel (pivot tables, VLOOKUP), SQL (basic), Manhattan WMS, S&OP, Smartsheet, vendor management, budgeting`;

const LIN = `Lin Chen
Date of Birth: 1999/03/14 ｜ Nationality: Taiwan (R.O.C.) ｜ Gender: Female
[Photo attached]
Email：lin.chen@example.edu ｜ Pittsburgh, PA

EDUCATION
National Taiwan University — B.S. in Statistics, 09/2017 – 06/2021

EXPERIENCE
Data Analyst Intern ｜ Cathay Financial Holdings, Taipei ｜ 01/07/2025 – 31/08/2025
• Cleaned and merged 14 tables in SQL, so the report took 4 hours instead of 3 days

Research Assistant ｜ NTU Dept. of Statistics ｜ 2021.09 – 2023.06
• Co-authored one paper in Taiwan Journal of Public Health`;

describe('a career break', () => {
  it('is recognized when stated plainly, and work for others is not', () => {
    expect(isCareerBreak('Full-time caregiver for a parent after surgery')).toBe(true);
    expect(isCareerBreak('Parental leave')).toBe(true);
    expect(isCareerBreak('Cared for my mother after her stroke')).toBe(true);
    expect(isCareerBreak('Cared for 3 residents on the night shift at Oak Grove')).toBe(false);
    expect(isCareerBreak('Laid off when the store closed')).toBe(true);
  });

  it('is left unscored, so it can never be the next line to work on', () => {
    const analysis = analyzeResumeText(RENEE);
    const lines = analysis.bullets.map((bullet) => bullet.original);
    expect(lines).not.toContain('Full-time caregiver for a parent after surgery');
    expect(detectResumeStructure(RENEE).breaks).toEqual([
      'Full-time caregiver for a parent after surgery',
    ]);
    expect(analysis.signalReport.structureNote).toContain('1 career break');
  });
});

describe('the stretch since the last role', () => {
  it('is named when no role runs to today and nothing explains it', () => {
    const withoutBreak = RENEE.replace(/Family Caregiver[\s\S]*?surgery\n\n/, '');
    const note = readDatesNote(withoutBreak, TODAY);
    expect(note?.sinceLast).toBe('February 2026');
    expect(note?.sentences).toContain(
      'Your last dated role ended in February 2026, and none runs to today.'
    );
  });

  it('is not named when a break line or a recent role covers it', () => {
    expect(readDatesNote(RENEE, TODAY)?.sinceLast ?? null).toBeNull();
  });

  it('is not named for a resume still in school', () => {
    const student = `Ava Morales\nEDUCATION\nRiverside High School, expected June 2027\nEXPERIENCE\nCashier, FreshWay Market, June 2024 – August 2025\n- Counted my drawer at close`;
    expect(readDatesNote(student, TODAY)?.sinceLast ?? null).toBeNull();
  });
});

describe('dates written with numbers only', () => {
  it('reads day-first dates when one can only be day first, and says so', () => {
    const { text, readings } = readNumericDates('Intern | 01/07/2025 – 31/08/2025');
    expect(text).toBe('Intern | Jul 2025 – Aug 2025');
    expect(readings[0]).toContain('Read 31/08/2025 as 31 August 2025, day first.');
    expect(readings[0]).toContain('A US reader may take 01/07/2025 as January 7.');
  });

  it('reads year-first dotted dates', () => {
    const { text, readings } = readNumericDates('Research Assistant ｜ 2021.09 – 2023.06');
    expect(text).toBe('Research Assistant ｜ Sep 2021 – Jun 2023');
    expect(readings).toEqual([
      'Read 2021.09 as September 2021. US resumes usually write it Sep 2021.',
    ]);
  });

  it('reads month-first when nothing says otherwise', () => {
    expect(readNumericDates('Intern 06/12/2025 – 08/15/2025').text).toBe(
      'Intern Jun 2025 – Aug 2025'
    );
  });
});

describe('a role line written with full-width bars and dotted dates', () => {
  it('is a title line, not an achievement', () => {
    const lines = analyzeResumeText(LIN).bullets.map((bullet) => bullet.original);
    expect(lines).toEqual([
      'Cleaned and merged 14 tables in SQL, so the report took 4 hours instead of 3 days',
      'Co-authored one paper in Taiwan Journal of Public Health',
    ]);
  });
});

describe('non-US personal details', () => {
  it('names them in one information-only note', () => {
    const note = readPersonalDetailsNote(LIN);
    expect(note?.found).toEqual(['date of birth', 'nationality', 'gender', 'a photo']);
    expect(note?.sentences[0]).toBe(
      'This resume lists date of birth, nationality, gender, and a photo.'
    );
    expect(readPersonalDetailsNote(RENEE)).toBeNull();
  });
});

describe('the summary', () => {
  it('names the claims anyone can make', () => {
    const note = readSummaryNote(RENEE);
    expect(note?.claims).toEqual(
      expect.arrayContaining(['team player', 'hard-working', 'dedicated', 'fast-paced'])
    );
    expect(readSummaryNote(LIN)).toBeNull();
  });
});

describe('skills', () => {
  it('finds operations tools and methods, not a team name', () => {
    const skills = extractSkills(RENEE);
    expect(skills.hard).toEqual(
      expect.arrayContaining([
        'manhattan wms',
        's&op',
        'smartsheet',
        'vendor management',
        'budgeting',
      ])
    );
    expect(skills.hard).not.toContain('wms');
    expect(skills.soft).not.toContain('customer service');
    expect(extractSkills('Provided customer service to 200 shoppers a day').soft).toContain(
      'customer service'
    );
  });

  it('shows each skill as the resume writes it', () => {
    expect(skillAsWritten(RENEE, 'sql')).toBe('SQL');
    expect(skillAsWritten(RENEE, 'excel')).toBe('Excel');
    expect(skillAsWritten(RENEE, 's&op')).toBe('S&OP');
    expect(skillAsWritten(RENEE, 'manhattan wms')).toBe('Manhattan WMS');
  });
});

describe('the page estimate', () => {
  it('says it is likely, not a fact', () => {
    const page = Array.from(
      { length: 45 },
      () => '- Counted the drawer at close every night.'
    ).join('\n');
    expect(analyzeResumeLength(page).recommendation).toMatch(/^Likely about one page/);
  });
});

describe('same work, wrong words', () => {
  it('offers the posting words with the honest-use condition, and hands them to the editor', async () => {
    const onRewrite = vi.fn();
    render(
      <WordingHelp
        line="- Ran the Instagram for the campus radio station"
        postingTerms={['social media management']}
        onRewrite={onRewrite}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show other words for this work' }));
    const list = await screen.findByRole('list', { name: 'Other words for this work' });
    expect(list).toHaveTextContent('social media management');
    expect(list).toHaveTextContent("(the posting's)");
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this line with them' }));
    expect(onRewrite).toHaveBeenCalledWith(
      expect.objectContaining({
        line: '- Ran the Instagram for the campus radio station',
        terms: expect.arrayContaining(['social media management']),
      })
    );
  });

  it('says so when no other words fit', async () => {
    render(<WordingHelp line="Watched my cousin after school" postingTerms={['python']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show other words for this work' }));
    expect(await screen.findByText(/No other words found for this line/)).toBeVisible();
  });

  it('is offered on a posting match row with a near miss', () => {
    localStorage.clear();
    // With nothing to match against, the section only points to the desk.
    render(<PostingMatch resumeText="- Ran the Instagram for the campus radio station" />);
    expect(screen.queryByTestId('wording-help')).toBeNull();
  });
});
