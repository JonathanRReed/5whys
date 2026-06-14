const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4321'
    : '';

async function postJson(path: string, body: unknown) {
  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await response.json()) as { success: boolean; message?: string; error?: string };
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function subscribeNewsletter(email: string) {
  return postJson('/newsletter', { email });
}

export async function trackPageview(pathname: string) {
  const payload = {
    pathname,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  };
  return postJson('/analytics', payload);
}

// Privacy-first analytics: fire once per page load, no cookies, no IP storage
let analyticsSent = false;

export function initAnalytics() {
  if (typeof window === 'undefined' || analyticsSent) return;
  analyticsSent = true;

  // Send pageview after page load
  if (document.readyState === 'complete') {
    trackPageview(window.location.pathname);
  } else {
    window.addEventListener('load', () => {
      trackPageview(window.location.pathname);
    });
  }
}
