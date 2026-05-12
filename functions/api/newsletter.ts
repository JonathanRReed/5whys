import type { PagesFunction } from '@cloudflare/workers-types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KV_KEY_PREFIX = 'newsletter:';

export const onRequestPost: PagesFunction<{ NEWSLETTER_KV: KVNamespace }> = async (context) => {
  try {
    const body = (await context.request.json()) as { email?: string };
    const email = body?.email?.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const kv = context.env.NEWSLETTER_KV;
    if (!kv) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service unavailable.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already subscribed
    const existing = await kv.get(`${KV_KEY_PREFIX}${email}`);
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already on the list.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Store subscription
    const data = {
      email,
      subscribedAt: new Date().toISOString(),
      source: context.request.headers.get('Referer') || 'direct',
      userAgent: context.request.headers.get('User-Agent')?.slice(0, 200) || '',
    };

    await kv.put(`${KV_KEY_PREFIX}${email}`, JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, message: 'Subscribed successfully.' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
