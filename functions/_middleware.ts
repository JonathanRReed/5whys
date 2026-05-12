import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';

  // Allowed origins
  const allowedOrigins = [
    'https://5whys.jonathanrreed.com',
    'https://5whys.pages.dev',
    'http://localhost:4321',
    'http://localhost:3000',
  ];

  const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed)) || !origin;

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = await context.next();

  // Add CORS headers to all responses
  response.headers.set(
    'Access-Control-Allow-Origin',
    isAllowed ? origin : allowedOrigins[0]
  );
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
};
