// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseManifest, sha256 } from '../src/lib/models/manifest';

const origin = 'https://studio.test';
class MemoryCaches {
  stores = new Map<string, Map<string, Response>>();
  async keys() {
    return [...this.stores.keys()];
  }
  async has(name: string) {
    return this.stores.has(name);
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const store = this.stores.get(name);
    if (!store) throw new Error('Missing test cache.');
    return {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, value: Response) => {
        store.set(key, value.clone());
      },
      keys: async () => [...store.keys()].map((key) => new Request(key)),
    };
  }
}
async function fixture() {
  const a = new TextEncoder().encode('hello '),
    b = new TextEncoder().encode('model');
  const all = new TextEncoder().encode('hello model');
  const file = {
    bytes: all.length,
    sha256: await sha256(all),
    parts: await Promise.all(
      [a, b].map(async (v, i) => ({
        path: `file.part-${i}`,
        bytes: v.length,
        sha256: await sha256(v),
      }))
    ),
  };
  return {
    a,
    b,
    file,
    manifest: {
      version: 1,
      models: { 'whisper-tiny-en': ['file'], kokoro: ['file'] },
      files: { file },
    },
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubGlobal('location', { origin });
  vi.stubGlobal('window', {
    isSecureContext: true,
    innerWidth: 1280,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal('navigator', { userAgent: 'Desktop', platform: 'MacIntel', maxTouchPoints: 0 });
  vi.stubGlobal('caches', new MemoryCaches());
  for (const name of ['Worker', 'AudioContext', 'OfflineAudioContext'])
    vi.stubGlobal(name, class {});
});
describe('hosted manifest and download contracts', () => {
  test('does one small request and fails closed on missing or malformed manifests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const api = await import('../src/lib/models');
    expect(await api.hostedModelsAvailable()).toBe(false);
    expect(await api.hostedModelCatalogue()).toEqual([]);
    expect(await api.getModelState('kokoro')).toBe('not-hosted');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/models/manifest.json');
  });
  test('validates paths, sizes, hashes, chunk sums and complete model membership', async () => {
    const { manifest } = await fixture();
    expect(parseManifest(manifest)).toEqual(manifest);
    for (const changed of [
      null,
      { ...manifest, version: 2 },
      { ...manifest, models: {} },
      { ...manifest, files: { '../bad': manifest.files.file } },
      { ...manifest, files: { file: { ...manifest.files.file, bytes: 1 } } },
      { ...manifest, files: { file: { ...manifest.files.file, sha256: 'bad' } } },
    ])
      expect(() => parseManifest(changed)).toThrow();
  });
  test('downloads, verifies, assembles, reports bytes, reads cache-only and deletes', async () => {
    const { a, b, manifest } = await fixture();
    const fetch = vi.fn(
      async (url: string) =>
        new Response(
          url.endsWith('manifest.json') ? JSON.stringify(manifest) : url.endsWith('0') ? a : b
        )
    );
    vi.stubGlobal('fetch', fetch);
    const api = await import('../src/lib/models');
    expect(await api.getModelState('whisper-tiny-en')).toBe('not-downloaded');
    expect((await api.hostedModelCatalogue())[0].downloadBytes).toBe(11);
    const progress = vi.fn();
    await api.downloadModel('whisper-tiny-en', { onProgress: progress });
    expect(await api.getModelState('whisper-tiny-en')).toBe('ready');
    expect(progress).toHaveBeenLastCalledWith({ loaded: 11, total: 11 });
    const reader = await api.createModelFetch('whisper-tiny-en');
    expect(await (await reader(`${origin}/models/file`)).text()).toBe('hello model');
    expect(fetch).toHaveBeenCalledTimes(3);
    await expect(reader('https://elsewhere.test/models/file')).rejects.toMatchObject({
      reason: 'not-ready',
    });
    await expect(reader(`${origin}/models/unknown`)).rejects.toMatchObject({ reason: 'not-ready' });
    await api.deleteModel('whisper-tiny-en');
    expect(await api.getModelState('whisper-tiny-en')).toBe('not-downloaded');
    expect((await caches.keys()).every((name) => name.startsWith('models-'))).toBe(true);
  });
  test.each(['hash', 'short', 'long', 'assembled'])(
    'rejects a %s chunk and leaves no partial cache',
    async (failure) => {
      const { a, b, manifest } = await fixture();
      if (failure === 'assembled')
        manifest.files.file.sha256 = await sha256(new TextEncoder().encode('wrong'));
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async (url: string) =>
            new Response(
              url.endsWith('manifest.json')
                ? JSON.stringify(manifest)
                : url.endsWith('0')
                  ? a
                  : failure === 'hash'
                    ? new TextEncoder().encode('wrong')
                    : failure === 'short'
                      ? b.slice(0, 2)
                      : failure === 'assembled'
                        ? b
                        : new Uint8Array(100)
            )
        )
      );
      const api = await import('../src/lib/models');
      await expect(api.downloadModel('kokoro')).rejects.toMatchObject({ reason: 'integrity' });
      expect(await api.getModelState('kokoro')).toBe('not-downloaded');
      expect(await caches.keys()).toEqual([]);
    }
  );
  test('exposes downloading, rejects concurrent downloads and aborts cleanly', async () => {
    const { manifest } = await fixture();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
        await waiting;
        return new Response('hello ');
      })
    );
    const api = await import('../src/lib/models');
    const controller = new AbortController();
    const done = api.downloadModel('kokoro', { signal: controller.signal });
    await vi.waitFor(async () => expect(await api.getModelState('kokoro')).toBe('downloading'));
    await expect(api.downloadModel('kokoro')).rejects.toMatchObject({ reason: 'busy' });
    controller.abort();
    release();
    await expect(done).rejects.toMatchObject({ reason: 'aborted' });
    expect(await api.getModelState('kokoro')).toBe('not-downloaded');
  });
  test('external storage deletion is observed by readiness and the fetch hook', async () => {
    const { a, b, manifest } = await fixture();
    vi.stubGlobal(
      'fetch',
      async (url: string) =>
        new Response(
          url.endsWith('manifest.json') ? JSON.stringify(manifest) : url.endsWith('0') ? a : b
        )
    );
    const api = await import('../src/lib/models');
    await api.downloadModel('kokoro');
    for (const name of await caches.keys()) await caches.delete(name);
    expect(await api.getModelState('kokoro')).toBe('not-downloaded');
    await expect(api.createModelFetch('kokoro')).rejects.toMatchObject({ reason: 'not-ready' });
  });
});
test('desktop gate rejects mobile data, user agents, iPads, coarse small viewports and missing APIs', async () => {
  const { hostedModelsSupported } = await import('../src/lib/models/device');
  expect(hostedModelsSupported()).toEqual({ supported: true, reason: null });
  for (const nav of [
    { userAgentData: { mobile: true } },
    { userAgent: 'iPad' },
    { platform: 'MacIntel', maxTouchPoints: 5 },
  ]) {
    vi.stubGlobal('navigator', nav);
    expect(hostedModelsSupported()).toEqual({ supported: false, reason: 'desktop-only' });
  }
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('window', {
    innerWidth: 820,
    innerHeight: 1180,
    matchMedia: () => ({ matches: true }),
  });
  expect(hostedModelsSupported().supported).toBe(false);
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('Worker', undefined);
  expect(hostedModelsSupported()).toEqual({ supported: false, reason: 'missing-apis' });
});
