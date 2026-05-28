/* global document, window, Element, CustomEvent, requestAnimationFrame */
/* eslint-disable no-empty */

const storageKey = 'career-tools-theme';
const root = document.documentElement;
const validThemes = new Set(['night', 'dawn']);
const themeTokens = {
  night: {
    '--background': '228 19% 7%',
    '--foreground': '220 24% 94%',
    '--card': '226 18% 11%',
    '--card-foreground': '220 24% 94%',
    '--overlay': '226 16% 15%',
    '--popover': '226 18% 12%',
    '--popover-foreground': '220 24% 94%',
    '--primary': '186 62% 54%',
    '--primary-foreground': '228 19% 7%',
    '--secondary': '226 14% 18%',
    '--secondary-foreground': '220 24% 94%',
    '--muted': '224 10% 42%',
    '--muted-foreground': '222 14% 78%',
    '--accent': '35 78% 62%',
    '--accent-foreground': '228 19% 7%',
    '--destructive': '350 62% 62%',
    '--destructive-foreground': '228 19% 7%',
    '--love': '350 62% 61%',
    '--gold': '35 78% 62%',
    '--rose': '350 48% 73%',
    '--pine': '172 42% 36%',
    '--foam': '186 62% 54%',
    '--iris': '255 32% 70%',
    '--border': '225 15% 27%',
    '--input': '225 15% 27%',
    '--ring': '186 62% 54%',
    '--logo-stop-1': 'color-mix(in srgb, #31748f 52%, transparent)',
    '--logo-stop-2': 'color-mix(in srgb, #eb6f92 46%, transparent)',
    '--logo-stop-3': 'color-mix(in srgb, #26233a 60%, transparent)',
    '--logo-base-fill':
      'color-mix(in srgb, hsl(var(--overlay)) 70%, hsl(var(--background)) 30%)',
    '--logo-border-color': 'hsla(248, 32%, 58%, 0.42)',
    '--logo-shadow-color': 'rgba(12, 9, 24, 0.55)',
    '--logo-icon-shadow': 'rgba(26, 18, 40, 0.42)',
  },
  dawn: {
    '--background': '58 24% 94%',
    '--foreground': '220 18% 20%',
    '--card': '54 30% 97%',
    '--card-foreground': '220 18% 20%',
    '--overlay': '56 18% 88%',
    '--popover': '54 30% 97%',
    '--popover-foreground': '220 18% 20%',
    '--primary': '176 42% 32%',
    '--primary-foreground': '54 30% 97%',
    '--secondary': '55 18% 90%',
    '--secondary-foreground': '220 18% 20%',
    '--muted': '53 10% 61%',
    '--muted-foreground': '220 14% 34%',
    '--accent': '337 34% 43%',
    '--accent-foreground': '54 30% 97%',
    '--destructive': '350 46% 45%',
    '--destructive-foreground': '54 30% 97%',
    '--love': '350 46% 45%',
    '--gold': '38 66% 45%',
    '--rose': '350 40% 62%',
    '--pine': '158 30% 28%',
    '--foam': '176 42% 32%',
    '--iris': '266 26% 43%',
    '--border': '50 18% 78%',
    '--input': '50 18% 78%',
    '--ring': '176 42% 32%',
    '--logo-stop-1': 'color-mix(in srgb, #31748f 36%, transparent)',
    '--logo-stop-2': 'color-mix(in srgb, #7c6fce 28%, transparent)',
    '--logo-stop-3': 'color-mix(in srgb, #f7f9fc 65%, transparent)',
    '--logo-base-fill': 'color-mix(in srgb, hsl(var(--card)) 88%, hsl(var(--overlay)) 12%)',
    '--logo-border-color': 'hsla(222, 24%, 72%, 0.5)',
    '--logo-shadow-color': 'rgba(45, 52, 74, 0.14)',
    '--logo-icon-shadow': 'rgba(45, 52, 74, 0.18)',
  },
};

const applyThemeEarly = (nextTheme) => {
  if (!validThemes.has(nextTheme)) return;
  root.dataset.theme = nextTheme;
  root.classList.toggle('theme-dawn', nextTheme === 'dawn');
  root.classList.toggle('theme-night', nextTheme === 'night');
  if (document.body) document.body.dataset.theme = nextTheme;
  if (document.body) {
    document.body.classList.toggle('theme-dawn', nextTheme === 'dawn');
    document.body.classList.toggle('theme-night', nextTheme === 'night');
  }
  Object.entries(themeTokens[nextTheme]).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  try {
    const colorScheme = nextTheme === 'dawn' ? 'only light' : 'dark';
    root.style.colorScheme = colorScheme;
    if (document.body) document.body.style.colorScheme = colorScheme;
    const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaColorScheme) metaColorScheme.setAttribute('content', colorScheme);
  } catch {}

  try {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const isActive = button.getAttribute('data-theme-toggle') === nextTheme;
      button.setAttribute('aria-pressed', String(isActive));
      button.setAttribute('data-active', String(isActive));
    });
  } catch {}
};

window.__careerToolsSetTheme = (nextTheme) => {
  if (!validThemes.has(nextTheme)) return;
  applyThemeEarly(nextTheme);
  try {
    window.localStorage.setItem(storageKey, nextTheme);
  } catch {}
  try {
    const secureToken = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${storageKey}=${nextTheme};path=/;max-age=31536000;SameSite=Lax${secureToken}`;
  } catch {}
};

document.addEventListener(
  'click',
  (event) => {
    const target =
      event.target instanceof Element ? event.target.closest('[data-theme-toggle]') : null;
    if (!target) return;
    window.__careerToolsSetTheme(target.getAttribute('data-theme-toggle'));
  },
  true
);

window.addEventListener('career-tools-theme-change', (event) => {
  const nextTheme = event instanceof CustomEvent ? event.detail?.theme : null;
  if (validThemes.has(nextTheme)) {
    window.__careerToolsSetTheme(nextTheme);
  }
});

const getTheme = () => {
  try {
    const cookieMatch = document.cookie.match(new RegExp('(^|; )' + storageKey + '=([^;]*)'));
    const fromCookie = cookieMatch?.[2];
    if (fromCookie === 'night' || fromCookie === 'dawn') return fromCookie;
  } catch {}
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'night' || stored === 'dawn') return stored;
  } catch {}
  const serverTheme = root.dataset.theme;
  if (serverTheme === 'night' || serverTheme === 'dawn') return serverTheme;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'night' : 'dawn';
};

const syncTheme = () => {
  let styleEl;
  try {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-transitions-off';
    styleEl.textContent = '*{transition: none !important}';
    document.head.appendChild(styleEl);
  } catch {}

  applyThemeEarly(getTheme());

  try {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      });
    });
  } catch {}
};

try {
  syncTheme();
} catch {}

document.addEventListener('astro:before-swap', syncTheme);
document.addEventListener('astro:after-swap', syncTheme);
document.addEventListener('astro:page-load', syncTheme);
