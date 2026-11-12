// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

const routing = readFileSync(
  new URL('../scripts/offline/routing.mjs', import.meta.url),
  'utf8'
).replaceAll('export ', '');
const worker = readFileSync(new URL('../scripts/offline/worker.js', import.meta.url), 'utf8');
const origin = 'https://studio.example';

function harness(urls: string[], revisions: Record<string, string>) {
  const stores = new Map<string, Map<string, Response>>();
  const opened: string[] = [];
  const path = (request: string | Request) =>
    typeof request === 'string' ? new URL(request, origin).pathname : new URL(request.url).pathname;
  const cache = (name: string) => {
    let entries = stores.get(name);
    if (!entries) {
      entries = new Map();
      stores.set(name, entries);
    }
    const saved = entries;
    return {
      match: async (request: string | Request) => saved.get(path(request))?.clone(),
      put: async (request: string | Request, response: Response) => {
        saved.set(path(request), response.clone());
      },
      keys: async () => [...saved.keys()].map((key) => new Request(new URL(key, origin))),
    };
  };
  const listeners = new Map<
    string,
    (event: { waitUntil: (task: Promise<unknown>) => void }) => void
  >();
  const fetch = vi.fn(async (request: Request) => new Response(`fresh ${path(request)}`));
  const caches = {
    keys: async () => [...stores.keys()],
    open: async (name: string) => {
      opened.push(name);
      return cache(name);
    },
    delete: async (name: string) => stores.delete(name),
  };
  class WorkerRequest extends Request {
    constructor(url: string, options?: RequestInit) {
      super(new URL(url, origin), options);
    }
  }
  runInNewContext(`${routing}\n${worker}`, {
    CACHE_NAME: 'career-studio-shell-new',
    PRECACHE: urls,
    REVISIONS: revisions,
    self: {
      addEventListener: (
        name: string,
        listener: typeof listeners extends Map<string, infer T> ? T : never
      ) => listeners.set(name, listener),
      location: { origin },
      clients: { claim: async () => {} },
    },
    caches,
    fetch,
    Request: WorkerRequest,
    Response,
    Headers,
    URL,
  });
  const fire = async (name: string) => {
    let task: Promise<unknown> | undefined;
    listeners.get(name)?.({
      waitUntil: (value) => {
        task = value;
      },
    });
    await task;
  };
  return { cache, stores, fetch, fire, opened };
}

test('a new version reuses immutable URLs and matching revisions, but refreshes HTML and changed assets', async () => {
  const urls = [
    '/',
    '/_astro/core.12345678.js',
    '/_astro/new.87654321.js',
    '/favicon.ico',
    '/site.webmanifest',
  ];
  const h = harness(urls, {
    '/': 'same-html',
    '/favicon.ico': 'same-icon',
    '/site.webmanifest': 'new-manifest',
  });
  await h
    .cache('career-studio-shell-old')
    .put('/', new Response('old HTML', { headers: { 'x-studio-revision': 'same-html' } }));
  await h
    .cache('career-studio-shell-old')
    .put('/_astro/core.12345678.js', new Response('unchanged'));
  await h
    .cache('career-studio-shell-old')
    .put('/favicon.ico', new Response('icon', { headers: { 'x-studio-revision': 'same-icon' } }));
  await h
    .cache('career-studio-shell-old')
    .put(
      '/site.webmanifest',
      new Response('old', { headers: { 'x-studio-revision': 'old-manifest' } })
    );
  await h
    .cache('career-studio-shell-old')
    .put('/data/pay/titles.json', new Response('used titles'));
  await h
    .cache('career-studio-shell-old')
    .put('/_astro/lazy.abcdefgh.js', new Response('used feature'));
  await h.cache('models-owned').put('/models/weights.bin', new Response('private model'));
  await h.fire('install');
  expect(h.fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual([
    '/',
    '/_astro/new.87654321.js',
    '/site.webmanifest',
  ]);
  expect(h.fetch.mock.calls.every(([request]) => request.cache === 'no-cache')).toBe(true);
  expect(
    await (await h.cache('career-studio-shell-new').match('/_astro/core.12345678.js'))?.text()
  ).toBe('unchanged');
  await h.fire('activate');
  expect(
    await (await h.cache('career-studio-shell-new').match('/_astro/lazy.abcdefgh.js'))?.text()
  ).toBe('used feature');
  expect(
    await (await h.cache('career-studio-shell-new').match('/data/pay/titles.json'))?.text()
  ).toBe('used titles');
  expect(h.stores.has('career-studio-shell-old')).toBe(false);
  expect(h.stores.has('models-owned')).toBe(true);
  expect(h.opened.some((name) => name.startsWith('models-'))).toBe(false);
});
