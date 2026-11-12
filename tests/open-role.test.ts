import { afterEach, describe, expect, it } from 'vitest';
import { createRole, loadData, openRole, saveData } from '../src/lib/glowup-store';

afterEach(() => localStorage.clear());

describe('opening the interview tools for one application', () => {
  it('makes that application role current, and writes nothing otherwise', () => {
    let data = createRole(loadData(), {
      jobTitle: 'First',
      company: 'A',
      rawJdText: '',
      bullets: [],
    });
    const first = data.currentRoleId as string;
    data = createRole(data, { jobTitle: 'Second', company: 'B', rawJdText: '', bullets: [] });
    saveData(data);
    const second = loadData().currentRoleId;
    expect(second).not.toBe(first);

    openRole(first);
    expect(loadData().currentRoleId).toBe(first);

    const before = localStorage.getItem('interview-glow-up-data');
    openRole(first);
    openRole('no-such-role');
    openRole(null);
    expect(localStorage.getItem('interview-glow-up-data')).toBe(before);
  });
});
