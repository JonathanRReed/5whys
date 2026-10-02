import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const homepage = readFileSync(resolve(process.cwd(), 'src/pages/index.astro'), 'utf8');

it('describes resume feedback without illustrative grades or invented outcomes', () => {
  expect(homepage).not.toMatch(/>32<|>88<|one bullet, rescored|lifting signups 12%/);
  expect(homepage).toContain('evidence you can support');
});

it('acknowledges saved progress instead of denying the existing dashboard', () => {
  expect(homepage).not.toContain('No dashboard');
  expect(homepage).toContain('/dashboard/');
});

it('keeps search descriptions in metadata rather than hidden keyword paragraphs', () => {
  expect(homepage).not.toContain('Career studio search context');
  expect(homepage).toContain('structuredData={homeStructuredData}');
});
