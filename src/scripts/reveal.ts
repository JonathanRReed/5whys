// Scroll reveal. Content is visible by default; the `js` class the theme boot
// script adds to <html> opts elements with .reveal / .reveal-stagger into a
// short fade-and-rise as they enter the viewport. Without JavaScript nothing
// is hidden, and prefers-reduced-motion disables the motion in CSS.

const BOUND = 'data-reveal-bound';

function revealOnScroll() {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('.reveal, .reveal-stagger')
  ).filter((el) => !el.hasAttribute(BOUND));
  if (targets.length === 0) return;
  for (const target of targets) target.setAttribute(BOUND, '');

  if (!('IntersectionObserver' in window)) {
    for (const target of targets) target.classList.add('visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  for (const target of targets) observer.observe(target);
}

// Run now: module scripts execute after the DOM is parsed, and the initial
// astro:page-load may already have fired before this module was evaluated.
revealOnScroll();
// Then again after every ClientRouter navigation.
document.addEventListener('astro:page-load', revealOnScroll);
