// ESLint covers .astro templates only: Astro's own rules plus, when the
// optional jsx-a11y peer is installed, its strict accessibility set.
// Biome formats and lints TypeScript, JavaScript, CSS, and JSON (biome.json).

import tsParser from '@typescript-eslint/parser';
import * as astroParser from 'astro-eslint-parser';
import astroPlugin from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'public/**', 'node_modules/**', '.wrangler/**', '.astro/**'],
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2023,
        sourceType: 'module',
        extraFileExtensions: ['.astro'],
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { astro: astroPlugin },
    rules: {
      ...astroPlugin.configs.recommended.rules,
      ...(astroPlugin.configs['jsx-a11y-strict']?.rules ?? {}),
    },
  },
];
