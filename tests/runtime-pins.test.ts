// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('package manager and both CI jobs use the tested Bun patch', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  expect(manifest.packageManager).toBe('bun@1.4.4');
  expect(workflow.match(/bun-version: 1\.4\.4/g)).toHaveLength(2);
  expect(workflow).not.toContain('bun-version: 1.4.0');
});
