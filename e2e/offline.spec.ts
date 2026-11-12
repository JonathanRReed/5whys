import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { useStudentProfile, waitForHydration } from './helpers';

declare global {
  interface Window {
    offlineApi: typeof import('../src/lib/offline');
  }
}

const report = JSON.parse(
  readFileSync(new URL('../dist/precache-report.json', import.meta.url), 'utf8')
);

test('the installed shell opens tools and saved work offline, including query routes', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  await useStudentProfile(page);
  await page.goto('/robots.txt');
  await page.evaluate(async () => {
    // Activation must leave downloaded models and other libraries' caches intact.
    await (await caches.open('models-offline-test')).put(
      '/models/owned.bin',
      new Response('model')
    );
    await caches.open('career-studio-shell-obsolete');
    await caches.open('unrelated-library');
  });
  await page.goto('/career/');
  await waitForHydration(page);
  await page.locator('#career-topic').fill('I want to work in biology');
  await page.locator('textarea').first().fill('I enjoy explaining how living things work.');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain('models-offline-test');
  expect(keys).toContain('unrelated-library');
  expect(keys).not.toContain('career-studio-shell-obsolete');

  // Verify the real installed cache, not just network/HTTP-cache hits.
  const cached = await page.evaluate(async (version) => {
    const cache = await caches.open(`career-studio-shell-${version}`);
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  }, report.version);
  expect(cached).toEqual([...report.urls].sort());
  expect(cached.some((url) => url.startsWith('/models/'))).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await waitForHydration(page);
  await expect(page.locator('#career-topic')).toHaveValue('I want to work in biology');
  await expect(page.locator('textarea').first()).toHaveValue(
    'I enjoy explaining how living things work.'
  );

  // These pages have never been visited in this context. All state-selecting queries work.
  for (const path of [
    '/career/?id=offline',
    '/application/?id=offline&station=letter',
    '/interview-glow-up/workspace/?tab=stories',
    '/resume-game/?application=offline',
    '/dashboard/',
  ]) {
    const response = await page.goto(path);
    expect(response?.fromServiceWorker()).toBe(true);
    await waitForHydration(page);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
  expect(requests.filter((url) => new URL(url).pathname.startsWith('/models/'))).toEqual([]);
  expect(
    await page.evaluate(async () =>
      (await (await caches.open('models-offline-test')).match('/models/owned.bin'))?.text()
    )
  ).toBe('model');
});

test('the manifest and generated icons describe a standalone install', async ({ page }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/site.webmanifest')).json();
  expect(manifest).toMatchObject({
    name: '5 Whys Career Studio',
    short_name: '5 Whys',
    start_url: '/dashboard/',
    display: 'standalone',
    theme_color: '#101312',
    background_color: '#101312',
    scope: '/',
  });
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
    true
  );
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    manifest.theme_color
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes'
  );
});

test('an update waits until applyUpdate is called, then reloads with the saved draft', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Exercise the library before the lead mounts its interface. No test hook ships to visitors.
  const source = readFileSync(new URL('../src/lib/offline.ts', import.meta.url), 'utf8');
  const compiled = transpileModule(source, {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  }).outputText;
  await page.addScriptTag({
    type: 'module',
    content: `${compiled}\nwindow.offlineApi = { offlineStatus, subscribe, applyUpdate };`,
  });
  await page.waitForFunction(() => window.offlineApi?.offlineStatus() === 'ready');
  await page.evaluate(() =>
    window.offlineApi.subscribe((status) => {
      document.documentElement.dataset.offlineStatus = status;
    })
  );
  await page.locator('#career-topic').fill('Keep this draft through an update');
  // A distinct main-script URL creates a real waiting worker without changing the shared dist.
  await page.evaluate(() =>
    navigator.serviceWorker
      .register('/sw.js?update-test=1', { scope: '/', updateViaCache: 'none' })
      .then(() => {})
  );
  // The new worker precaches the whole shell before it waits; with the suite
  // running in parallel that takes longer than the default five seconds.
  await expect(page.locator('html')).toHaveAttribute('data-offline-status', 'update-waiting', {
    timeout: 45_000,
  });
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).not.toContain(
    'update-test'
  );
  await expect(page.locator('#career-topic')).toHaveValue('Keep this draft through an update');
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => window.offlineApi.applyUpdate());
  await reloaded;
  await waitForHydration(page);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain(
    'update-test=1'
  );
  await expect(page.locator('#career-topic')).toHaveValue('Keep this draft through an update');
});
