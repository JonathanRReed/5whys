import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * How a scripted scroll should move. A `behavior: 'smooth'` passed from
 * script ignores the CSS reduced-motion rule, so every caller asks here.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Move focus to the element with `id` once it is on the page. For actions
 * that replace the control the visitor pressed with new content.
 */
export function focusWhenReady(id: string, frames = 30) {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  if (target) {
    target.focus();
    return;
  }
  if (frames > 0) window.requestAnimationFrame(() => focusWhenReady(id, frames - 1));
}
