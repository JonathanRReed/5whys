/* Routing functions and the content-versioned precache are inlined at build time. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // Bound concurrent downloads, including the larger optional speech libraries.
        for (let at = 0; at < PRECACHE.length; at += 16) {
          await cache.addAll(
            PRECACHE.slice(at, at + 16).map((url) => new Request(url, { cache: 'reload' }))
          );
        }
      } catch (error) {
        await caches.delete(CACHE_NAME);
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
        if (obsoleteShellCache(name, CACHE_NAME)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
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
  const strategy = requestStrategy(
    {
      url: request.url,
      method: request.method,
      mode: request.mode,
      range: request.headers.has('range'),
    },
    self.location.origin
  );
  if (!strategy) return;

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
  const matchOptions = { ignoreVary: PRECACHE.includes(new URL(request.url).pathname) };
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
