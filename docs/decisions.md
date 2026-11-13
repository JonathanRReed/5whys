# Decisions

Short, dated records of choices that are not obvious from the code. Newest
first. The May 2025 "megaplan" this file replaces is summarized at the bottom.

## 2026-11-12 Relaunch: the application desk and on-device AI

The full design is `docs/superpowers/specs/2026-11-12-relaunch-design.md`.
The decisions that change earlier ones:

- **AI is allowed when it runs on the device.** The earlier "no AI bullet
  enhancer" rule was about sending writing to a server. Suggestions now come
  from built-in rules or from a model in the visitor's browser. A model never
  produces a score, a rewrite that adds a fact the visitor did not write is
  flagged, and every AI feature has a rule-based version.
- **No ATS score.** Vendor documentation supports no universal pass mark. The
  machine view shows what our extractor read and counts findings; the posting
  match counts confirmed requirements with evidence, with its denominator.
- **Six plates.** The Application Desk (V) and Pay (VI) join the four tools.
  The top bar keeps the tools behind one menu so it does not grow.
- **Larger local data moves to IndexedDB.** Recordings, the resume file and
  its structured copy, and model caches. Small data stays in `localStorage`.
  The backup is version 2 and asynchronous; version 1 files still import.
- **One master resume.** Applications keep a selection of bullets, not their
  own resume, so the 2026-09-11 decision stands.
- **Hosted models are off by default.** Whisper and Kokoro are fetched only
  when a build sets `HOSTED_MODELS=1`, because hosting 163 MB of model chunks
  on the free plan is unproven. Kokoro is too slow to speak live, so questions
  are synthesized before a session. There is no hosted text model.
- **Wage data comes from BLS, by hand.** BLS refuses automated downloads, so
  a maintainer downloads three files and runs the pipeline offline.
- **Typefaces.** The Aa menu adds Nebula Sans and OpenDyslexic. Layouts must
  hold in OpenDyslexic at phone width.

## 2026-09-11 Bring-your-own AI and the closed loop

Two additions that make the prep loop legible without breaking the privacy
promise.

- **BYO-AI for likely questions.** In the packet prep view, Glow Up composes
  a prompt from the decoded posting (title, company, requirements) and copies
  it to the clipboard. The student pastes it into whatever AI they already
  use and pastes the answer back. The site sends nothing anywhere; the
  student makes the trade themselves. The answer saves on the packet as
  `aiQuestions`, freeform, under an explicit "From your AI" label. It is
  never scored, never read by the tools, and never merged into structured
  packet state. Structured ingest stays deferred unless the freeform version
  proves out.
- **The dashboard knows when the loop is closed.** One quiet line appears
  when a reflection, a scored resume, a practice rep, and a packed packet all
  exist, naming the in-focus application's deadline when there is one. No
  confetti, no badges, no streaks.
- **Load-time normalization hardened.** Backups are user-editable JSON in
  practice, and a record missing an array field (a hand-edited story without
  `otherSkillIds`) used to crash the workspace island at render. `loadData`
  now fills missing arrays and optionals on roles, bullets, stories, and
  packets while preserving everything valid.

## 2026-09-11 Applications spine

The four tools answered "am I ready" but not "ready for what, by when."
Students carry several deadlines at once, so the dashboard now tracks
**applications**: a title, a company, and a deadline, optionally linked to a
decoded Glow Up role.

- **Thin records, derived status.** `career-applications` stores only what
  the tools cannot know: the target and its date. Decode and packet state are
  read live from the linked role; resume and practice readiness stay global,
  because a resume and an intro are the same across applications. Nothing is
  copied, so nothing goes stale.
- **"Application" is the word.** It is what students call the thing; the
  field-guide naming stays on the tools.
- **Deadlines drive the dashboard.** Each application surfaces its first gap
  in the recommendations row, ahead of the tool pointers, and the applications
  list is sorted focus-first, then soonest.
- **Creation lives where the context does.** The dashboard offers the form in
  both its empty and populated states; inside Glow Up a "Track this
  application" button links the decoded role the student is looking at.
- **Removing an application removes only the tracking.** The decoded role and
  the stories stay, and the ConfirmButton says so.

## 2026-09-05 Print and motion after the component swap

Adopting Radix brought two regressions that only appear off the happy path,
both fixed:

- **Reduced motion stopped working.** Our media query covered our own named
  animations but not the `animate-in` / `fade-in` / `zoom-in` utilities that
  tw-animate-css adds to dialogs, selects, and tooltips. Verified: those
  elements now compute `animation-name: none` under `prefers-reduced-motion`.
- **The dialog printed its scrim.** A modal's overlay and scroll lock belong to
  the screen; on paper they laid a wash over the packet. Printing with a modal
  open now prints the modal rather than the page behind it.

Also trimmed for paper: the two full-viewport decorative layers (the blueprint
grid and the grain), the browser-storage reassurance banner, and the two-column
story grid, which left half of every row empty.

