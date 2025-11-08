import type { APIRoute } from 'astro';

const sitemapIndex = (target: string) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${target}</loc>
  </sitemap>
</sitemapindex>
`;

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;
  const target = `${origin}/sitemap-index.xml`;

  return new Response(sitemapIndex(target), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
