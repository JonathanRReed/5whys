/* global document, window, Element, CustomEvent, requestAnimationFrame */
/* eslint-disable no-empty */
(function () {
  const STORAGE_KEY = 'career-tools-theme';
  const root = document.documentElement;
  const THEMES = new Set(['night', 'dawn']);

  // Keep these values in sync with src/styles/globals.css (Evergreen & Brass).
  const PALETTES = {
    night: {
      '--background': '150 9% 7%',
      '--foreground': '75 11% 91%',
      '--card': '152 8% 10%',
      '--card-foreground': '75 11% 91%',
      '--overlay': '150 7% 14%',
      '--popover': '152 8% 11%',
      '--popover-foreground': '75 11% 91%',
      '--primary': '150 44% 42%',
      '--primary-foreground': '150 40% 7%',
      '--secondary': '150 7% 17%',
      '--secondary-foreground': '75 11% 91%',
      '--muted': '145 6% 44%',
      '--muted-foreground': '100 8% 72%',
      '--accent': '40 54% 56%',
      '--accent-foreground': '40 45% 9%',
      '--destructive': '6 58% 56%',
      '--destructive-foreground': '60 12% 96%',
      '--love': '14 56% 57%',
      '--gold': '40 56% 57%',
      '--rose': '14 44% 67%',
      '--pine': '150 42% 34%',
      '--foam': '150 48% 45%',
      '--iris': '286 24% 65%',
      '--border': '150 7% 22%',
      '--input': '150 7% 22%',
      '--ring': '150 48% 45%',
      '--logo-stop-1': 'color-mix(in srgb, #3f9f78 54%, transparent)',
      '--logo-stop-2': 'color-mix(in srgb, #cda24c 48%, transparent)',
      '--logo-stop-3': 'color-mix(in srgb, #1a201b 60%, transparent)',
      '--logo-base-fill': 'color-mix(in srgb, hsl(var(--overlay)) 70%, hsl(var(--background)) 30%)',
      '--logo-border-color': 'hsla(150, 14%, 40%, 0.42)',
      '--logo-shadow-color': 'rgba(8, 14, 10, 0.55)',
      '--logo-icon-shadow': 'rgba(14, 22, 16, 0.42)',
    },
    dawn: {
      '--background': '48 30% 95%',
      '--foreground': '150 14% 15%',
      '--card': '50 40% 98%',
      '--card-foreground': '150 14% 15%',
      '--overlay': '48 24% 90%',
      '--popover': '50 40% 98%',
      '--popover-foreground': '150 14% 15%',
      '--primary': '150 50% 26%',
      '--primary-foreground': '50 40% 97%',
      '--secondary': '48 22% 91%',
      '--secondary-foreground': '150 14% 15%',
      '--muted': '45 10% 56%',
      '--muted-foreground': '150 10% 33%',
      '--accent': '36 64% 36%',
      '--accent-foreground': '50 40% 97%',
      '--destructive': '4 60% 43%',
      '--destructive-foreground': '50 40% 97%',
      '--love': '14 56% 41%',
      '--gold': '36 66% 38%',
      '--rose': '14 44% 52%',
      '--pine': '150 46% 22%',
      '--foam': '150 50% 26%',
      '--iris': '286 30% 42%',
      '--border': '48 20% 80%',
      '--input': '48 20% 80%',
      '--ring': '150 50% 26%',
      '--logo-stop-1': 'color-mix(in srgb, #2c7a57 40%, transparent)',
      '--logo-stop-2': 'color-mix(in srgb, #9a7b27 30%, transparent)',
      '--logo-stop-3': 'color-mix(in srgb, #fbfaf3 65%, transparent)',
      '--logo-base-fill': 'color-mix(in srgb, hsl(var(--card)) 88%, hsl(var(--overlay)) 12%)',
      '--logo-border-color': 'hsla(150, 20%, 60%, 0.5)',
      '--logo-shadow-color': 'rgba(60, 70, 52, 0.14)',
      '--logo-icon-shadow': 'rgba(60, 70, 52, 0.18)',
    },
  };

  const apply = (theme) => {
    if (!THEMES.has(theme)) return;
    root.dataset.theme = theme;
    root.classList.toggle('theme-dawn', theme === 'dawn');
    root.classList.toggle('theme-night', theme === 'night');
    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.classList.toggle('theme-dawn', theme === 'dawn');
      document.body.classList.toggle('theme-night', theme === 'night');
    }
    Object.entries(PALETTES[theme]).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
    try {
      const scheme = theme === 'dawn' ? 'only light' : 'dark';
      root.style.colorScheme = scheme;
      if (document.body) document.body.style.colorScheme = scheme;
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute('content', scheme);
    } catch {}
    try {
      document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
        const active = el.getAttribute('data-theme-toggle') === theme;
        el.setAttribute('aria-pressed', String(active));
        el.setAttribute('data-active', String(active));
      });
    } catch {}
  };

  window.__careerToolsSetTheme = (theme) => {
    if (!THEMES.has(theme)) return;
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
    try {
      const secure = window.location.protocol === 'https:' ? ';Secure' : '';
      document.cookie = `${STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax${secure}`;
    } catch {}
  };

  document.addEventListener(
    'click',
    (event) => {
      const toggle =
        event.target instanceof Element ? event.target.closest('[data-theme-toggle]') : null;
      if (toggle) window.__careerToolsSetTheme(toggle.getAttribute('data-theme-toggle'));
    },
    true
  );

  window.addEventListener('career-tools-theme-change', (event) => {
    const theme = event instanceof CustomEvent ? event.detail?.theme : null;
    if (THEMES.has(theme)) window.__careerToolsSetTheme(theme);
  });

  const resolveTheme = () => {
    try {
      const match = document.cookie.match(new RegExp('(^|; )' + STORAGE_KEY + '=([^;]*)'));
      const cookieTheme = match?.[2];
      if (cookieTheme === 'night' || cookieTheme === 'dawn') return cookieTheme;
    } catch {}
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'night' || stored === 'dawn') return stored;
    } catch {}
    const datasetTheme = root.dataset.theme;
    if (datasetTheme === 'night' || datasetTheme === 'dawn') return datasetTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'night'
      : 'dawn';
  };

  const run = () => {
    let style;
    try {
      style = document.createElement('style');
      style.id = 'theme-transitions-off';
      style.textContent = '*{transition: none !important}';
      document.head.appendChild(style);
    } catch {}
    apply(resolveTheme());
    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (style && style.parentNode) style.parentNode.removeChild(style);
        });
      });
    } catch {}
  };

  try {
    run();
  } catch {}
  document.addEventListener('astro:before-swap', run);
  document.addEventListener('astro:after-swap', run);
  document.addEventListener('astro:page-load', run);
})();
