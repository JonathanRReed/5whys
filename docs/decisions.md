# Decisions

Short, dated records of choices that are not obvious from the code. Newest
first. The May 2025 "megaplan" this file replaces is summarized at the bottom.

## 2026-09-05 Renovation

**Stack.** Astro 7, Tailwind 4 via `@tailwindcss/vite`, TypeScript 6 (astro
check does not support 7 yet), Vitest 5, React 19. Biome formats and lints
ts/tsx/css/json; ESLint 10 with `eslint-plugin-astro` covers `.astro` only,
because Biome's `.astro` support is still experimental. Prettier is gone. This
matches Jonathan's other Astro sites.

**Tokens.** The palette is registered once as named Tailwind colors in an
inline `@theme` block, so utilities read `bg-foam/15` and follow whichever
theme is active. The anti-flash script no longer carries a copy of the
palette; it only sets `data-theme`.

**No cookies.** The theme cookie was removed (a static site never read it, and
the homepage promises no cookies). The boot script clears the leftover cookie
for returning visitors.

**Hosting.** Cloudflare Workers Static Assets with `wrangler.jsonc`. CI deploys
main after the verify job passes, gated on repository secrets. Until the
custom domain moves off the Pages project, `package-lock.json` stays so the
Pages build keeps working.

**Interview Glow Up path.** Moved from `/5whys/interview-glow-up/` to
`/interview-glow-up/` with 301s, so all four tools sit at the root.

**Honest scoring.** The Resume Game scores a bullet as written and only moves
when a field changes; years, date ranges, and phone numbers are not measures;
a bare "to" is not an outcome link. Ambiguous skill names need context. Story
"confidence" (a self-typed percentage) became a three-state readiness.

**Structure detection.** A pasted resume without bullet glyphs is sorted into
achievement lines and everything else (contact, headings, education, title and
date lines, skills lists), and the report says what it skipped.

**Career profile.** `/start` saves stage and focus under `career-tools-profile`.
Tools read it for defaults: Interest Path first, student samples and
placeholders, student examples only. The dashboard shows it with a link back.

**Dashboard as to-do list.** It surfaces the next steps the tools generate
(the 5 Whys "test this by" step, the networking one-fix) and every
recommendation links to the item it names.

**One export, one import.** `src/lib/studio-backup.ts` collects every store
into one file and restores it, because local-only data has to be movable
between a school laptop and a phone.

**Not built, on purpose.** No analytics endpoint, no newsletter, no AI bullet
enhancer, no blog. They contradict "nothing you write leaves your browser" or
do not serve the student. If usage numbers are ever wanted, Cloudflare Web
Analytics is already allowed by the CSP and needs no code.

## 2025-05-12 Megaplan (superseded)

A design spec proposed a Cloudflare Workers backend (newsletter to KV,
privacy-first analytics to D1, an opt-in AI resume enhancer), a blog on
content collections, Lighthouse CI, and per-tool UX work. The UX work and the
quality pipeline shipped; the backend and blog never did and are now
explicitly out of scope (see above).
