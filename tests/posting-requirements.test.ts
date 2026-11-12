import { describe, expect, it } from 'vitest';
import type { DecodedBullet } from '../src/lib/glowup-store';
import {
  addRequirement,
  bulletsFromRequirements,
  bulletToRequirement,
  carryOverDecisions,
  confirmAllSuggested,
  confirmedRequirements,
  confirmRequirement,
  countBySection,
  decodePostingToBullets,
  dismissRequirement,
  editRequirementText,
  parsePosting,
  removeRequirement,
  requirementsFromBullets,
  requirementToBullet,
  restoreRequirement,
  setRequirementSection,
} from '../src/lib/posting';

const POSTING = `Requirements
- Experience with Excel and pivot tables
- Must be 16 years or older

Nice to have
- Cash handling experience`;

describe('requirement edits', () => {
  const start = parsePosting(POSTING).requirements;
  const [excel, age, cash] = start;

  it('confirms, dismisses, and restores without touching the input', () => {
    const snapshot = structuredClone(start);
    const confirmedList = confirmRequirement(start, excel.id);
    expect(confirmedList[0].status).toBe('confirmed');
    expect(start).toEqual(snapshot);

    const dismissed = dismissRequirement(confirmedList, age.id);
    expect(dismissed.map((r) => r.status)).toEqual(['confirmed', 'dismissed', 'suggested']);
    expect(restoreRequirement(dismissed, age.id)[1].status).toBe('suggested');
  });

  it('returns the same list when nothing changes', () => {
    expect(confirmRequirement(start, 'missing')).toBe(start);
    expect(restoreRequirement(start, excel.id)).toBe(start);
    expect(setRequirementSection(start, cash.id, 'preferred')).toBe(start);
    expect(editRequirementText(start, excel.id, '   ')).toBe(start);
    expect(addRequirement(start, '  ')).toBe(start);
    expect(confirmAllSuggested(confirmAllSuggested(start))).toEqual(confirmAllSuggested(start));
  });

  it('changes the section and keeps the engine reading', () => {
    const moved = setRequirementSection(start, cash.id, 'required');
    expect(moved[2].section).toBe('required');
    expect(moved[2].classification?.section).toBe('preferred');
  });

  it('edits text and keeps the source span', () => {
    const edited = editRequirementText(start, excel.id, 'Excel, including pivot tables');
    expect(edited[0].text).toBe('Excel, including pivot tables');
    expect(edited[0].span).toEqual(excel.span);
  });

  it('adds the student’s own requirement, confirmed and without a span', () => {
    const added = addRequirement(start, 'Food handler card', { section: 'required' });
    expect(added[3]).toEqual({
      id: 's-1',
      text: 'Food handler card',
      section: 'required',
      status: 'confirmed',
      origin: 'student',
      span: null,
    });
    const twice = addRequirement(added, 'CPR certification');
    expect(twice[4].id).toBe('s-2');
    expect(twice[4].section).toBe('unclassified');
    expect(addRequirement(twice, 'Duplicate id', { id: 's-1' })[5].id).toBe('s-3');
  });

  it('removes only what the student added', () => {
    const added = addRequirement(start, 'Food handler card');
    expect(removeRequirement(added, excel.id)).toBe(added);
    expect(removeRequirement(added, 's-1')).toEqual(start);
  });

  it('counts by section and lists confirmed ones', () => {
    const list = dismissRequirement(confirmRequirement(start, excel.id), cash.id);
    expect(countBySection(list)).toEqual({
      required: 2,
      preferred: 0,
      responsibility: 0,
      unclassified: 0,
    });
    expect(confirmedRequirements(list).map((r) => r.id)).toEqual([excel.id]);
  });

  it('confirms suggested requirements selectively', () => {
    const onlyRequired = confirmAllSuggested(start, (r) => r.section === 'required');
    expect(onlyRequired.map((r) => r.status)).toEqual(['confirmed', 'confirmed', 'suggested']);
  });
});

describe('carryOverDecisions', () => {
  it('keeps decisions on sentences that survive a re-parse', () => {
    const first = parsePosting(POSTING);
    let list = confirmRequirement(first.requirements, first.requirements[0].id);
    list = dismissRequirement(list, first.requirements[1].id);
    list = addRequirement(list, 'Food handler card');

    const edited = `Job: Cashier\n\n${POSTING}\n- Basic math skills for making change`;
    const second = parsePosting(edited);
    const merged = carryOverDecisions(list, second.requirements, first.text, second.text);

    expect(merged.map((r) => [r.text, r.status])).toEqual([
      ['Experience with Excel and pivot tables', 'confirmed'],
      ['Must be 16 years or older', 'dismissed'],
      ['Cash handling experience', 'suggested'],
      ['Basic math skills for making change', 'suggested'],
      ['Food handler card', 'confirmed'],
    ]);
    // Spans follow the new text.
    expect(edited.slice(merged[0].span?.start, merged[0].span?.end)).toBe(
      'Experience with Excel and pivot tables'
    );
  });
});

describe('Glow Up bullets', () => {
  it('reads an old bullet as an unclassified suggestion with no span', () => {
    const old: DecodedBullet = {
      id: '1700000000000-abc1234',
      text: 'Experience with SQL',
      status: 'active',
      primarySkillId: 'sql',
      secondarySkillIds: [],
    };
    expect(bulletToRequirement(old)).toEqual({
      id: old.id,
      text: 'Experience with SQL',
      section: 'unclassified',
      status: 'suggested',
      origin: 'parsed',
      span: null,
    });
    expect(bulletToRequirement({ ...old, status: 'ignored', confirmed: true }).status).toBe(
      'dismissed'
    );
  });

  it('round-trips requirements through bullets', () => {
    let list = parsePosting(POSTING).requirements;
    list = confirmRequirement(list, list[0].id);
    list = dismissRequirement(list, list[1].id);
    list = addRequirement(list, 'Food handler card', { section: 'preferred' });
    const bullets = bulletsFromRequirements(list);
    expect(bullets.map((b) => [b.status, b.confirmed, b.section, b.origin])).toEqual([
      ['active', true, 'required', 'parsed'],
      ['ignored', false, 'required', 'parsed'],
      ['active', false, 'preferred', 'parsed'],
      ['active', true, 'preferred', 'student'],
    ]);
    const back = requirementsFromBullets(bullets);
    expect(back.map(({ classification: _, ...r }) => r)).toEqual(
      list.map(({ classification: _, ...r }) => r)
    );
  });

  it('tags skills the way the decode screen does and keeps the student’s tags', () => {
    const [excel] = parsePosting(POSTING).requirements;
    const bullet = requirementToBullet(excel);
    expect(bullet.primarySkillId).toBe('data-analysis');
    expect(bullet.suggestion?.[0].matchedKeywords).toEqual(['excel']);

    const retagged = { ...bullet, primarySkillId: 'attention-to-detail' };
    expect(requirementToBullet(excel, retagged).primarySkillId).toBe('attention-to-detail');
    const reworded = { ...excel, text: 'Python scripting for reports' };
    expect(requirementToBullet(reworded, retagged).primarySkillId).toBe('python');
  });

  it('decodes a posting straight to bullets with spans into the posting', () => {
    const { parsed, bullets } = decodePostingToBullets(POSTING);
    expect(bullets).toHaveLength(parsed.requirements.length);
    for (const bullet of bullets) {
      const span = bullet.sourceSpan;
      expect(span && POSTING.slice(span.start, span.end)).toBe(bullet.text);
    }
  });
});
