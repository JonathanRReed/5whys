import type { PagesFunction } from '@cloudflare/workers-types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KV_KEY_PREFIX = 'newsletter:';

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getSourceHost(referer: string | null): string {
  if (!referer) return 'direct';
  try {
    return new URL(referer).hostname.slice(0, 120);
  } catch {
    return 'direct';
  }
}

export const onRequestPost: PagesFunction<{ NEWSLETTER_KV: KVNamespace }> = async (context) => {
  try {
    const body = (await context.request.json()) as { email?: string };
    const email = body?.email?.trim().toLowerCase().slice(0, 254);

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Valid email required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const kv = context.env.NEWSLETTER_KV;
    if (!kv) {
      return new Response(JSON.stringify({ success: false, error: 'Service unavailable.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already subscribed
    const emailKey = `${KV_KEY_PREFIX}${await hashEmail(email)}`;
    const existing = await kv.get(emailKey);
    if (existing) {
      return new Response(JSON.stringify({ success: true, message: 'Already on the list.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store subscription
    const data = {
      email,
      subscribedAt: new Date().toISOString(),
      source: getSourceHost(context.request.headers.get('Referer')),
    };

    await kv.put(emailKey, JSON.stringify(data));

    return new Response(JSON.stringify({ success: true, message: 'Subscribed successfully.' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
