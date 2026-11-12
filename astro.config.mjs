// @ts-check

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { localSpeechRuntime, speechLibraries } from './scripts/models/build.mjs';
import { previewHeaders } from './scripts/models/headers.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://5whys.jonathanrreed.com',
  output: 'static',
  server: { headers: previewHeaders() },
  // Astro 7 defaults to JSX-style whitespace collapsing, which would strip the
  // space between adjacent inline elements in the editorial copy. Keep the
  // pre-7 behaviour: collapse whitespace but never remove it between siblings.
  compressHTML: true,
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss(), localSpeechRuntime()],
    worker: { format: 'es', plugins: () => [localSpeechRuntime()] },
  },
  integrations: [
    speechLibraries(),
    react(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.8,
    }),
  ],
});
