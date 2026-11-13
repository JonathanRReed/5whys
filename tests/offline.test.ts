import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function browser({ active = false, waiting = false } = {}) {
  const serviceWorker = new EventTarget();
  const worker = Object.assign(new EventTarget(), {
    state: 'activated',
    postMessage: vi.fn(),
  });
  const installing = Object.assign(new EventTarget(), { state: 'installing' });
  const registration = Object.assign(new EventTarget(), {
    scope: 'https://studio.example/',
    active: active ? worker : null,
    installing,
    waiting: waiting ? worker : null,
  });
  const getRegistration = vi.fn().mockResolvedValue(registration);
  Object.assign(serviceWorker, { getRegistration });
  vi.stubGlobal('navigator', { serviceWorker });
  const reload = vi.fn();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { reload } }));
  return { serviceWorker, registration, worker, reload, getRegistration };
}

test('unsupported browsers have a stable status and applying an update does nothing', async () => {
  vi.stubGlobal('navigator', {});
  const offline = await import('../src/lib/offline');
  expect(offline.offlineStatus()).toBe('unsupported');
  const listener = vi.fn();
  offline.subscribe(listener)();
  expect(listener).toHaveBeenCalledExactlyOnceWith('unsupported');
  await offline.applyUpdate();
});

test('subscription reports installation and a waiting update without activation or reload', async () => {
  const { registration, worker, reload } = browser();
  const offline = await import('../src/lib/offline');
  const listener = vi.fn();
  const unsubscribe = offline.subscribe(listener);
  await new Promise((resolve) => setTimeout(resolve, 0));
  registration.active = worker;
  registration.installing.dispatchEvent(new Event('statechange'));
  expect(offline.offlineStatus()).toBe('ready');
  registration.waiting = worker;
  registration.installing.dispatchEvent(new Event('statechange'));
  expect(offline.offlineStatus()).toBe('update-waiting');
  expect(listener.mock.calls.map(([status]) => status)).toEqual([
    'not-installed',
    'ready',
    'update-waiting',
  ]);
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  unsubscribe();
  registration.waiting = null;
  registration.installing.dispatchEvent(new Event('statechange'));
  expect(listener).toHaveBeenCalledTimes(3);
});

test('a late registration is discovered after the inline bootstrap finishes', async () => {
  const { getRegistration, registration } = browser({ active: true });
  getRegistration.mockResolvedValueOnce(undefined);
  const offline = await import('../src/lib/offline');
  offline.offlineStatus();
  await vi.waitFor(() => expect(getRegistration).toHaveBeenCalledTimes(1));
  expect(offline.offlineStatus()).toBe('not-installed');
  getRegistration.mockResolvedValue(registration);
  window.dispatchEvent(new Event('career-studio:offline-change'));
  await vi.waitFor(() => expect(offline.offlineStatus()).toBe('ready'));
});

test('applyUpdate activates only on request and reloads once after controllerchange', async () => {
  const { serviceWorker, worker, reload } = browser({ active: true, waiting: true });
  const offline = await import('../src/lib/offline');
  await offline.applyUpdate();
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'APPLY_UPDATE' });
  expect(reload).not.toHaveBeenCalled();
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('a controller change in another tab does not cause an automatic reload', async () => {
  const { serviceWorker, reload, worker } = browser({ active: true });
  const offline = await import('../src/lib/offline');
  offline.offlineStatus();
  await offline.applyUpdate();
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});
