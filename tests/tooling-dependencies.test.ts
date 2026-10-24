import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);

test('devalue retains the legacy URL replacer used by this Astro release', () => {
  const { uneval } = require('devalue');
  const href = 'https://example.test/article?title=quoted%20text';
  const code = uneval({ link: new URL(href) }, (value: unknown) => {
    if (value instanceof URL) return `new URL(${JSON.stringify(value.href)})`;
  });
  const restored = runInNewContext(`(${code})`, { URL });
  expect(restored.link).toBeInstanceOf(URL);
  expect(restored.link.href).toBe(href);
});

test('constrained build schemas reject oversized collections before visiting items', () => {
  const { z } = createRequire(require.resolve('astro/package.json'))('zod');
  let visited = 0;
  const schema = z.array(z.string().superRefine(() => visited++)).max(2);
  const invalid = schema.safeParse(['one', 'two', 'three']);
  expect(invalid.success).toBe(false);
  expect(visited).toBe(0);
  expect(schema.parse(['one', 'two'])).toEqual(['one', 'two']);
  expect(visited).toBe(2);
});

test('URI tooling rejects encoded schemes and preserves ordinary resolution', () => {
  const uri = require('fast-uri');
  expect(uri.parse('%68ttps://example.test/schema').error).toBe('URI scheme is malformed.');
  expect(uri.resolve('https://example.test/schemas/', 'case.json')).toBe(
    'https://example.test/schemas/case.json'
  );
});

test('build and DOM HTTP clients preserve response integrity checks without network access', async () => {
  const body = 'local fixture';
  const integrity = `sha256-${createHash('sha256').update(body).digest('base64')}`;
  for (const name of ['miniflare', 'unifont', 'jsdom']) {
    const { MockAgent, fetch } = createRequire(require.resolve(name))('undici');
    const dispatcher = new MockAgent();
    dispatcher.disableNetConnect();
    try {
      const pool = dispatcher.get('https://example.test');
      pool.intercept({ path: '/valid' }).reply(200, body);
      const response = await fetch('https://example.test/valid', { dispatcher, integrity });
      expect(await response.text()).toBe(body);
      pool.intercept({ path: '/mismatch' }).reply(200, 'different fixture');
      await expect(
        fetch('https://example.test/mismatch', { dispatcher, integrity })
      ).rejects.toThrow();
    } finally {
      await dispatcher.close();
    }
  }
});
