if ('serviceWorker' in navigator) {
  // Hydration can load a lazy feature before the first worker takes control.
  // Carry those already used resources into runtime caching as well.
  const cacheUsed = () => {
    const urls = performance.getEntriesByType('resource').map((entry) => entry.name);
    navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_USED', urls });
  };
  navigator.serviceWorker.addEventListener('controllerchange', cacheUsed);
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => {
        window.dispatchEvent(new Event('career-studio:offline-change'));
        if (navigator.serviceWorker.controller) cacheUsed();
      })
      .catch(() => {});
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
