// @vitest-environment node
import { expect, test } from 'vitest';
import { buildPrecache, nightColor, precachePath } from '../scripts/offline/build.mjs';
import { navigationKey, obsoleteShellCache, requestStrategy } from '../scripts/offline/routing.mjs';

test('precache follows HTML, static imports, default Latin fonts and install icons only', () => {
  const sources: Record<string, string> = {
    'index.html': `<script type="module" src="/_astro/entry.hash1234.js"></script><link rel="stylesheet" href="/_astro/style.hash1234.css"><astro-island component-url="/_astro/island.hash1234.js" renderer-url="/_astro/react.hash1234.js"></astro-island><link rel="icon" href="/favicon.ico">`,
    'career/index.html': '<script type="module">import "../_astro/inline.hash1234.js";</script>',
    '404.html': 'not found',
    '_astro/entry.hash1234.js': `import './shared.hash1234.js'; export { a } from './export.hash1234.js'; const heavy = () => import('./pdf.hash1234.js'); const deps = ['/_astro/kokoro.hash1234.js'];`,
    '_astro/shared.hash1234.js': `import './entry.hash1234.js';`,
    '_astro/island.hash1234.js': '',
    '_astro/react.hash1234.js': '',
    '_astro/inline.hash1234.js': '',
    '_astro/export.hash1234.js': '',
    '_astro/style.hash1234.css': `@font-face{font-family:"Inter Variable";src:url(/_astro/inter-latin-wght-normal.hash1234.woff2)}@font-face{font-family:"Inter Variable";src:url(/_astro/inter-latin-ext-wght-normal.hash1234.woff2)}@font-face{font-family:OpenDyslexic;src:url(/fonts/dyslexic.woff2)}`,
    '_astro/inter-latin-wght-normal.hash1234.woff2': 'default font',
    '_astro/inter-latin-ext-wght-normal.hash1234.woff2': 'extra font',
    '_astro/pdf.hash1234.js': 'pdf',
    '_astro/kokoro.hash1234.js': 'speech',
    'fonts/dyslexic.woff2': 'optional font',
    'data/pay/titles.json': 'large titles',
    'og/career.png': 'share image',
    'favicon.ico': 'icon',
    'icons/maskable-512.png': 'install icon',
    'site.webmanifest': JSON.stringify({ icons: [{ src: '/icons/maskable-512.png' }] }),
    'models/index.html': 'model',
    'models/chunk.bin': 'model bytes',
    'sw.js': 'worker',
    _headers: 'headers',
  };
  const report = buildPrecache(
    Object.entries(sources).map(([path, source]) => ({ path, bytes: Buffer.from(source) }))
  );
  expect(report.urls).toEqual([
    '/',
    '/_astro/entry.hash1234.js',
    '/_astro/export.hash1234.js',
    '/_astro/inline.hash1234.js',
    '/_astro/inter-latin-wght-normal.hash1234.woff2',
    '/_astro/island.hash1234.js',
    '/_astro/react.hash1234.js',
    '/_astro/shared.hash1234.js',
    '/_astro/style.hash1234.css',
    '/404.html',
    '/career/',
    '/favicon.ico',
    '/icons/maskable-512.png',
    '/site.webmanifest',
  ]);
  expect(report.files).toBe(report.urls.length);
  expect(report.gzipBytes).toBeGreaterThan(0);
  expect(Object.values(report.revisions).every((hash) => /^[a-f0-9]{64}$/.test(String(hash)))).toBe(
    true
  );
  expect(precachePath('models/index.html')).toBeNull();
});

test('precache version is deterministic and binds file contents, paths, and worker behavior', () => {
  const files = ['index.html', '_astro/a.hash1234.js'].map((path) => ({
    path,
    bytes: Buffer.from(
      path.endsWith('.html') ? '<script src="/_astro/a.hash1234.js"></script>' : path
    ),
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
  expect(request('/_astro/tool.hash1234.js')).toBe('cache-first');
  expect(request('/_astro/unhashed.js')).toBe('stale-while-revalidate');
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
