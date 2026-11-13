import { describe, expect, it } from 'vitest';
import { createBulletRecord } from '../src/lib/resume-game';
import { buildBullet } from '../src/lib/resume-game/analysis';
import { analyzeReadability } from '../src/lib/resume-game/readability';
import {
  findNumbers,
  hasResult,
  resultKind,
  STRONG_SCORE,
  scoreBullet,
  scoreLabel,
  scoreParts,
} from '../src/lib/resume-game/scoring';
import { detectResumeStructure } from '../src/lib/resume-game/structure';
import { generateBulletSuggestions } from '../src/lib/resume-game/suggestions';
import { isVerbWord, leadingAction } from '../src/lib/resume-game/verbs';

const suggestionTypes = (line: string) =>
  generateBulletSuggestions(createBulletRecord(line, 0)).map((s) => s.type);

describe('a goal or a failed attempt is not a result (finding 9)', () => {
  it('gives an explicitly failed attempt no result points and no share card', () => {
    const line = '• Tried to reduce errors in 10 customer reports but failed.';
    expect(scoreParts(line).result.points).toBe(0);
    expect(resultKind(line)).toBe('failed');
    expect(scoreBullet(line)).toBeLessThan(STRONG_SCORE);
    expect(scoreLabel(scoreBullet(line)).label).not.toBe('Strong');
  });

  it('gives a stated aim only part of the result points', () => {
    const line = 'Wrote 2 letters to raise funds for the student club.';
    const parts = scoreParts(line);
    expect(resultKind(line)).toBe('aim');
    expect(parts.result.points).toBeGreaterThan(0);
    expect(parts.result.points).toBeLessThan(parts.result.max);
    expect(scoreBullet(line)).toBeLessThan(STRONG_SCORE);
    expect(scoreBullet(line)).toBeLessThan(
      scoreBullet('Wrote 2 letters that raised $300 for the student club.')
    );
  });

  it('still counts an aim that says how much, and a real change', () => {
    expect(
      hasResult('Automated weekly grant reporting in Excel to save the lab 6 hours per week.')
    ).toBe(true);
    expect(hasResult('Batched approvals to cut invoice time by 3 days')).toBe(true);
    expect(hasResult('Led a team of 5 to cut setup time by half')).toBe(true);
    expect(hasResult('Cut overtime by rebuilding the weekly schedule.')).toBe(true);
  });

  it('reads "to cut overtime" as an aim, not a change that happened', () => {
    expect(resultKind('Rebuilt the weekly schedule to cut overtime.')).toBe('aim');
  });

  it('asks whether the aim happened rather than saying nothing is there', () => {
    const suggestion = generateBulletSuggestions(
      createBulletRecord('Wrote 2 letters to raise funds for the student club.', 0)
    ).find((s) => s.type === 'missing-impact');
    expect(suggestion?.message).toMatch(/what the work was for/);
  });
});

describe('"on time" (student F3)', () => {
  it('does not count being on time as a result', () => {
    const line = 'Responsible for being on time and helping out.';
    expect(scoreParts(line).result.points).toBe(0);
    expect(hasResult('Arrived on time for every shift.')).toBe(false);
  });

  it('still counts work finished on time', () => {
    expect(hasResult('Delivered 40 orders on time each shift.')).toBe(true);
    expect(hasResult('Filed weekly reports on time for the front office.')).toBe(true);
  });
});

describe('first-job verbs (student F3, advisor A1)', () => {
  it.each([
    'babysat',
    'played',
    'coached',
    'stocked',
    'served',
    'tutored',
    'cashiered',
    'cleaned',
    'delivered',
    'mowed',
    'walked',
    'cared',
    'watched',
    'bagged',
    'shelved',
    'greeted',
    'drove',
    'fed',
    'taught',
    'sold',
    'built',
    'led',
    'ran',
    'wrote',
    'kept',
  ])('reads "%s" as what you did', (verb) => {
    expect(isVerbWord(verb)).toBe(true);
  });

  it('recognizes "Babysat for neighbors on weekends" as starting with what you did', () => {
    const line = 'Babysat for neighbors on weekends';
    expect(leadingAction(line)?.text).toBe('Babysat');
    expect(scoreParts(line).action.points).toBe(20);
    expect(suggestionTypes(line)).not.toContain('missing-verb');
  });

  it('moves the score when the visitor types "Babysat" as told', () => {
    expect(scoreBullet('- Babysat two kids after school')).toBeGreaterThan(10);
  });

  it('scores an unmarked "Babysat two kids after school" instead of dropping it as short', () => {
    const structure = detectResumeStructure(
      'Jordan Lee\nEXPERIENCE\nBabysat two kids after school\nCashier, Campus Market, 2025'
    );
    expect(structure.bullets).toContain('Babysat two kids after school');
  });

  it('keeps role titles from reading as verbs', () => {
    expect(isVerbWord('cashier')).toBe(false);
  });
});

describe('results career advisors teach (advisor A2)', () => {
  it('counts "with no shortages" as a result', () => {
    const line = 'Handled cash drawer of about $2,000 per shift with no shortages';
    expect(scoreParts(line).result.points).toBe(40);
    expect(hasResult('Balanced the register every night without any discrepancies.')).toBe(true);
  });

  it('counts "so customers waited less" as a result', () => {
    const line = 'Ran the register at lunch so customers waited less';
    expect(scoreParts(line).result.points).toBe(40);
    expect(hasResult('Reorganized the menu board so the line moved faster.')).toBe(true);
  });

  it('asks about the register, not staffing, for a cash line that says "per shift"', () => {
    const suggestion = generateBulletSuggestions(
      createBulletRecord('Counted the cash drawer every shift', 0)
    ).find((s) => s.type === 'missing-impact');
    expect(suggestion?.fix).toMatch(/lines move faster/);
  });

  it('does not count an ordinary "so" without a result', () => {
    expect(hasResult('Stocked shelves and so on.')).toBe(false);
  });
});