**Known cosmetic issue:** headless PDF rendering puts a blank leading page
before the packet. Content starts 114px into a 1676px document, so this looks
like a pagination artifact of the PDF renderer rather than a layout defect. The
packet itself prints complete and paginates correctly.

## 2026-09-05 Component libraries reviewed, shadcn adopted

**Reviewed:** Rare UI (declined, see below), ElevenLabs UI (agent and audio
components: orbs, waveforms, voice chat, none of which this product has), and
Starwind UI. Starwind is the strongest fit on paper, being Astro-native with
zero-JS components, but every interactive surface here lives inside a React
island that owns tool state, so its main advantage cannot apply. Adopting it
would also mean running two component systems.

**shadcn adopted.** `src/components/ui/*` were hand-written lookalikes, not
real shadcn. They are now CLI-managed source, restyled to Evergreen and Brass.
The DESIGN.md line about "cookie-cutter shadcn defaults" is retired.

Two hand-rolled components were genuinely broken, which is what justified the
swap:

- **Tabs** claimed `role="tablist"` while implementing almost none of the
  pattern: arrow keys did nothing, all four tabs sat in the tab order, and
  there was no `aria-controls` and no `role="tabpanel"` anywhere. Radix now
  supplies all of it.
- **The interview HUD** set `aria-modal="true"`, telling assistive tech the
  rest of the page was inert, while Tab walked straight out of it: 12 of 14
  presses landed outside the dialog. It is now a real dialog with a focus
  trap, scroll lock, and focus returned to whichever button opened it.

Also swapped: nine native selects that could not be themed and rendered their
lists in OS chrome; the hand-rolled timer picker, which is exactly ToggleGroup's
job; and `title` attributes, which never appear on touch.

**Setup notes.** `components.json` is hand-written because `shadcn init` would
overwrite twelve palette tokens we already define. A custom variant maps
`dark:` to `[data-theme="night"]`, without which every `dark:` rule shadcn
ships would be dead here. `cn` stays as clsx plus tailwind-merge rather than
the days-old `cn` package, so the components import from `@/lib/utils`.

**Caught during the swap:** shadcn's `line` tab variant forces a transparent
active background, which made the active tab ivory-on-ivory in Dawn. Fixed by
giving the primitive one semantic active treatment. Its `w-fit` list with
`flex-1` triggers also overflowed at phone width and covered the HUD button.

**Unrelated find:** the Glow Up landing page shipped a 311-line React island
for prose with no interactivity at all. It now renders at build time with no
client directive.

## 2026-09-05 UI pass

**Rare UI reviewed and declined.** The library is 18 novelty components
(fluid orbs, gooey nav, gravity letters) built on decorative motion, which
DESIGN.md forbids and PRODUCT.md lists as an anti-reference. Two of them
pointed at genuine gaps, which were fixed in the site's own idiom instead:
the practice timer is now selectable (30s / 1m / 2m / 5m, defaulting per
scenario, because a career fair with a line behind you is not a two-minute
conversation), and browser `confirm()` dialogs became an in-place
`ConfirmButton` that names what will be lost.

**The identity now reaches the tools.** The field-guide vocabulary lived only
on the homepage; the four tool pages opened with an unlabelled control and no
visible h1, with their explainer copy below the fold. Each now opens with a
`PlateHeader` carrying the same plate designation, numeral, and accent the
homepage uses.

**Dashboard rings removed.** The four-card metric row was the hero-metric
template and an identical card grid, both absolute bans, and three of the four
rings drew a progress arc around a plain count. Replaced with one sentence
naming what is saved, plus the resume score as the only real 0-100 measure.

**Dawn brass darkened** from 38% to 33% lightness. Every eyebrow, label, and
gold button in the light theme sat at 4.03:1, just under the 4.5:1 floor. This
one token cleared 17 contrast failures; Night was already at 8.2:1.

**Cross-tab data loss fixed.** The workspace flushed its in-memory state on
unload, so a stale tab silently overwrote a backup imported in another tab. It
now persists only after the visitor actually changes something. Covered by
`e2e/glow-up-concurrent.spec.ts`, which fails without the guard.

**Intentional exception:** the detector flags `bg-blueprint` as a decorative
grid background. It stays: this is a field guide whose homepage is built on
plates and drafting rules, which is exactly the case the rule exempts.

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
do not serve the student. Since the relaunch the CSP allows scripts and
requests from the site's own origin only, so no analytics script can load.

## 2025-05-12 Megaplan (superseded)

A design spec proposed a Cloudflare Workers backend (newsletter to KV,
privacy-first analytics to D1, an opt-in AI resume enhancer), a blog on
content collections, Lighthouse CI, and per-tool UX work. The UX work and the
quality pipeline shipped; the backend and blog never did and are now
explicitly out of scope (see above).
