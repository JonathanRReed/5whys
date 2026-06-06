// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const sitemapExcludedPaths = new Set(['/start/']);

// https://astro.build/config
export default defineConfig({
  site: 'https://5whys.jonathanrreed.com',
  output: 'static',
  build: {
    inlineStylesheets: 'never',
  },
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.8,
      filter: (page) => !sitemapExcludedPaths.has(new URL(page).pathname),
    }),
  ],
});
