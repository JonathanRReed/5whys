/** Only the shell worker owns these caches. Model caches belong to src/lib/models. */
export const SHELL_CACHE_PREFIX = 'career-studio-shell-';

export function obsoleteShellCache(name, current) {
  return name.startsWith(SHELL_CACHE_PREFIX) && name !== current;
}

/** Return null to leave the request entirely to the browser. */
export function requestStrategy({ url, method, mode, range = false }, origin) {
  const target = new URL(url);
  if (
    method !== 'GET' ||
    range ||
    target.origin !== origin ||
    target.pathname === '/models' ||
    target.pathname.startsWith('/models/') ||
    target.pathname === '/sw.js'
  )
    return null;
  if (mode === 'navigate') return 'network-first';
  if (target.pathname.startsWith('/_astro/')) return 'cache-first';
  return 'stale-while-revalidate';
}

/** Query parameters select tool state, not a different HTML shell. */
export function navigationKey(url) {
  let path = new URL(url).pathname.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/') && !path.split('/').pop().includes('.')) path += '/';
  return path;
}
