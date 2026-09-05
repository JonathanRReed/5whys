# Working on 5 Whys Career Studio

Instructions for coding agents and humans alike. Read `PRODUCT.md` (audience,
tone) and `DESIGN.md` (visual rules) before changing anything a user sees.

## What this is

A static Astro 7 site with React 19 islands. Four career tools for students and
early-career people, plus a career review at `/start/` and a dashboard. Every
piece of user data lives in `localStorage`; nothing is sent to a server, the
site sets no cookies, and that promise is repeated on the homepage. Do not add
analytics, forms, or fetches that would make it false.

## Commands

```sh
bun install            # bun 1.4 is the only package manager
bun run dev            # http://localhost:4321
bun run build          # static output in dist/
bun run typecheck      # tsc + astro check
bun run lint           # biome (ts/tsx/css/json) + eslint (.astro only)
bun run format         # biome format --write
bun run test           # vitest unit tests in tests/
bun run test:e2e       # playwright flows in e2e/ against a built dist/
bun run audit:deps     # knip: unused files, exports, dependencies
bun run deploy         # astro build + wrangler deploy (Workers Static Assets)
```

CI runs typecheck, lint, unit tests, build, the Playwright flows, and a
`wrangler deploy --dry-run`. Main deploys to Cloudflare after CI is green.

## Layout

- `src/pages/` Astro routes. Tool pages mount one React island each.
- `src/components/<tool>/` one folder per tool: `career-5whys/`, `resume-game/`,
  `networking/`, `interview-glow-up/`. Shared primitives in `ui/` and `shared/`.
- `src/lib/` pure logic and storage readers. `career-bridge.ts` is the only
  cross-tool reader; `studio-backup.ts` lists every storage key.
- `src/config/` site metadata, structured data, and the OG image definitions.
- `src/scripts/` the inline theme boot script and the reveal script.
- `src/styles/globals.css` the whole design system: palette tokens, `@theme`,
  utilities. Colors are used as `bg-foam/15`, never as arbitrary `hsl()` values.
- `tests/` Vitest. `e2e/` Playwright, one happy-path flow per surface.

## Rules that are easy to break

- **Storage keys are contracts.** If a tool renames or adds a key, update
  `src/lib/career-bridge.ts` and `src/lib/studio-backup.ts` in the same commit.
- **Scores must be earned.** The Resume Game scores the line as written; no
  bonuses, no counting years or phone numbers. Interview stories have a
  three-state readiness, not a percentage. Do not reintroduce invented numbers.
- **Student register first.** Samples, placeholders, and examples default to
  the student profile (`src/lib/profile.ts`). Professional variants exist; do
  not replace student ones with them.
- **Islands hydrate from empty state.** Read `localStorage` in an effect, never
  in a `useState` initializer, or React throws hydration error 418.
- **Theme lives in one place.** The palette is only in `globals.css`. The boot
  script sets `data-theme`; it does not carry colors. No cookies.
- **Copy is spare.** No em dashes, no exclamation-mark enthusiasm, no invented
  stats ("2 min"). If a number appears in copy, the code must compute it.
- **Paths.** Interview Glow Up lives at `/interview-glow-up/`; the old
  `/5whys/...` paths are redirected in `public/_redirects`.

## Before you say it is done

Run `bun run typecheck && bun run lint && bun run test && bun run build`, then
`bun run test:e2e`. For anything visual, look at it in Night and Dawn and at a
phone width. Biome's a11y rules are on for a reason: fix the finding, do not
suppress it.
