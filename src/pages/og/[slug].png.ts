import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute, GetStaticPaths } from 'astro';
import type { ReactNode } from 'react';
import satori from 'satori';
import { OG_PAGES, type OgAccent } from '../../config/og';

// Static fonts for the renderer (satori reads TTF/OTF/WOFF, not the variable
// woff2 files the site itself uses). Resolved from the package, not a path.
const require = createRequire(import.meta.url);
const fontFile = (pkg: string, file: string) => readFile(require.resolve(`${pkg}/files/${file}`));

const WIDTH = 1200;
const HEIGHT = 630;

// Night palette from src/styles/globals.css, flattened to hex for the renderer.
const COLORS = {
  background: '#11140f',
  card: '#181c17',
  foreground: '#e9ebe2',
  muted: '#b4bbaa',
  border: '#343c36',
  accent: {
    foam: '#3ba67a',
    gold: '#cda24c',
    iris: '#b195c4',
    love: '#cf7357',
  } satisfies Record<OgAccent, string>,
};

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(OG_PAGES).map((slug) => ({ params: { slug } }));

export const GET: APIRoute = async ({ params }) => {
  const page = OG_PAGES[params.slug ?? 'home'] ?? OG_PAGES.home;
  const accent = COLORS.accent[page.accent];

  const [fraunces, inter, interMedium] = await Promise.all([
    fontFile('@fontsource/fraunces', 'fraunces-latin-600-normal.woff'),
    fontFile('@fontsource/inter', 'inter-latin-400-normal.woff'),
    fontFile('@fontsource/inter', 'inter-latin-500-normal.woff'),
  ]);

  // satori accepts this plain object tree at runtime; its types only name ReactNode.
  const tree = {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
        fontFamily: 'Inter',
        position: 'relative',
      },
      children: [
        // Faint plate rule along the top, in the tool's accent.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: WIDTH,
              height: 6,
              backgroundColor: accent,
            },
          },
        },
        // Eyebrow row with optional plate numeral.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 22,
              letterSpacing: 5,
              textTransform: 'uppercase',
              color: COLORS.muted,
              fontWeight: 500,
            },
            children: [
              page.plate
                ? {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        border: `2px solid ${accent}`,
                        color: accent,
                        fontFamily: 'Fraunces',
                        fontSize: 24,
                        letterSpacing: 0,
                      },
                      children: page.plate,
                    },
                  }
                : null,
              { type: 'span', props: { children: page.eyebrow } },
            ],
          },
        },
        // Title and description.
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980 },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Fraunces',
                    fontSize: 72,
                    lineHeight: 1.08,
                    letterSpacing: -1.5,
                    color: COLORS.foreground,
                  },
                  children: page.title,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: 28, lineHeight: 1.4, color: COLORS.muted, maxWidth: 900 },
                  children: page.description,
                },
              },
            ],
          },
        },
        // Footer: wordmark and domain with a hairline above.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${COLORS.border}`,
              paddingTop: 24,
              fontSize: 22,
              color: COLORS.muted,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 14 },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          backgroundColor: accent,
                        },
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: 'Fraunces',
                          fontSize: 26,
                          color: COLORS.foreground,
                        },
                        children: '5 Whys Career Studio',
                      },
                    },
                  ],
                },
              },
              {
                type: 'span',
                props: { children: '5whys.jonathanrreed.com · private by design' },
              },
            ],
          },
        },
      ],
    },
  } as unknown as ReactNode;

  const svg = await satori(tree, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' },
      { name: 'Inter', data: inter, weight: 400, style: 'normal' },
      { name: 'Inter', data: interMedium, weight: 500, style: 'normal' },
    ],
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
