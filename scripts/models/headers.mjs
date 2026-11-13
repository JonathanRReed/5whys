import { readFileSync } from 'node:fs';

/** Cloudflare applies matches in order. Detach removes an inherited value before replacing it. */
export function effectiveHeaders(
  pathname,
  source = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8')
) {
  /** @type {Record<string, string>} */
  const headers = {};
  let matches = false;
  for (const line of source.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      matches =
        line.startsWith('/') &&
        new RegExp(`^${line.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`).test(
          pathname
        );
      continue;
    }
    if (!matches) continue;
    const value = line.trim();
    if (value.startsWith('! ')) {
      delete headers[value.slice(2)];
      continue;
    }
    const at = value.indexOf(':');
    const key = value.slice(0, at);
    headers[key] = headers[key]
      ? `${headers[key]}, ${value.slice(at + 1).trim()}`
      : value.slice(at + 1).trim();
  }
  return headers;
}
/** Astro preview supports only global headers. Keep microphone denied; allow the local speech worker test. */
export function previewHeaders() {
  const headers = effectiveHeaders('/');
  headers['Content-Security-Policy'] = effectiveHeaders('/interview-glow-up/workspace/')[
    'Content-Security-Policy'
  ];
  headers['Cache-Control'] = 'no-store';
  return headers;
}
