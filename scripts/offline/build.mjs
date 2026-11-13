import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import ts from 'typescript';
import { SHELL_CACHE_PREFIX } from './routing.mjs';

/** Read Night's background once, rather than maintaining another palette. */
export async function nightColor() {
  const css = await readFile(new URL('../../src/styles/globals.css', import.meta.url), 'utf8');
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  const triplet = root?.match(/--background:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!triplet) throw new Error('Night background token is missing.');
  const hue = Number(triplet[1]) / 30;
  const saturation = Number(triplet[2]) / 100;
  const lightness = Number(triplet[3]) / 100;
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => {
    const k = (n + hue) % 12;
    return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Canonical shell URL. Asset selection is driven by references, not directories. */
export function precachePath(path) {
  if (path === 'models' || path.startsWith('models/')) return null;
  // The host answers /404.html with a redirect to /404, and a redirect makes
  // the whole install fail. The not-found page is not part of the offline
  // shell: a path that is not cached has nothing to show offline anyway.
  if (path === '404.html') return null;
  return `/${path.replace(/(^|\/)index\.html$/, '$1')}`;
}

function staticImports(source) {
  const urls = [];
  const tree = ts.createSourceFile('built.js', source, ts.ScriptTarget.Latest, true);
  for (const node of tree.statements) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      urls.push(node.moduleSpecifier.text);
    }
  }
  return urls;
}

/** Follow HTML entry points and their static dependencies. Never follow import(). */
export function buildPrecache(files, workerSource = '') {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const selected = new Map();
  const add = (reference, from = '/index.html') => {
    const url = new URL(reference, `https://shell.invalid${from}`);
    if (url.origin !== 'https://shell.invalid') return;
    const path = decodeURI(url.pathname.slice(1));
    const file = byPath.get(path);
    if (!file || !precachePath(path) || selected.has(path)) return;
    selected.set(path, file);
    const source = file.bytes.toString('utf8');
    if (/\.[cm]?js$/.test(path)) {
      for (const dependency of staticImports(source)) add(dependency, `/${path}`);
    } else if (path.endsWith('.css')) {
      // Only the default theme's basic Latin faces. Other subsets and visitor
      // typefaces are fetched by the browser when the text or choice needs them.
      for (const [face] of source.matchAll(/@font-face\s*\{[^}]+\}/g)) {
        if (
          !/font-family:["']?(?:Fraunces Variable|Inter Variable|JetBrains Mono Variable)["']?;/.test(
            face
          )
        )
          continue;
        for (const [, font] of face.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
          if (/-latin-(?!ext)/.test(font)) add(font, `/${path}`);
        }
      }
      for (const [, dependency] of source.matchAll(/@import\s*(?:url\()?['"]([^'"]+)['"]/g))
        add(dependency, `/${path}`);
    } else if (path.endsWith('.webmanifest')) {
      for (const icon of JSON.parse(source).icons ?? []) add(icon.src, `/${path}`);
    }
  };
  for (const file of files) {
    if (!file.path.endsWith('.html') || !precachePath(file.path)) continue;
    add(`/${file.path}`);
    const html = file.bytes.toString('utf8');
    for (const [tag] of html.matchAll(/<(?:script|link|astro-island)\b[^>]*>/g)) {
      const attributes = Object.fromEntries(
        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])
      );
      if (
        tag.startsWith('<link') &&
        !/^(stylesheet|modulepreload|icon|apple-touch-icon|manifest)$/.test(attributes.rel)
      )
        continue;
      for (const key of ['src', 'href', 'component-url', 'renderer-url']) {
        if (attributes[key]) add(attributes[key], `/${file.path}`);
      }
    }
    for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const dependency of staticImports(script)) add(dependency, `/${file.path}`);
    }
  }
  // Generated after HTML, so older templates may not yet reference these.
  add('/site.webmanifest');
  const entries = [...selected.values()].sort((a, b) =>
    precachePath(a.path).localeCompare(precachePath(b.path))
  );
  const hash = createHash('sha256').update(workerSource);
  const revisions = {};
  for (const { path, bytes } of entries) {
    const url = precachePath(path);
    const revision = createHash('sha256').update(bytes).digest('hex');
    revisions[url] = revision;
    hash.update(url).update('\0').update(revision);
  }
  return {
    version: hash.digest('hex'),
    urls: Object.keys(revisions),
    revisions,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0),
    gzipBytes: entries.reduce((sum, entry) => sum + gzipSync(entry.bytes, { level: 9 }).length, 0),
    files: entries.length,
  };
}

async function builtFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (path === 'models' || path.startsWith('models/')) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await builtFiles(absolute, `${path}/`)));
    else files.push({ path, bytes: await readFile(absolute) });
  }
  return files;
}

async function installAssets(directory, color) {
  const mark = await readFile(
    new URL('../../public/career-studio-mark-transparent.png', import.meta.url)
  );
  const image = `data:image/png;base64,${mark.toString('base64')}`;
  await mkdir(resolve(directory, 'icons'), { recursive: true });
  for (const [name, size, inset] of [
    ['icon-192', 192, 16],
    ['icon-512', 512, 42],
    // The whole mark fits inside the maskable safe zone's central circle.
    ['maskable-512', 512, 116],
    ['apple-touch-icon', 180, 16],
  ]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${color}"/><image href="${image}" x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}"/></svg>`;
    await writeFile(resolve(directory, `icons/${name}.png`), new Resvg(svg).render().asPng());
  }
  await writeFile(
    resolve(directory, 'site.webmanifest'),
    JSON.stringify(
      {
        id: '/',
        name: '5 Whys Career Studio',
        short_name: '5 Whys',
        start_url: '/dashboard/',
        scope: '/',
        display: 'standalone',
        theme_color: color,
        background_color: color,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      null,
      2
    )
  );
}

export function offlineShell() {
  return {
    name: 'offline-shell',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const directory = fileURLToPath(dir);
        const color = await nightColor();
        await installAssets(directory, color);
        const routing = (
          await readFile(new URL('./routing.mjs', import.meta.url), 'utf8')
        ).replaceAll('export ', '');
        const worker = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
        const source = `${routing}\n${worker}`;
        const files = await builtFiles(directory);
        // Seo already emits this tag. Bind it to the install palette before hashing HTML.
        for (const file of files) {
          if (!file.path.endsWith('.html')) continue;
          file.bytes = Buffer.from(
            file.bytes
              .toString('utf8')
              .replace(/(<meta name="theme-color" content=")[^"]*"/g, `$1${color}"`)
          );
          await writeFile(resolve(directory, file.path), file.bytes);
        }
        const report = buildPrecache(files, source);
        await writeFile(
          resolve(directory, 'sw.js'),
          `const CACHE_NAME = ${JSON.stringify(`${SHELL_CACHE_PREFIX}${report.version}`)};\nconst PRECACHE = ${JSON.stringify(report.urls)};\nconst REVISIONS = ${JSON.stringify(report.revisions)};\n${source}`
        );
        await writeFile(
          resolve(directory, 'precache-report.json'),
          JSON.stringify(report, null, 2)
        );
        logger.info(
          `Precache: ${report.files} files, ${report.bytes} bytes, ${report.gzipBytes} gzip bytes, version ${report.version}`
        );
      },
    },
  };
}
