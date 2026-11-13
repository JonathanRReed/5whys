# Working on 5 Whys Career Studio

Instructions for coding agents and humans alike. Read `PRODUCT.md` (audience,
tone) and `DESIGN.md` (visual rules) before changing anything a user sees.

## What this is

A static Astro 7 site with React 19 islands. Career tools for students and
early-career people, plus a career review at `/start/` and a dashboard. Every
piece of user data lives on the visitor's device (`localStorage` for small
data, IndexedDB for recordings, the resume, and downloaded models); nothing is
sent to a server, the site sets no cookies, and that promise is repeated on
the homepage. Do not add analytics, forms, or fetches that would make it
false. The relaunch in progress is specified in
`docs/superpowers/specs/2026-11-12-relaunch-design.md`; read it before adding
a feature.

## Commands

```sh
bun install            # bun 1.4 is the only package manager
bun run dev            # http://localhost:4321
bun run build          # static output in dist/
bun run typecheck      # bun check + astro check
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
  script sets `data-theme` and `data-font`; it does not carry colors. No
  cookies.
- **Three typefaces.** The Aa menu offers the default faces, Nebula Sans, and
  OpenDyslexic (`src/lib/typeface.ts`). OpenDyslexic sets nearly twice as wide
  as Inter. Anything a visitor sees must be checked in it at phone width.
- **No third-party requests.** Site code fetches only from its own origin.
  Models, fonts, and data are self-hosted. Nothing downloads a model without a
  button that states the size.
- **A model never scores.** On-device AI writes suggestions, questions, and
  transcripts. Every number comes from a rule the visitor can inspect, and
  there is no "ATS score" or pass rate anywhere. Every AI feature has a
  rule-based version that works with no model.
- **AI must not invent.** A generated rewrite that adds a number, name, or
  tool the visitor did not write is rejected or shown with the addition
  flagged (`src/lib/local-ai`).
- **Copy is spare.** No em dashes, no exclamation-mark enthusiasm, no invented
  stats ("2 min"). If a number appears in copy, the code must compute it.
- **Paths.** Interview Glow Up lives at `/interview-glow-up/`; the old
  `/5whys/...` paths are redirected in `public/_redirects`.
- **Every tool page opens with a `PlateHeader`.** The homepage introduces the
  tools as numbered plates; the plate designation, numeral, and accent on a
  tool page must match the `plates` array in `src/pages/index.astro`.
- **No `confirm()`.** Destructive actions use `shared/ConfirmButton`, which
  arms in place and names what will be lost. DESIGN.md bans reaching for a
  modal first, and a native dialog cannot be themed or worded in the product's
  voice.
- **UI primitives come from shadcn.** `src/components/ui/*` is real shadcn
  source, managed by the CLI (`bunx --bun shadcn@latest add <name>`). Never run
  `shadcn init`: it would overwrite the Evergreen and Brass values for
  `--background`, `--primary`, `--border` and nine other tokens we already
  define. `components.json` is hand-written and points at the existing paths.
  Restyle a component in place with our tokens; keep its structure and
  `data-slot` attributes so `add --diff` stays usable.
- **`dark:` is wired to `[data-theme="night"]`** by a custom variant in
  globals.css. Without it every `dark:` rule a third-party component ships
  would be silently inert, since this site never sets a `.dark` class.
- **Elevation is declared once.** Inline surfaces get a hairline border;
  floating surfaces (dialog and select content) get a shadow and no border.
- **A component with no interactivity gets no client directive.** Astro renders
  it at build time and the page ships no JavaScript for it.
- **A tool island that only read storage must not write to it.** Another tab,
  or an import on the dashboard, may have saved newer work; an unload flush
  that writes an untouched snapshot silently destroys it. Track whether the
  visitor actually changed something before persisting (see the workspace).

## Before you say it is done

Run `bun run typecheck && bun run lint && bun run test && bun run build`, then
`bun run test:e2e`. For anything visual, look at it in Night and Dawn and at a
phone width. Biome's a11y rules are on for a reason: fix the finding, do not
suppress it.
