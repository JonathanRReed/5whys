import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_FORMAT,
  collectBackup,
  parseBackup,
  restoreBackup,
  STUDIO_STORAGE_KEYS,
  type StudioBackup,
  summarizeBackup,
} from '../src/lib/studio-backup';

describe('studio backup', () => {
  afterEach(() => vi.restoreAllMocks());
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

  it('restores only known keys, and replace clears omitted studio stores', () => {
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

  it.each([false, true])(
    'preserves existing work when an import write fails (replace=%s)',
    (replace) => {
      const originalProfile = JSON.stringify({ name: 'Original profile' });
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
            'career-tools-profile': { name: 'Imported profile' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        })
      );

      expect(() => restoreBackup(backup, replace)).toThrow();
      expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
      expect(localStorage.getItem('career-why-history')).toBe(originalHistory);
      expect(localStorage.getItem('unrelated')).toBe('keep');
    }
  );

  it('serializes every imported store before changing saved work', () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': circular },
        },
        true
      )
    ).toThrow();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it.each(STUDIO_STORAGE_KEYS)('restores every original when writing %s fails', (failedKey) => {
    const stores: StudioBackup['stores'] = {};
    for (const key of STUDIO_STORAGE_KEYS) {
      localStorage.setItem(key, JSON.stringify({ original: key }));
      stores[key] = { imported: key };
    }
    localStorage.setItem('unrelated', 'keep');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === failedKey && value.includes('imported')) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    });

    expect(() =>
      restoreBackup({ format: BACKUP_FORMAT, version: 1, exportedAt: '', stores }, true)
    ).toThrow(/could not|couldn't/i);
    for (const key of STUDIO_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBe(JSON.stringify({ original: key }));
    }
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('does not remove omitted work before all imported stores have saved', () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': { name: 'Imported profile' } },
        },
        true
      )
    ).toThrow();
    failure.mockRestore();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it.each(STUDIO_STORAGE_KEYS.slice(1))(
    'restores writes and removals when clearing %s fails',
    (failedKey) => {
      for (const key of STUDIO_STORAGE_KEYS) {
        localStorage.setItem(key, JSON.stringify({ original: key }));
      }
      localStorage.setItem('unrelated', 'keep');
      const removeItem = Storage.prototype.removeItem;
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
        if (key === failedKey) throw new DOMException('Storage is unavailable', 'SecurityError');
        removeItem.call(this, key);
      });

      expect(() =>
        restoreBackup(
          {
            format: BACKUP_FORMAT,
            version: 1,
            exportedAt: '',
            stores: { 'career-tools-profile': { imported: true } },
          },
          true
        )
      ).toThrow(/could not|couldn't/i);
      for (const key of STUDIO_STORAGE_KEYS) {
        expect(localStorage.getItem(key)).toBe(JSON.stringify({ original: key }));
      }
      expect(localStorage.getItem('unrelated')).toBe('keep');
    }
  );

  it('removes newly added keys before restoring larger overwritten values', () => {
    const originalProfile = JSON.stringify({ name: 'A longer original profile' });
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

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { name: 'New' },
            'career-why-session-v2': { topic: 'New session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).toThrow(/previous saved work was restored/i);
    expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
    expect(localStorage.getItem('career-why-session-v2')).toBeNull();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });

  it('reports incomplete rollback and still restores other changed keys', () => {
    localStorage.setItem('career-tools-profile', '{"name":"Original profile"}');
    localStorage.setItem('career-why-session-v2', '{"topic":"Original session"}');
    localStorage.setItem('unrelated', 'keep');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'career-why-history' || value.includes('Original profile')) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    });

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { name: 'Imported profile' },
            'career-why-session-v2': { topic: 'Imported session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-session-v2')).toBe('{"topic":"Original session"}');
    expect(localStorage.getItem('career-tools-profile')).toBe('{"name":"Imported profile"}');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('frees space in overwritten stores before restoring removed work', () => {
    const originalProfile = '{"name":"Old"}';
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

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': { name: 'A larger imported profile' } },
        },
        true
      )
    ).toThrow(/previous saved work was restored/i);
    expect(localStorage.getItem('career-tools-profile')).toBe(originalProfile);
    expect(localStorage.getItem('career-why-session-v2')).toBe('{"topic":"Saved session"}');
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
    expect(localStorage.getItem('resume-game-session-v2')).toBe('{"bullets":[]}');
  });

  it('reports a failed rollback removal and continues removing other new keys', () => {
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

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: {
            'career-tools-profile': { name: 'Imported profile' },
            'career-why-session-v2': { topic: 'Imported session' },
            'career-why-history': [{ id: 'imported-reflection' }],
          },
        },
        false
      )
    ).toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-session-v2')).toBeNull();
    expect(localStorage.getItem('career-tools-profile')).toBe('{"name":"Imported profile"}');
  });

  it.each(['career-tools-profile', 'career-why-session-v2'])(
    'preserves a newer value in %s during rollback',
    (changedKey) => {
      localStorage.setItem('career-tools-profile', '{"name":"Original profile"}');
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

      expect(() =>
        restoreBackup(
          {
            format: BACKUP_FORMAT,
            version: 1,
            exportedAt: '',
            stores: {
              'career-tools-profile': { name: 'Imported profile' },
              'career-why-session-v2': { topic: 'Imported session' },
              'career-why-history': [{ id: 'imported-reflection' }],
            },
          },
          false
        )
      ).toThrow(/some saved work may have changed/i);
      expect(localStorage.getItem(changedKey)).toBe('{"newer":"another tab"}');
    }
  );

  it('preserves a newer value added after a replacement removed that store', () => {
    localStorage.setItem('career-tools-profile', '{"name":"Original profile"}');
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

    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': { name: 'Imported profile' } },
        },
        true
      )
    ).toThrow(/some saved work may have changed/i);
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"newer-reflection"}]');
    expect(localStorage.getItem('career-tools-profile')).toBe('{"name":"Original profile"}');
  });

  it('reads all original stores before changing any of them', () => {
    localStorage.setItem('career-tools-profile', '{"name":"Original profile"}');
    const getItem = Storage.prototype.getItem;
    const failure = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key
    ) {
      if (key === 'career-why-history')
        throw new DOMException('Storage is unavailable', 'SecurityError');
      return getItem.call(this, key);
    });
    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': { name: 'Imported profile' } },
        },
        true
      )
    ).toThrow(/could not|couldn't/i);
    failure.mockRestore();
    expect(localStorage.getItem('career-tools-profile')).toBe('{"name":"Original profile"}');
  });

  it('reports unavailable storage without changing saved work', () => {
    const failure = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    });
    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': { name: 'Imported profile' } },
        },
        true
      )
    ).toThrow(/could not|couldn't/i);
    failure.mockRestore();
  });

  it.each([{}, { unknown: 'ignored' }, { 'career-why-history': null }])(
    'does not clear saved work for an empty usable backup (%j)',
    (stores) => {
      localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
      const backup = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores }));
      expect(restoreBackup(backup, true)).toEqual([]);
      expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
    }
  );

  it.each([[[]], [null], ['invalid']])('rejects malformed stores (%j)', (stores) => {
    expect(() =>
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores }))
    ).toThrow(/not exported by/);
  });

  it('does not write an unserializable store or clear existing work', () => {
    localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
    expect(() =>
      restoreBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: '',
          stores: { 'career-tools-profile': () => 'invalid' },
        },
        true
      )
    ).toThrow();
    expect(localStorage.getItem('career-tools-profile')).toBeNull();
    expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  });
});
