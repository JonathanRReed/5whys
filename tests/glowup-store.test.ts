import { beforeEach, describe, expect, it } from 'vitest';
import { getSkillFrequencyMap, getTopGaps, loadData } from '../src/lib/glowup-store';

describe('glowup store normalization', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('fills in missing arrays on records from edited backups and older saves', () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'r1', jobTitle: 'Analyst', bullets: [{ id: 'b1', text: 'Write SQL' }] }],
        stories: [{ id: 's1' }],
        packets: [{ id: 'p1', roleId: 'r1' }],
      })
    );

    const data = loadData();
    expect(data.roles[0].bullets[0].secondarySkillIds).toEqual([]);
    expect(data.roles[0].bullets[0].status).toBe('active');
    expect(data.stories[0].otherSkillIds).toEqual([]);
    expect(data.packets[0].topStoryIds).toEqual([]);

    // The HUD and vault call toLowerCase on these; they come back as strings.
    expect(data.stories[0].trigger).toBe('');
    expect(data.stories[0].primarySkillId).toBe('');

    // The sections iterate these fields blind; one missing array used to
    // take the whole workspace island down.
    expect(() => getSkillFrequencyMap(data.roles[0].bullets)).not.toThrow();
    expect(() => getTopGaps(data, data.roles[0].bullets)).not.toThrow();
  });

  it('fills in companyIntel sub-arrays and survives non-object payloads', () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [],
        stories: [],
        packets: [{ id: 'p1', roleId: 'r1', companyIntel: { notes: 'ask about the team' } }],
      })
    );
    const data = loadData();
    expect(data.packets[0].companyIntel?.keywords).toEqual([]);
    expect(data.packets[0].companyIntel?.notes).toBe('ask about the team');

    window.localStorage.setItem('interview-glow-up-data', '"just a string"');
    expect(loadData().roles).toEqual([]);
  });

  it('keeps ignored bullets ignored', () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'r1', bullets: [{ id: 'b1', text: 'x', status: 'ignored' }] }],
        stories: [],
        packets: [],
      })
    );
    expect(loadData().roles[0].bullets[0].status).toBe('ignored');
  });
});
