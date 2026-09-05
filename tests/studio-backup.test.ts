import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  collectBackup,
  parseBackup,
  restoreBackup,
  STUDIO_STORAGE_KEYS,
  summarizeBackup,
} from '../src/lib/studio-backup';

describe('studio backup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('collects every tool store and nothing else', () => {
    window.localStorage.setItem('career-why-history', JSON.stringify([{ id: 'a' }]));
    window.localStorage.setItem('career-tools-theme', 'dawn');
    window.localStorage.setItem('unrelated', '1');
    const backup = collectBackup();
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(Object.keys(backup.stores)).toEqual(['career-why-history']);
    expect(summarizeBackup(backup).reflections).toBe(1);
  });

  it('rejects files that are not studio exports with a readable reason', () => {
    expect(() => parseBackup('not json')).toThrow(/not JSON/);
    expect(() => parseBackup('{"format":"other","stores":{}}')).toThrow(/not exported by/);
    expect(() => parseBackup('{"format":"5whys-career-studio","version":99,"stores":{}}')).toThrow(
      /newer version/
    );
  });

  it('restores only known keys, and replace clears the rest first', () => {
    window.localStorage.setItem('resume-game-session-v2', JSON.stringify({ bullets: [1, 2] }));
    const file = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-09-01T00:00:00.000Z',
      stores: {
        'career-why-history': [{ id: 'snap' }],
        'something-else': { evil: true },
      },
    });
    const backup = parseBackup(file);
    expect(Object.keys(backup.stores)).toEqual(['career-why-history']);

    const merged = restoreBackup(backup, false);
    expect(merged).toEqual(['career-why-history']);
    expect(window.localStorage.getItem('resume-game-session-v2')).not.toBeNull();

    restoreBackup(backup, true);
    expect(window.localStorage.getItem('resume-game-session-v2')).toBeNull();
    expect(window.localStorage.getItem('something-else')).toBeNull();
    for (const key of STUDIO_STORAGE_KEYS) {
      if (key !== 'career-why-history') expect(window.localStorage.getItem(key)).toBeNull();
    }
  });
});
