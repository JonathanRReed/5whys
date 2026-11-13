import { flushSync } from 'react-dom';

/**
 * Run a state change the visitor just caused inside a view transition, so
 * they can see what moved. Falls back to a plain update when the browser has
 * no View Transitions API or the visitor asked for reduced motion.
 *
 * The change is flushed synchronously so the browser captures the new DOM,
 * and a skipped or timed-out transition is swallowed: the update has already
 * happened, only the animation was dropped.
 */
export function withViewTransition(change: () => void): void {
  if (typeof document === 'undefined') {
    change();
    return;
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof document.startViewTransition !== 'function') {
    change();
    return;
  }
  const transition = document.startViewTransition(() => flushSync(change));
  const ignore = () => undefined;
  transition.ready.catch(ignore);
  transition.updateCallbackDone.catch(ignore);
  transition.finished.catch(ignore);
}
