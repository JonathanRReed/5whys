import type { PagesFunction } from '@cloudflare/workers-types';

// Privacy-first analytics: no cookies, no IP storage, no session tracking.
// Only stores: pathname, referrer domain, timestamp, browser family, screen size bucket.

function getBrowserFamily(userAgent: string): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome') && !ua.includes('edg')) return 'chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('edg')) return 'edge';
  return 'other';
}

function getScreenBucket(width: number): string {
  if (width >= 1920) return 'xl';
  if (width >= 1440) return 'lg';
  if (width >= 768) return 'md';
  return 'sm';
}

function getReferrerDomain(referrer: string): string {
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }
}

function normalizePathname(pathname: string): string {
  try {
    const parsed = new URL(pathname, 'https://5whys.jonathanrreed.com');
    const safePath = parsed.pathname.replace(/[^\w\-./]/g, '').slice(0, 120);
    return safePath.startsWith('/') ? safePath : '/';
  } catch {
    return '/';
  }
}

export const onRequestPost: PagesFunction<{ ANALYTICS_KV: KVNamespace }> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      pathname?: string;
      referrer?: string;
      screenWidth?: number;
      screenHeight?: number;
    };

    const pathname = normalizePathname(body?.pathname || '/');
    const referrer = String(body?.referrer || '').slice(0, 300);
    const screenWidth = Number.isFinite(body?.screenWidth) ? Number(body.screenWidth) : 0;

    const userAgent = context.request.headers.get('User-Agent') || '';
    const browser = getBrowserFamily(userAgent);
    const screenBucket = getScreenBucket(screenWidth);
    const referrerDomain = getReferrerDomain(referrer);

    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const hourKey = `${dateKey}-${now.getUTCHours().toString().padStart(2, '0')}`;

    const kv = context.env.ANALYTICS_KV;
    if (!kv) {
      return new Response(null, { status: 204 });
    }

    // Increment daily pageview counter
    const dailyKey = `pv:${dateKey}:${pathname}`;
    const currentDaily = await kv.get(dailyKey);
    await kv.put(dailyKey, String(parseInt(currentDaily || '0', 10) + 1));

    // Store hourly aggregate
    const hourlyKey = `hourly:${hourKey}`;
    const hourlyRaw = await kv.get(hourlyKey);
    const hourly = hourlyRaw
      ? JSON.parse(hourlyRaw)
      : { pageviews: 0, browsers: {}, referrers: {}, screens: {} };
    hourly.pageviews += 1;
    hourly.browsers[browser] = (hourly.browsers[browser] || 0) + 1;
    hourly.referrers[referrerDomain] = (hourly.referrers[referrerDomain] || 0) + 1;
    hourly.screens[screenBucket] = (hourly.screens[screenBucket] || 0) + 1;
    await kv.put(hourlyKey, JSON.stringify(hourly));

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
