/**
 * Typeface preference: the field guide's own faces, a plainer sans for
 * readability, or OpenDyslexic.
 *
 * Mirrors src/lib/theme.ts: one storage key and one DOM signal (`data-font`
 * on <html>, absent for the default). The inline boot script applies the
 * stored value before first paint; this module owns it afterwards. It is a
 * device preference, like the theme, so it is not part of the backup.
 */

export type Typeface = 'default' | 'readable' | 'dyslexic';

export const TYPEFACE_STORAGE_KEY = 'career-tools-font';

export const TYPEFACE_OPTIONS: { value: Typeface; label: string; family: string }[] = [
  { value: 'default', label: 'Fraunces', family: 'var(--font-display)' },
  { value: 'readable', label: 'Nebula Sans', family: '"Nebula Sans", system-ui, sans-serif' },
  { value: 'dyslexic', label: 'OpenDyslexic', family: '"OpenDyslexic", system-ui, sans-serif' },
];

export const isTypeface = (value: unknown): value is Typeface =>
  value === 'default' || value === 'readable' || value === 'dyslexic';

/** The typeface currently applied to the document. */
export function readAppliedTypeface(): Typeface {
  if (typeof document === 'undefined') return 'default';
  const applied = document.documentElement.dataset.font;
  return applied === 'readable' || applied === 'dyslexic' ? applied : 'default';
}

export function applyTypeface(typeface: Typeface) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (typeface === 'default') delete root.dataset.font;
  else root.dataset.font = typeface;
}

/** Apply and remember a typeface. */
export function setTypeface(typeface: Typeface) {
  applyTypeface(typeface);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TYPEFACE_STORAGE_KEY, typeface);
  } catch {
    /* private mode or full storage: the choice still applies for this page */
  }
}
