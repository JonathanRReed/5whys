/* global document, window, IntersectionObserver, fetch */
/* eslint-disable no-empty */

// Scroll Reveal Observer
(function () {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

  const initReveal = () => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => {
      observer.observe(el);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  document.addEventListener('astro:page-load', initReveal);
})();

// Cursor Spotlight Tracking
(function () {
  if (typeof window === 'undefined') return;

  const initSpotlight = () => {
    document.querySelectorAll('.cursor-spotlight').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--mouse-x', x + '%');
        el.style.setProperty('--mouse-y', y + '%');
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpotlight);
  } else {
    initSpotlight();
  }

  document.addEventListener('astro:page-load', initSpotlight);
})();

// Privacy-first analytics (no cookies, no IP)
(function () {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
  var sent = false;
  function send() {
    if (sent) return;
    sent = true;
    try {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname: window.location.pathname,
          referrer: document.referrer,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        }),
      }).catch(function () {});
    } catch {}
  }
  if (document.readyState === 'complete') {
    send();
  } else {
    window.addEventListener('load', send);
  }
  document.addEventListener('astro:page-load', function () {
    sent = false;
    send();
  });
})();
