import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_SIZE_MESSAGE,
  collectBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreBackup,
  STUDIO_STORAGE_KEYS,
  type StudioBackup,
  summarizeBackup,
} from '../src/lib/studio-backup';

const validStores = {
  'career-tools-profile': { stage: 'student', focus: 'resume' },
  'career-why-session-v2': { topic: 'Biology', responses: [] },
  'career-why-history': [{ id: 'imported' }],
  'career-why-history-limit': 12,
  'resume-game-session-v2': { bullets: [] },
  'networking-practice-versions': [],
  'networking-practice-sessions': [],
  'networking-practice-draft': { text: 'My intro' },
  'interview-glow-up-data': { roles: [], stories: [], packets: [] },
  'career-applications': { applications: [] },
  'career-application-desk': { desks: {} },
} satisfies StudioBackup['stores'];

describe('studio backup', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('collects every tool store and nothing else', async () => {
    window.localStorage.setItem('career-why-history', JSON.stringify([{ id: 'a' }]));
    window.localStorage.setItem(
      'career-applications',
      JSON.stringify({ version: 1, applications: [{ id: 'x' }, { id: 'y' }], activeId: 'x' })
    );
    window.localStorage.setItem('career-tools-theme', 'dawn');
    window.localStorage.setItem('unrelated', '1');
    const backup = await collectBackup();
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(Object.keys(backup.stores)).toEqual(['career-why-history', 'career-applications']);
    expect(summarizeBackup(backup).reflections).toBe(1);
    expect(summarizeBackup(backup).applications).toBe(2);
  });

  it('rejects files that are not studio exports with a readable reason', async () => {
    expect(() => parseBackup('not json')).toThrow(/not JSON/);
    expect(() => parseBackup('{"format":"other","stores":{}}')).toThrow(/not exported by/);
    expect(() => parseBackup('{"format":"5whys-career-studio","version":99,"stores":{}}')).toThrow(
      /newer version/
    );
  });

  it('restores only known keys, and replace clears omitted studio stores', async () => {
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

    const merged = await restoreBackup(backup, false);
    expect(merged).toEqual(['career-why-history']);
    expect(window.localStorage.getItem('resume-game-session-v2')).not.toBeNull();

    await restoreBackup(backup, true);
    expect(window.localStorage.getItem('resume-game-session-v2')).toBeNull();
    expect(window.localStorage.getItem('something-else')).toBeNull();
    for (const key of STUDIO_STORAGE_KEYS) {
      if (key !== 'career-why-history') expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it.each([false, true])(
    'preserves existing work when an import write fails (replace=%s)',
    async (replace) => {
      const originalProfile = JSON.stringify({
        stage: 'student',
        focus: 'resume',
        name: 'Original profile',
      });
      const originalHistory = JSON.stringify([{ id: 'saved-reflection' }]);
      localStorage.setItem('career-tools-profile', originalProfile);
      localStorage.setItem('career-why-history', originalHistory);
      localStorage.setItem('unrelated', 'keep');
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key,
        value
      ) {
        if (key === 'career-why-history' && value.includes('imported-reflection')) {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      });
      const backup = parseBackup(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        })
      );

      await expect(restoreBackup(backup, replace)).rejects.toThrow();
      expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
      expect(localStorage.getItem('career-why-history')).toBe(originalHistory);
      expect(localStorage.getItem('unrelated')).toBe('keep');
    }
  );

  it('serializes every imported store before changing saved work', async () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const circular: Record<string, unknown> = { stage: 'student', focus: 'resume' };
    circular.self = circular;
    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': circular },
        },
        true
      )
    ).rejects.toThrow();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it.each(STUDIO_STORAGE_KEYS)(
    'restores every original when writing %s fails',
    async (failedKey) => {
      const stores: StudioBackup['stores'] = {};
      for (const key of STUDIO_STORAGE_KEYS) {
        localStorage.setItem(key, JSON.stringify({ original: key }));
        stores[key] = validStores[key];
      }
      localStorage.setItem('unrelated', 'keep');
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key,
        value
      ) {
        if (key === failedKey && value === JSON.stringify(validStores[failedKey])) {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      });

      await expect(
        restoreBackup({ format: BACKUP_FORMAT, version: 1, exportedAt: '', stores }, true)
      ).rejects.toThrow(/could not|couldn't/i);
      for (const key of STUDIO_STORAGE_KEYS) {
        expect(localStorage.getItem(key)).toBe(JSON.stringify({ original: key }));
      }
      expect(localStorage.getItem('unrelated')).toBe('keep');
    }
  );

  it('does not remove omitted work before all imported stores have saved', async () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
          },
        },
        true
      )
    ).rejects.toThrow();
    failure.mockRestore();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it.each(STUDIO_STORAGE_KEYS.slice(1))(
    'restores writes and removals when clearing %s fails',
    async (failedKey) => {
      for (const key of STUDIO_STORAGE_KEYS) {
        localStorage.setItem(key, JSON.stringify({ original: key }));
      }
      localStorage.setItem('unrelated', 'keep');
      const removeItem = Storage.prototype.removeItem;
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
        if (key === failedKey) throw new DOMException('Storage is unavailable', 'SecurityError');
        removeItem.call(this, key);
      });

      await expect(
        restoreBackup(
          {
            format: BACKUP_FORMAT,
            version: 1,
            exportedAt: '',
            stores: {
              'career-tools-profile': { stage: 'student', focus: 'resume', imported: true },
            },
          },
          true
        )
      ).rejects.toThrow(/could not|couldn't/i);
      for (const key of STUDIO_STORAGE_KEYS) {
        expect(localStorage.getItem(key)).toBe(JSON.stringify({ original: key }));
      }
      expect(localStorage.getItem('unrelated')).toBe('keep');
    }
  );

  it('removes newly added keys before restoring larger overwritten values', async () => {
    const originalProfile = JSON.stringify({
      stage: 'student',
      focus: 'resume',
      name: 'A longer original profile',
    });
    localStorage.setItem('career-tools-profile', originalProfile);
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (
        key === 'career-why-history' ||
        (value === originalProfile && this.getItem('career-why-session-v2') !== null)
      ) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'New' },
            'career-why-session-v2': { topic: 'New session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).rejects.toThrow(/previous saved work was restored/i);
    expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
    expect(localStorage.getItem('career-why-session-v2')).toBeNull();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it('reports incomplete rollback and still restores other changed keys', async () => {
    localStorage.setItem(
      'career-tools-profile',
      '{"stage":"student","focus":"resume","name":"Original profile"}'
    );
    localStorage.setItem('career-why-session-v2', '{"topic":"Original session"}');
    localStorage.setItem('unrelated', 'keep');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'career-why-history' || value.includes('Original profile')) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
            'career-why-session-v2': { topic: 'Imported session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).rejects.toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-session-v2')).toBe('{"topic":"Original session"}');
    expect(localStorage.getItem('career-tools-profile')).toBe(
      '{"stage":"student","focus":"resume","name":"Imported profile"}'
    );
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('frees space in overwritten stores before restoring removed work', async () => {
    const originalProfile = '{"stage":"student","focus":"resume","name":"Old"}';
    localStorage.setItem('career-tools-profile', originalProfile);
    localStorage.setItem('career-why-session-v2', '{"topic":"Saved session"}');
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    localStorage.setItem('resume-game-session-v2', '{"bullets":[]}');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (
        key === 'career-why-history' &&
        this.getItem('career-tools-profile') !== originalProfile
      ) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    });
    const removeItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'resume-game-session-v2')
        throw new DOMException('Storage is unavailable', 'SecurityError');
      removeItem.call(this, key);
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': {
              stage: 'student',
              focus: 'resume',
              name: 'A larger imported profile',
            },
          },
        },
        true
      )
    ).rejects.toThrow(/previous saved work was restored/i);
    expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
    expect(localStorage.getItem('career-why-session-v2')).toBe('{"topic":"Saved session"}');
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
    expect(localStorage.getItem('resume-game-session-v2')).toBe('{"bullets":[]}');
  });

  it('reports a failed rollback removal and continues removing other new keys', async () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'career-why-history') throw new Error('Cannot save');
      setItem.call(this, key, value);
    });
    const removeItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'career-tools-profile') throw new Error('Cannot remove');
      removeItem.call(this, key);
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
            'career-why-session-v2': { topic: 'Imported session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).rejects.toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-session-v2')).toBeNull();
    expect(localStorage.getItem('career-tools-profile')).toBe(
      '{"stage":"student","focus":"resume","name":"Imported profile"}'
    );
  });

  it.each(['career-tools-profile', 'career-why-session-v2'])(
    'preserves a newer value in %s during rollback',
    async (changedKey) => {
      localStorage.setItem(
        'career-tools-profile',
        '{"stage":"student","focus":"resume","name":"Original profile"}'
      );
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key,
        value
      ) {
        if (key === 'career-why-history') {
          setItem.call(this, changedKey, '{"newer":"another tab"}');
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      });

      await expect(
        restoreBackup(
          {
            format: BACKUP_FORMAT,
            version: 1,
            exportedAt: '',
            stores: {
              'career-tools-profile': {
                stage: 'student',
                focus: 'resume',
                name: 'Imported profile',
              },
              'career-why-session-v2': { topic: 'Imported session' },
              'career-why-history': [{ id: 'imported-reflection' }],
            },
          },
          false
        )
      ).rejects.toThrow(/some saved work may have changed/i);
      expect(localStorage.getItem(changedKey)).toBe('{"newer":"another tab"}');
    }
  );

  it('preserves a newer value added after a replacement removed that store', async () => {
    localStorage.setItem(
      'career-tools-profile',
      '{"stage":"student","focus":"resume","name":"Original profile"}'
    );
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    localStorage.setItem('resume-game-session-v2', '{"bullets":[]}');
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'resume-game-session-v2') {
        setItem.call(this, 'career-why-history', '[{"id":"newer-reflection"}]');
        throw new DOMException('Storage is unavailable', 'SecurityError');
      }
      removeItem.call(this, key);
    });

    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
          },
        },
        true
      )
    ).rejects.toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"newer-reflection"}]');
    expect(localStorage.getItem('career-tools-profile')).toBe(
      '{"stage":"student","focus":"resume","name":"Original profile"}'
    );
  });

  it('reads all original stores before changing any of them', async () => {
    localStorage.setItem(
      'career-tools-profile',
      '{"stage":"student","focus":"resume","name":"Original profile"}'
    );
    const getItem = Storage.prototype.getItem;
    const failure = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key
    ) {
      if (key === 'career-why-history')
        throw new DOMException('Storage is unavailable', 'SecurityError');
      return getItem.call(this, key);
    });
    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
          },
        },
        true
      )
    ).rejects.toThrow(/could not|couldn't/i);
    failure.mockRestore();
    expect(localStorage.getItem('career-tools-profile')).toBe(
      '{"stage":"student","focus":"resume","name":"Original profile"}'
    );
  });

  it('reports unavailable storage without changing saved work', async () => {
    const failure = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    });
    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { stage: 'student', focus: 'resume', name: 'Imported profile' },
          },
        },
        true
      )
    ).rejects.toThrow(/could not|couldn't/i);
    failure.mockRestore();
  });

  it.each([{}, { unknown: 'ignored' }, { 'career-why-history': null }])(
    'does not clear saved work for an empty usable backup (%j)',
    async (stores) => {
      localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
      const backup = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores }));
      expect(await restoreBackup(backup, true)).toEqual([]);
      expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
    }
  );

  it.each([[[]], [null], ['invalid']])('rejects malformed stores (%j)', async (stores) => {
    expect(() =>
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores }))
    ).toThrow(/not exported by/);
  });

  it('does not write an unserializable store or clear existing work', async () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    await expect(
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': () => 'invalid' },
        },
        true
      )
    ).rejects.toThrow();
    expect(localStorage.getItem('career-tools-profile')).toBeNull();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });
  it.each(STUDIO_STORAGE_KEYS)(
    'refuses an invalid %s before parse or restore can change anything',
    async (key) => {
      localStorage.setItem('career-why-history', '[{"id":"saved"}]');
      const message = `That file contains invalid data for "${key}". Your saved work was not changed.`;
      const backup: StudioBackup = {
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '',
        stores: { ...validStores, [key]: 'x' },
      };
      expect(() => parseBackup(JSON.stringify(backup))).toThrow(new Error(message));
      for (const replace of [false, true])
        await expect(restoreBackup(backup, replace)).rejects.toThrow(new Error(message));
      expect(localStorage.length).toBe(1);
      expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved"}]');
    }
  );

  it.each([
    ['career-tools-profile', { stage: 'stranger', focus: 'resume' }],
    ['career-why-session-v2', { topic: 3 }],
    ['career-why-history', [null]],
    ['career-why-history-limit', 7],
    ['resume-game-session-v2', { bullets: 'x' }],
    ['resume-game-session-v2', { bullets: [], resumeText: 42 }],
    ['networking-practice-versions', [{ who: [] }]],
    ['networking-practice-sessions', [{ attempts: [null] }]],
    ['networking-practice-draft', { text: 'intro', ratingsTouched: 'yes' }],
    ['interview-glow-up-data', { roles: [null], stories: [], packets: [] }],
    ['career-applications', { applications: [{ title: 12 }] }],
    ['career-application-desk', { desks: [] }],
  ])('refuses malformed fields in %s with its store name', (key, value) => {
    expect(() =>
      parseBackup(
        JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores: { [String(key)]: value } })
      )
    ).toThrow(
      new Error(`That file contains invalid data for "${key}". Your saved work was not changed.`)
    );
  });

  it('refuses oversized text before JSON parsing, including multibyte text', () => {
    for (const text of ['x'.repeat(MAX_BACKUP_BYTES + 1), 'é'.repeat(MAX_BACKUP_BYTES / 2 + 1)]) {
      expect(() => parseBackup(text)).toThrow(new Error(BACKUP_SIZE_MESSAGE));
    }
  });

  it('ignores an overlapping import, then allows another after completion', async () => {
    const first: StudioBackup = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '',
      stores: { 'career-why-history': [{ id: 'first' }] },
    };
    const running = restoreBackup(first, true);
    expect(
      await restoreBackup({ ...first, stores: { 'career-why-history': [{ id: 'second' }] } }, true)
    ).toEqual([]);
    await running;
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"first"}]');
    expect(await restoreBackup(first, false)).toEqual(['career-why-history']);
  });
});
