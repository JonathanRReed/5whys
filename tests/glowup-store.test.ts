import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSkillFrequencyMap,
  getTopGaps,
  loadData,
  POSTING_ENGINE_VERSION,
} from '../src/lib/glowup-store';

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

  it('loads a role saved before the posting engine with defaults and nothing else changed', () => {
    const oldRole = {
      id: 'r1',
      jobTitle: 'Data Analytics Intern',
      company: 'Larkspur Transit',
      rawJdText: 'Requirements\n- Experience with Excel',
      parsedJdText: 'Requirements\n- Experience with Excel',
      bullets: [
        {
          id: 'b1',
          text: 'Experience with Excel',
          status: 'active',
          primarySkillId: 'data-analysis',
          secondarySkillIds: [],
          suggestion: [{ skillId: 'data-analysis', matchedKeywords: ['excel'] }],
        },
        {
          id: 'b2',
          text: 'Apply today',
          status: 'ignored',
          primarySkillId: null,
          secondarySkillIds: [],
        },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000001,
    };
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({ version: 1, roles: [oldRole], stories: [], packets: [] })
    );

    const role = loadData().roles[0];
    expect(role.postingEngineVersion).toBeUndefined();
    expect(role.bullets[0]).toEqual({
      ...oldRole.bullets[0],
      section: 'unclassified',
      sourceSpan: null,
      confirmed: false,
      origin: 'parsed',
    });
    expect(role.bullets[1]).toMatchObject({ status: 'ignored', confirmed: false });
    const { bullets: _bullets, ...rest } = role;
    const { bullets: _oldBullets, ...oldRest } = oldRole;
    expect(rest).toEqual(oldRest);
  });

  it('keeps posting-engine fields and repairs malformed ones', () => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'r1',
            postingEngineVersion: POSTING_ENGINE_VERSION,
            bullets: [
              {
                id: 'p-13-34',
                text: 'Experience with Excel',
                section: 'preferred',
                sourceSpan: { start: 13, end: 34 },
                confirmed: true,
                origin: 'student',
              },
              {
                id: 'p-1-2',
                text: 'x',
                section: 'mandatory',
                sourceSpan: { start: 9, end: 2 },
                confirmed: 'yes',
                origin: 'robot',
              },
            ],
          },
        ],
        stories: [],
        packets: [],
      })
    );
    const [kept, repaired] = loadData().roles[0].bullets;
    expect(loadData().roles[0].postingEngineVersion).toBe(POSTING_ENGINE_VERSION);
    expect(kept).toMatchObject({
      section: 'preferred',
      sourceSpan: { start: 13, end: 34 },
      confirmed: true,
      origin: 'student',
    });
    expect(repaired).toMatchObject({
      section: 'unclassified',
      sourceSpan: null,
      confirmed: false,
      origin: 'parsed',
    });
  });
});
