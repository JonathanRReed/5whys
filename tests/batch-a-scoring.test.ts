/**
 * Round 3, batch A: scores must be earned. A doubled first word, an ordinary
 * task, or a headcount does not earn points; a stated result, a ranking, and a
 * hyphenated verb do.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFieldChange,
  buildBullet,
  createBulletRecord,
  findNumbers,
  scoreBullet,
  scoreParts,
  seedFields,
} from '../src/lib/resume-game';
import { doubledOpening } from '../src/lib/resume-game/scoring';
import { isVerbWord, leadingAction, pastTenseOf, sameVerb } from '../src/lib/resume-game/verbs';

describe('base forms of first-job verbs', () => {
  it('reads "Watch my cousin" as opening with what was done', () => {
    expect(leadingAction('Watch my cousin after school')).toEqual({
      text: 'Watch',
      involvement: false,
    });
    expect(scoreParts('Watch my cousin after school.').action.points).toBe(20);
  });

  it('knows the past form of a base form from the same lists', () => {
    expect(pastTenseOf('watch')).toBe('Watched');
    expect(pastTenseOf('run')).toBe('Ran');
    expect(pastTenseOf('babysit')).toBe('Babysat');
    expect(pastTenseOf('mop')).toBe('Mopped');
    expect(pastTenseOf('watched')).toBeNull();
    expect(pastTenseOf('cousin')).toBeNull();
  });

  it('accepts a hyphenated prefix', () => {
    expect(isVerbWord('Co-authored')).toBe(true);
    expect(leadingAction('Co-authored one paper in a public health journal')?.text).toBe(
      'Co-authored'
    );
  });

  it('tells forms of one verb from two different verbs', () => {
    expect(sameVerb('Watched', 'Watch')).toBe(true);
    expect(sameVerb('Ran', 'runs')).toBe(true);
    expect(sameVerb('Ran', 'checks')).toBe(false);
  });

  it('reads "In charge of" as being there, not an action', () => {
    expect(leadingAction('In charge of club money')).toEqual({
      text: 'In charge of',
      involvement: true,
    });
  });
});

describe('the rewrite never doubles the first word', () => {
  it('replaces the base form when the visitor types its past form', () => {
    const record = createBulletRecord('Watch my cousin after school.', 0);
    expect(record.fields.verb).toBe('Watch');
    expect(record.fields.task).toBe('my cousin after school.');
    const typed = applyFieldChange(record, 'verb', 'Watched');
    expect(typed.improved).toBe('Watched my cousin after school.');
  });

  it('drops a form of the new verb from the start of the work', () => {
    expect(
      buildBullet({
        verb: 'Watched',
        task: 'Watch my cousin after school',
        impact: 'so my aunt can go to work',
        quantifier: '',
      })
    ).toBe('Watched my cousin after school, so my aunt can go to work.');
  });

  it('does not score a doubled first word as a strong line', () => {
    const line = 'Watched Watch my cousin after school, so my aunt can go to work.';
    expect(doubledOpening(line)).toBe('Watched Watch');
    const parts = scoreParts(line);
    expect(parts.action.points).toBe(10);
    expect(parts.action.note).toContain('two action words');
    expect(scoreBullet(line)).toBeLessThan(
      scoreBullet('Watched my cousin after school, so my aunt can go to work.')
    );
    expect(scoreBullet(line)).toBeLessThan(80);
  });

  it('seeds an involvement opening so a new verb replaces it', () => {
    expect(seedFields('In charge of club money')).toMatchObject({
      verb: 'In charge of',
      task: 'club money',
    });
  });
});

describe('ordinary tasks earn no result points', () => {
  it.each([
    'Placed orders for weekly office supplies.',
    'Passed information between the front desk and the kitchen.',
    'Raised concerns about a broken printer at the team meeting.',
    'Cut vegetables for the lunch rush at the campus cafe.',
    'Lifted boxes onto the truck at the back dock.',
    'Saved files to the shared drive every Friday afternoon.',
  ])('%s', (line) => {
    expect(scoreParts(line).result.points).toBe(0);
    expect(scoreBullet(line)).toBeLessThan(80);
  });

  it.each([
    'Passed the food handler exam on the first try.',
    'Placed second at the state robotics competition.',
    'Ranked 3rd of 40 servers for weekly sales.',
    'Earned a promotion to shift lead after six months.',
    'Raised $1,400 for the trip to state with a bake sale.',
    'Cut shrink on the dairy aisle by checking dates every morning.',
  ])('still counts a real result: %s', (line) => {
    expect(scoreParts(line).result.points).toBe(40);
  });
});

describe('results the scorer missed', () => {
  it('counts a change with its subject first', () => {
    const line = 'Responsible for safety program; recordable incidents fell 38% over two years';
    expect(scoreParts(line).result.points).toBe(40);
  });

  it('counts a ranking among others', () => {
    expect(
      scoreParts('Kaggle competition: top 8% of 3,200 teams in tabular playground').result.points
    ).toBe(40);
  });
});

describe('numbers that are dates or headcounts', () => {
  it('does not read a dotted or day-first date as a count', () => {
    expect(findNumbers('Research Assistant, 2021.09 – 2023.06')).toEqual([]);
    expect(findNumbers('Intern 01/07/2025 – 31/08/2025')).toEqual([]);
  });

  it('reads the second group of people under "Managed" as headcount too', () => {
    const parts = scoreParts('Managed a team of 22 associates and 3 assistant managers');
    expect(parts.measure.points).toBe(0);
    expect(parts.measure.note).toContain('22 associates');
  });
});
