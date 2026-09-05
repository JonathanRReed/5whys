/**
 * Theme state for the Night / Dawn palettes.
 *
 * One storage location (localStorage) and one DOM signal (`data-theme` on
 * <html>). The inline boot script in src/scripts/theme-init.js applies the
 * stored theme before first paint; this module is what hydrated components
 * use to read and change it afterwards.
 */

export type Theme = 'night' | 'dawn';

export const THEME_STORAGE_KEY = 'career-tools-theme';

export const isTheme = (value: unknown): value is Theme => value === 'night' || value === 'dawn';

/** The theme currently applied to the document, or null during SSR. */
export function readAppliedTheme(): Theme | null {
  if (typeof document === 'undefined') return null;
  const applied = document.documentElement.dataset.theme;
  return isTheme(applied) ? applied : null;
}

/**
 * Apply a theme to the document. Colour transitions are suppressed for one
 * frame so the whole page flips at once instead of fading element by element.
 */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;

  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(freeze);

  root.dataset.theme = theme;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => freeze.remove());
  });
}

/** Apply and remember a theme. */
export function setTheme(theme: Theme) {
  applyTheme(theme);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode or full storage: the choice still applies for this page */
  }
}
