// Inlined into <head> before the stylesheet paints (see Base.astro), so the
// first frame already has the right theme. Dependency-free on purpose: it runs
// before any bundle. The palette itself lives only in src/styles/globals.css;
// this script just decides which theme attribute to set.
(() => {
  const KEY = 'career-tools-theme';
  const root = document.documentElement;

  const read = () => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === 'night' || stored === 'dawn') return stored;
    } catch {
      /* storage unavailable: fall through to the system preference */
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'dawn' : 'night';
  };

  const apply = (doc, theme) => {
    doc.documentElement.dataset.theme = theme;
    doc.documentElement.classList.add('js');
  };

  apply(document, read());

  // Earlier versions also stored the theme in a cookie. The site sets none now;
  // clear the leftover so returning visitors carry no cookie either.
  if (document.cookie.includes(KEY + '=')) {
    document.cookie = KEY + '=; max-age=0; path=/; SameSite=Lax';
  }

  // Astro's ClientRouter swaps in a server-rendered <html data-theme="night">
  // on every navigation; stamp the chosen theme on the incoming document first.
  document.addEventListener('astro:before-swap', (event) => {
    apply(event.newDocument, read());
  });
})();
