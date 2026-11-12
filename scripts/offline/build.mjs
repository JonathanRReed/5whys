import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
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

export function precachePath(path) {
  if (path.startsWith('models/')) return null;
  if (
    !path.endsWith('.html') &&
    !path.startsWith('_astro/') &&
    !path.startsWith('fonts/') &&
    !/^data\/pay\/.*\.json$/.test(path) &&
    !/\.(png|svg|ico|webmanifest)$/.test(path)
  )
    return null;
  return `/${path.replace(/(^|\/)index\.html$/, '$1')}`;
}

/** Input is file bytes, so both URL changes and content changes invalidate the shell. */
export function buildPrecache(files, workerSource = '') {
  const selected = files
    .map(({ path, bytes }) => ({ url: precachePath(path), bytes }))
    .filter((entry) => entry.url !== null)
    .sort((a, b) => a.url.localeCompare(b.url));
  const hash = createHash('sha256').update(workerSource);
  for (const { url, bytes } of selected) {
    hash.update(url).update('\0').update(createHash('sha256').update(bytes).digest());
  }
  return {
    version: hash.digest('hex'),
    urls: selected.map(({ url }) => url),
    bytes: selected.reduce((sum, entry) => sum + entry.bytes.byteLength, 0),
    files: selected.length,
  };
}

async function builtFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (path === 'models' || path.startsWith('models/')) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await builtFiles(absolute, `${path}/`)));
    else if (precachePath(path)) files.push({ path, bytes: await readFile(absolute) });
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
          `const CACHE_NAME = ${JSON.stringify(`${SHELL_CACHE_PREFIX}${report.version}`)};\nconst PRECACHE = ${JSON.stringify(report.urls)};\n${source}`
        );
        await writeFile(
          resolve(directory, 'precache-report.json'),
          JSON.stringify(report, null, 2)
        );
        logger.info(
          `Precache: ${report.files} files, ${report.bytes} bytes, version ${report.version}`
        );
      },
    },
  };
}
