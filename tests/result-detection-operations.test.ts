/**
 * "What happened because of it" for operations work, from the career changer
 * review (finding 3). An honest result earns the result points; an aim or a
 * duty still does not.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFieldChange,
  createBulletRecord,
  FIELD_PLACEHOLDERS,
  RESULT_HINT_EXAMPLE,
  scoreParts,
} from '../src/lib/resume-game';
import { resultKind } from '../src/lib/resume-game/scoring';

const result = (line: string) => scoreParts(line).result.points;

describe('results the review found missed', () => {
  it.each([
    'Ran a $3.2M restaurant with 60 staff, so customers waited less',
    'Ran a $3.2M restaurant with 60 staff, so both locations stayed profitable through 2 menu changes',
    'Ran safety meetings and investigated incidents; site went 600 days without a lost-time injury',
    'Coordinated with carriers and three client accounts on daily shipping cutoffs, so no client order missed a truck',
    'Trained new hires on RF scanners and pick paths, so new pickers hit full rate in their first week',
  ])('credits "%s"', (line) => {
    expect(result(line)).toBe(40);
  });

  it('credits the result field hint, typed into the editor', () => {
    const record = createBulletRecord('Ran a $3.2M restaurant with 60 staff', 0);
    expect(record.baselineScore).toBe(45);
    const filled = applyFieldChange(record, 'impact', RESULT_HINT_EXAMPLE);
    expect(filled.improved).toBe('Ran a $3.2M restaurant with 60 staff, so customers waited less.');
    expect(scoreParts(filled.improved).result.points).toBe(40);
    expect(filled.improvedScore).toBe(100);
  });

  it('credits the example in each register placeholder', () => {
    for (const register of ['student', 'work'] as const) {
      const example = FIELD_PLACEHOLDERS[register].impact.replace(/^For example:\s*/, '');
      const record = applyFieldChange(
        createBulletRecord('Ran the front end', 0),
        'impact',
        example
      );
      expect(scoreParts(record.improved).result.points, register).toBe(40);
    }
  });
});

describe('the patterns behind them', () => {
  it.each([
    ['went N days without', 'Site went 600 days without a lost-time injury'],
    ['went N days without', 'Went 200 days without an accident on the dock'],
    ['N days without', 'Kept the warehouse at 412 straight days without a recordable incident'],
    ['without a single', 'Closed 14 quarters without a single inventory shortage'],
    ['no X missed', 'No orders missed during the system cutover'],
    ['no X missed', 'Rebuilt the route plan, with no deliveries missed'],
    ['hit full rate', 'Rebuilt the pick path, so the team hit full rate'],
    ['hit full rate', 'Coached new pickers until they hit full rate in their first week'],
    ['met quota', 'Met quota 11 of 12 months'],
    ['exceeded goal', 'Exceeded the quarterly sales goal'],
    ['so + change', 'Coordinated schedules so staff knew their shifts a week ahead'],
    ['so + change', 'Moved receiving to mornings so trucks left on time'],
    ['so + change', 'Reorganized the stockroom so restocking took half as long'],
    ['so + change', 'Cross-trained cashiers so the line never backed up'],
  ])('%s: "%s"', (_pattern, line) => {
    expect(resultKind(line)).toBe('result');
  });
});

describe('aims and duties stay uncredited', () => {
  it.each([
    'Responsible for meeting the daily pick rate',
    'Trained new pickers to hit full rate',
    'Tried to hit full rate every week',
    'Expected to meet quota each month',
    'Answered phones so the office runs smoothly',
    'Stocked shelves so customers find items',
    'Organized supplies so they are easy to find',
    'Answered questions so new hires are trained faster',
    'Updated the menu board so prices are posted',
    'Ran safety meetings',
    'Coordinated with carriers on daily shipping cutoffs',
    'Handled customer complaints',
    'Met with vendors weekly',
    'Made the weekly schedule',
    'Worked shifts without supervision',
    'Duties included opening and closing, cash handling, and inventory.',
    'Helped with various projects as needed',
    'Hired, trained and scheduled front and back of house',
    'No experience with forklifts',
    'Supervised 20 pickers and packers on second shift',
  ])('"%s" is not a result', (line) => {
    expect(resultKind(line)).not.toBe('result');
  });
});
