// @vitest-environment node
import { expect, test } from 'vitest';
import { effectiveHeaders, previewHeaders } from '../scripts/models/headers.mjs';

test.each(['/', '/interview-glow-up/workspace/', '/networking-practice/'])(
  'has one coherent effective policy for %s',
  (path) => {
    const headers = effectiveHeaders(path);
    const csp = headers['Content-Security-Policy'];
    expect(csp).not.toMatch(/,/);
    expect(headers['Permissions-Policy']).toBe(
      `camera=(), microphone=${path === '/' ? '()' : '(self)'}, geolocation=(), payment=()`
    );
    expect(csp).toContain("connect-src 'self'");
    expect(csp.includes("'wasm-unsafe-eval'")).toBe(path !== '/');
    expect(csp.includes("media-src 'self' blob:")).toBe(path !== '/');
    expect(csp.includes("worker-src 'self' blob:")).toBe(path !== '/');
    expect(csp).toContain("worker-src 'self'");
    expect(headers['Cross-Origin-Opener-Policy']).toBeUndefined();
    expect(headers['Cross-Origin-Embedder-Policy']).toBeUndefined();
  }
);
test('preview serves the worker CSP and keeps microphone denied globally', () => {
  expect(previewHeaders()['Content-Security-Policy']).toBe(
    effectiveHeaders('/interview-glow-up/workspace/')['Content-Security-Policy']
  );
  expect(previewHeaders()['Permissions-Policy']).toContain('microphone=()');
});

test('speech workers can compile WASM under their own response policy', () => {
  const headers = effectiveHeaders('/_astro/speech-worker-example.js');
  expect(headers['Content-Security-Policy']).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(headers['Content-Security-Policy']).not.toContain(',');
  expect(headers['Permissions-Policy']).toContain('microphone=()');
  expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
});

test('the install manifest and root worker have explicit types and revalidate', () => {
  const manifest = effectiveHeaders('/site.webmanifest');
  expect(manifest['Content-Type']).toBe('application/manifest+json; charset=utf-8');
  expect(manifest['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  const worker = effectiveHeaders('/sw.js');
  expect(worker['Content-Type']).toBe('application/javascript; charset=utf-8');
  expect(worker['Service-Worker-Allowed']).toBe('/');
  expect(worker['Cache-Control']).toBe('no-cache, max-age=0, must-revalidate');
  expect(worker['Content-Security-Policy']).toContain("connect-src 'self'");
  expect(worker['Content-Security-Policy']).not.toContain(',');
});
