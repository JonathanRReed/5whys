/* Routing functions and the content-versioned precache are inlined at build time. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const existed = names.includes(CACHE_NAME);
      const cache = await caches.open(CACHE_NAME);
      try {
        const previous = await Promise.all(
          names
            .filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
            .map((name) => caches.open(name))
        );
        for (let at = 0; at < PRECACHE.length; at += 16) {
          await Promise.all(
            PRECACHE.slice(at, at + 16).map(async (url) => {
              // HTML always checks the server. Assets with the same URL and
              // revision can be copied without a request, including older Vite caches.
              const html = url.endsWith('/') || url.endsWith('.html');
              if (!html) {
                for (const old of previous) {
                  const saved = await old.match(url, { ignoreVary: true });
                  if (
                    saved &&
                    (immutableAsset(url) ||
                      saved.headers.get('x-studio-revision') === REVISIONS[url])
                  ) {
                    await cache.put(url, saved);
                    return;
                  }
                }
              }
              const response = await fetch(new Request(url, { cache: 'no-cache' }));
              if (!response.ok || response.redirected) throw new Error(`Could not cache ${url}`);
              const headers = new Headers(response.headers);
              headers.set('x-studio-revision', REVISIONS[url]);
              await cache.put(
                url,
                new Response(response.body, { status: response.status, headers })
              );
            })
          );
        }
      } catch (error) {
        if (!existed) await caches.delete(CACHE_NAME);
        throw error;
      }
      // Updates wait here until a visitor explicitly asks to apply them.
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (!obsoleteShellCache(name, CACHE_NAME)) continue;
        // Keep previously used lazy features available after an update too.
        const old = await caches.open(name);
        const current = await caches.open(CACHE_NAME);
        for (const request of await old.keys()) {
          const path = new URL(request.url).pathname;
          if (
            requestStrategy(
              { url: request.url, method: 'GET', mode: 'cors' },
              self.location.origin
            ) === null ||
            path.endsWith('/') ||
            path.endsWith('.html') ||
            PRECACHE.includes(path)
          )
            continue;
          if (!(await current.match(request, { ignoreVary: true }))) {
            const saved = await old.match(request);
            if (saved) await current.put(request, saved);
          }
        }
        await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'CACHE_USED' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        for (const url of new Set(event.data.urls)) {
          if (
            typeof url !== 'string' ||
            !requestStrategy({ url, method: 'GET', mode: 'cors' }, self.location.origin)
          )
            continue;
          if (await cache.match(url, { ignoreVary: true })) continue;
          await fetchAndCache(new Request(url), cache).catch(() => {});
        }
      })()
    );
  }
});

async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && !response.redirected) {
    // A full disk must not prevent a successful online response from opening.
    await cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let strategy = requestStrategy(
    {
      url: request.url,
      method: request.method,
      mode: request.mode,
      range: request.headers.has('range'),
    },
    self.location.origin
  );
  if (!strategy) return;
  // The next install checks revisions for public shell assets too. Avoid
  // overwriting that metadata with a background refresh between deploys.
  if (strategy !== 'network-first' && PRECACHE.includes(new URL(request.url).pathname)) {
    strategy = 'cache-first';
  }

  if (strategy === 'network-first') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: 'no-cache' });
          if (response.status < 500) return response;
          const saved = await (await caches.open(CACHE_NAME)).match(navigationKey(request.url));
          return saved ?? response;
        } catch (error) {
          const saved = await (await caches.open(CACHE_NAME)).match(navigationKey(request.url));
          if (saved) return saved;
          throw error;
        }
      })()
    );
    return;
  }

  const cache = caches.open(CACHE_NAME);
  // Static shell bytes do not vary by Origin. Module requests add that header;
  // install-time fetches do not, and development previews send Vary: Origin.
  const matchOptions = { ignoreVary: true };
  if (strategy === 'cache-first') {
    event.respondWith(
      cache.then(
        async (store) => (await store.match(request, matchOptions)) ?? fetchAndCache(request, store)
      )
    );
    return;
  }

  // Extend the event synchronously so the background refresh can finish after responding.
  const refresh = cache.then((store) => fetchAndCache(request, store));
  event.waitUntil(refresh.catch(() => {}));
  event.respondWith(
    cache.then(async (store) => (await store.match(request, matchOptions)) ?? refresh)
  );
});