describe('a scope number is a number (advisor A3)', () => {
  it('calls "2,000-member" the size of the group, not "no number"', () => {
    const line = 'Moderated a 2,000-member Discord server for a gaming community';
    expect(scoreParts(line).measure.note).toMatch(/2,000-member" is the size of the group/);
    const suggestion = generateBulletSuggestions(createBulletRecord(line, 0)).find(
      (s) => s.type === 'missing-number'
    );
    expect(suggestion?.message).toMatch(/2,000-member/);
    expect(suggestion?.fix).toMatch(/What changed for that group/);
  });
});

describe('other currencies (advisor A10)', () => {
  it.each(['$', '€', '£', '₹', '₦'])('scores %s5,000 the same as dollars', (symbol) => {
    expect(scoreBullet(`Raised ${symbol}5,000 for the food bank during the spring drive.`)).toBe(
      scoreBullet('Raised $5,000 for the food bank during the spring drive.')
    );
  });
});

describe('an achievement with its project address (finding 20)', () => {
  it('keeps the line instead of calling it contact information', () => {
    expect(
      detectResumeStructure('Built example.com for a campus club and attracted 200 new members.')
        .bullets
    ).toHaveLength(1);
    expect(
      detectResumeStructure(
        'Created a website at https://example.org that doubled club registrations.'
      ).bullets
    ).toHaveLength(1);
  });

  it('still leaves out bare contact and link rows', () => {
    const structure = detectResumeStructure(
      'Jordan Lee\njordan@example.edu\nlinkedin.com/in/jordanlee\nPortfolio: jordan.dev\n• Built a sign-up form for the chess club.'
    );
    expect(structure.bullets).toEqual(['Built a sign-up form for the chess club.']);
  });
});

describe('number words (finding 21)', () => {
  it('scores a percentage in words the same as in digits', () => {
    expect(
      scoreBullet('Increased attendance by twenty percent through weekly student outreach.')
    ).toBe(scoreBullet('Increased attendance by 20 percent through weekly student outreach.'));
  });

  it('scores a count in words the same as in digits', () => {
    expect(scoreBullet('Served twenty customers each hour at the campus cafe.')).toBe(
      scoreBullet('Served 20 customers each hour at the campus cafe.')
    );
  });

  it('treats a headcount in words as scope, like digits', () => {
    expect(findNumbers('Supervised twelve volunteers at the food bank.')[0]?.kind).toBe('scope');
    expect(findNumbers('Supervised 12 volunteers at the food bank.')[0]?.kind).toBe('scope');
  });

  it('does not read "one of" or "someone" as a count', () => {
    expect(findNumbers('Served as one of the club officers for someone new.')).toEqual([]);
  });
});

describe('a quantity that looks like a year (finding 22)', () => {
  it.each(['2025', '2026', '2027'])('counts "Processed %s invoices" as a measure', (n) => {
    const line = `Processed ${n} invoices each month for the campus research office.`;
    expect(scoreParts(line).measure.points).toBe(15);
  });

  it('still leaves real years out', () => {
    expect(findNumbers('Coached the 2024 season of the youth soccer league.')).toEqual([]);
    expect(findNumbers('Ran the fall 2025 food drive for the campus pantry.')).toEqual([]);
    expect(findNumbers('Graduated in 2024 with honors.')).toEqual([]);
    expect(findNumbers('Member of the 2023 graduates council.')).toEqual([]);
  });
});

describe('passive voice advice (finding 25)', () => {
  it('does not flag an adjective as hiding who acted', () => {
    const line = 'Created a prototype that was open to all students.';
    expect(analyzeReadability(line).passiveVoiceCount).toBe(0);
    expect(suggestionTypes(line)).not.toContain('passive-voice');
  });

  it('does not flag who used the work after a line that opens with an action', () => {
    expect(suggestionTypes('Created forms that were used by all campus clubs.')).not.toContain(
      'passive-voice'
    );
  });

  it('still flags passive lines that hide who did the work', () => {
    expect(suggestionTypes('Shipments were checked by me')).toContain('passive-voice');
    expect(suggestionTypes('Was given responsibility for the club budget')).toContain(
      'passive-voice'
    );
  });
});

describe('honest lines across first jobs and school', () => {
  // A broad set of honest lines, so a fix for one unfairness does not
  // create another. Each pair is [line, minimum score].
  const honest: Array<[string, number]> = [
    ['Babysat two kids after school', 40],
    ['Tutored three middle school students in math every week.', 60],
    ['Mowed lawns for six neighbors every summer.', 60],
    ['Ran the register at lunch so customers waited less', 80],
    ['Handled cash drawer of about $2,000 per shift with no shortages', 80],
    ['Rebuilt the campus library sign-up form, so more students could reserve rooms.', 80],
    ['Delivered 40 orders on time each shift.', 80],
    ['Increased attendance by twenty percent through weekly student outreach.', 80],
  ];
  it.each(honest)('"%s" scores at least %i', (line, minimum) => {
    expect(scoreBullet(line)).toBeGreaterThanOrEqual(minimum);
  });
});

describe('the result field counts what its help text promises (advisor A2)', () => {
  it('scores "so customers waited less at lunch" typed into the result field', () => {
    const line = buildBullet({
      verb: 'Ran',
      task: 'the register',
      impact: 'so customers waited less at lunch',
      quantifier: '',
    });
    expect(scoreParts(line).result.points).toBe(40);
  });
});
