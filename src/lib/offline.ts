export type OfflineStatus = 'unsupported' | 'not-installed' | 'ready' | 'update-waiting';

let registration: ServiceWorkerRegistration | undefined;
let watching = false;
let status: OfflineStatus = 'not-installed';
const subscribers = new Set<(status: OfflineStatus) => void>();
const observed = new WeakSet<ServiceWorkerRegistration>();

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function refresh() {
  const next = registration?.waiting
    ? 'update-waiting'
    : registration?.active?.state === 'activated'
      ? 'ready'
      : 'not-installed';
  if (status === next) return;
  status = next;
  for (const subscriber of subscribers) subscriber(status);
}

async function observeRegistration() {
  const found = await navigator.serviceWorker.getRegistration('/');
  if (!found || new URL(found.scope).pathname !== '/') return;
  registration = found;
  if (!observed.has(found)) {
    observed.add(found);
    const observeInstalling = () => found.installing?.addEventListener('statechange', refresh);
    found.addEventListener('updatefound', observeInstalling);
    found.active?.addEventListener('statechange', refresh);
    observeInstalling();
  }
  refresh();
}

function watch() {
  if (watching || !supported()) return;
  watching = true;
  const observe = () => void observeRegistration().catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', observe);
  window.addEventListener('career-studio:offline-change', observe);
  observe();
}

/** Synchronous snapshot. Subscription discovers an existing registration asynchronously. */
export function offlineStatus(): OfflineStatus {
  if (!supported()) return 'unsupported';
  watch();
  return status;
}

/** Calls back immediately and whenever the installation or waiting-update state changes. */
export function subscribe(listener: (status: OfflineStatus) => void): () => void {
  subscribers.add(listener);
  listener(offlineStatus());
  return () => subscribers.delete(listener);
}

/** Only the page whose visitor requests this update reloads. Other tabs keep their drafts. */
export async function applyUpdate(): Promise<void> {
  if (!supported()) return;
  await observeRegistration();
  const waiting = registration?.waiting;
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage({ type: 'APPLY_UPDATE' });
}
