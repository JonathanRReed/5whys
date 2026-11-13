import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, restoreBackup, summarizeBackup } from '../src/lib/studio-backup';

const fixture = (name: string): string =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'backups', name), 'utf8');

describe('backup files written by earlier versions', () => {
  beforeEach(() => localStorage.clear());

  it('imports a full version 1 file with every store unchanged', async () => {
    const text = fixture('v1-full.json');
    const raw = JSON.parse(text) as { stores: Record<string, unknown> };
    const backup = parseBackup(text);
    const written = await restoreBackup(backup, true);
    expect([...written].sort()).toEqual(Object.keys(raw.stores).sort());
    for (const [key, value] of Object.entries(raw.stores)) {
      expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual(value);
    }
    expect(summarizeBackup(backup)).toMatchObject({
      reflections: 1,
      resumeBullets: 1,
      practiceRounds: 1,
      stories: 0,
      applications: 1,
      hasProfile: true,
    });
  });

  it('adds a minimal version 1 file without touching other saved work', async () => {
    localStorage.setItem('career-tools-profile', '{"stage":"student","focus":"resume"}');
    const written = await restoreBackup(parseBackup(fixture('v1-minimal.json')), false);
    expect(written).toEqual(['career-why-history']);
    expect(JSON.parse(localStorage.getItem('career-why-history') ?? 'null')).toEqual([
      { id: 'snap-only', topic: 'Teaching' },
    ]);
    expect(localStorage.getItem('career-tools-profile')).toBe(
      '{"stage":"student","focus":"resume"}'
    );
  });

  it('imports a hand-edited file with no version, keeping only studio keys', async () => {
    const written = await restoreBackup(parseBackup(fixture('v1-hand-edited.json')), false);
    expect([...written].sort()).toEqual(['career-applications', 'career-tools-profile']);
    expect(localStorage.getItem('a-key-from-somewhere-else')).toBeNull();
    expect(JSON.parse(localStorage.getItem('career-applications') ?? 'null')).toEqual({
      applications: [{ title: 'Analyst' }],
    });
  });
});
