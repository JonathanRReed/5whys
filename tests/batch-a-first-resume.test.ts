/**
 * Round 3, batch A: the start-from-nothing form asks for the action word the
 * way the scorer reads it, splits a sentence instead of blocking, offers
 * capital letters, and names babysitting outright.
 */
import { describe, expect, it } from 'vitest';
import { scoreParts } from '../src/lib/resume-game';
import {
  actionWordAdvice,
  applyCapitalFixes,
  capitalFixes,
  capitalizeName,
  checkStep,
  draftBullet,
  EXPERIENCE_KINDS,
  emptyDraft,
  emptyExperience,
  fieldId,
  type ResumeDraft,
  splitActionWord,
} from '../src/lib/resume-game/first-resume';

const TODAY = new Date(2026, 10, 13);

function withLine(verb: string, task: string): ResumeDraft {
  return {
    ...emptyDraft(),
    step: 2,
    experiences: [
      {
        ...emptyExperience('sitting'),
        role: 'Babysitter',
        lines: [{ verb, task, impact: '' }],
      },
    ],
  };
}

describe('the action word', () => {
  it('splits a sentence typed into the one-word box', () => {
    expect(splitActionWord('i watch my cousin after school')).toEqual({
      verb: 'watch',
      rest: 'my cousin after school',
    });
    expect(splitActionWord('Picked up my brothers')).toEqual({
      verb: 'Picked up',
      rest: 'my brothers',
    });
    expect(splitActionWord('Watched')).toBeNull();
    expect(splitActionWord('Picked up')).toBeNull();
  });

  it('offers the past form for finished work, and nothing for current work', () => {
    expect(actionWordAdvice('watch', false)).toEqual({
      kind: 'past',
      word: 'watch',
      past: 'Watched',
    });
    expect(actionWordAdvice('watch', true)).toBeNull();
    expect(actionWordAdvice('Watched', false)).toBeNull();
    expect(actionWordAdvice('babysitting', true)).toEqual({
      kind: 'past',
      word: 'babysitting',
      past: 'Babysat',
    });
    expect(actionWordAdvice('cousin', false)).toEqual({ kind: 'not-a-verb', word: 'cousin' });
  });

  it('agrees with the scorer: a base form the form accepts opens with an action', () => {
    const line = draftBullet({ verb: 'watch', task: 'my cousin after school', impact: '' });
    expect(line).toBe('Watch my cousin after school.');
    expect(scoreParts(line).action.points).toBe(20);
  });

  it('says where the rest goes when a sentence fills the action word', () => {
    const errors = checkStep(withLine('i watch my cousin after school', ''), 'experience', TODAY);
    expect(errors).toEqual([
      {
        field: fieldId.verb(0, 0),
        message: 'Put only the first word here, like Watched. The rest goes in What you did.',
      },
    ]);
  });

  it('puts "Add what you did" on the empty box only', () => {
    const errors = checkStep(withLine('Watched', ''), 'experience', TODAY);
    expect(errors).toEqual([{ field: fieldId.task(0, 0), message: 'Add what you did.' }]);
  });
});

describe('capital letters', () => {
  it('capitalizes names, leaving small words inside them', () => {
    expect(capitalizeName('roosevelt high')).toBe('Roosevelt High');
    expect(capitalizeName('member, robotics team')).toBe('Member, Robotics Team');
    expect(capitalizeName('university of the pacific')).toBe('University of the Pacific');
  });

  it('lists only fields typed all in lowercase, and changes nothing by itself', () => {
    const draft: ResumeDraft = {
      ...emptyDraft(),
      name: 'dani',
      email: 'dani@example.com',
      school: 'roosevelt high',
      city: 'Fresno, CA',
      experiences: [{ ...emptyExperience('club'), role: 'member, robotics team', where: 'FIRST' }],
    };
    expect(capitalFixes(draft).map((fix) => fix.to)).toEqual([
      'Dani',
      'Roosevelt High',
      'Member, Robotics Team',
    ]);
    expect(draft.name).toBe('dani');
    const fixed = applyCapitalFixes(draft);
    expect(fixed).toMatchObject({
      name: 'Dani',
      school: 'Roosevelt High',
      email: 'dani@example.com',
    });
    expect(fixed.experiences[0]).toMatchObject({ role: 'Member, Robotics Team', where: 'FIRST' });
    expect(capitalFixes(fixed)).toEqual([]);
  });
});

describe('kinds of experience', () => {
  it('names babysitting and pet sitting as its own choice', () => {
    expect(EXPERIENCE_KINDS.sitting.label).toBe('Babysitting or pet sitting');
    expect(EXPERIENCE_KINDS.other.role).not.toBe('Babysitter');
  });
});
