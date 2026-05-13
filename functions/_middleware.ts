import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async (context) => {
  const origin = context.request.headers.get('Origin') || '';

  // Allowed origins
  const allowedOrigins = [
    'https://5whys.jonathanrreed.com',
    'https://5whys.pages.dev',
    'http://localhost:4321',
    'http://localhost:3000',
  ];

  const isAllowed = !origin || allowedOrigins.includes(origin);
  const corsOrigin = origin && isAllowed ? origin : allowedOrigins[0];

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }

  const response = await context.next();

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', corsOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Vary', 'Origin');

  return response;
};
