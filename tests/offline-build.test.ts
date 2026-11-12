// @vitest-environment node
import { expect, test } from 'vitest';
import { buildPrecache, nightColor, precachePath } from '../scripts/offline/build.mjs';
import { navigationKey, obsoleteShellCache, requestStrategy } from '../scripts/offline/routing.mjs';

test('precache selects every shell category, with canonical HTML URLs and no model files', () => {
  const paths = [
    'index.html',
    'career/index.html',
    '404.html',
    '_astro/page.hash.js',
    '_astro/style.hash.css',
    'fonts/readable.woff2',
    'data/pay/titles.json',
    'icons/maskable-512.png',
    'site.webmanifest',
    'models/index.html',
    'models/chunk.bin',
    'models/config.json',
    'sw.js',
    '_headers',
    'precache-report.json',
  ];
  expect(paths.map(precachePath)).toEqual([
    '/',
    '/career/',
    '/404.html',
    '/_astro/page.hash.js',
    '/_astro/style.hash.css',
    '/fonts/readable.woff2',
    '/data/pay/titles.json',
    '/icons/maskable-512.png',
    '/site.webmanifest',
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const report = buildPrecache(paths.map((path) => ({ path, bytes: Buffer.from('shell') })));
  expect(report.files).toBe(9);
  expect(report.bytes).toBe(45);
  expect(report.urls).toHaveLength(new Set(report.urls).size);
});

test('precache version is deterministic and binds file contents, paths, and worker behavior', () => {
  const files = ['index.html', '_astro/a.hash.js'].map((path) => ({
    path,
    bytes: Buffer.from(path),
  }));
  const initial = buildPrecache(files, 'worker');
  expect(buildPrecache([...files].reverse(), 'worker')).toEqual(initial);
  expect(
    buildPrecache([...files, { path: 'models/large.bin', bytes: Buffer.alloc(5) }], 'worker')
  ).toEqual(initial);
  expect(
    buildPrecache([{ path: 'index.html', bytes: Buffer.from('new') }, files[1]], 'worker').version
  ).not.toBe(initial.version);
  expect(
    buildPrecache([...files, { path: 'new/index.html', bytes: Buffer.from('new') }], 'worker')
      .version
  ).not.toBe(initial.version);
  expect(buildPrecache(files, 'changed worker').version).not.toBe(initial.version);
});

test('manifest uses the Night background token', async () => {
  expect(await nightColor()).toBe('#101312');
});

const origin = 'https://studio.example';
const request = (path: string, mode = 'cors', method = 'GET', range = false) =>
  requestStrategy({ url: new URL(path, origin).href, mode, method, range }, origin);

test('routing only handles full same-origin GET requests outside model ownership', () => {
  expect(request('/career/?id=123', 'navigate')).toBe('network-first');
  expect(request('/_astro/tool.hash.js')).toBe('cache-first');
  expect(request('/data/pay/titles.json')).toBe('stale-while-revalidate');
  expect(request('/fonts/readable.woff2')).toBe('stale-while-revalidate');
  for (const path of [
    '/models',
    '/models/manifest.json',
    '/models/chunk.bin',
    '/models/config.json?x=1',
    '/sw.js',
    'https://other.example/_astro/a.js',
  ]) {
    expect(request(path)).toBeNull();
    expect(request(path, 'navigate')).toBeNull();
  }
  expect(request('/career/', 'navigate', 'POST')).toBeNull();
  expect(request('/audio.wav', 'cors', 'GET', true)).toBeNull();
});

test.each(['id=abc', 'station=letter', 'tab=stories', 'application=abc'])(
  'offline navigation ignores %s',
  (query) => {
    expect(navigationKey(`${origin}/application/?${query}`)).toBe('/application/');
    expect(navigationKey(`${origin}/application?${query}`)).toBe('/application/');
    expect(navigationKey(`${origin}/application/index.html?${query}`)).toBe('/application/');
  }
);

test('activation deletes only obsolete shell caches, preserving every model and unrelated cache', () => {
  const current = 'career-studio-shell-new';
  expect(obsoleteShellCache('career-studio-shell-old', current)).toBe(true);
  for (const name of [current, 'models-whisper-old', 'models-kokoro-new', 'unrelated']) {
    expect(obsoleteShellCache(name, current)).toBe(false);
  }
});
