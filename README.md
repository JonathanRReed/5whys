# 5 Whys Career Studio

A small studio of four career tools by Jonathan R. Reed, built as a static Astro site with React islands. The premise: find the real reason first, then build the proof. Primary audience is students and early-career people finding their path, but the tools work for anyone doing focused career work.

Everything you write stays in your browser. No accounts, no cookies set by the site, and your work is never sent to a server. One export on the dashboard moves it all to another device.

## The four tools

- **Career 5 Whys** (`/career/`): Ask why five times until the answer stops moving. Two tracks, Career Path and Interest Path, with saved snapshots that carry the root reason and a concrete next step.
- **The Resume Game** (`/resume-game/`): Paste a resume, whole or bullets only. Achievement lines are scored for action, result, and measure exactly as written; headings, contact lines, and education are recognized and left out. Rewrite weak lines with a structured editor and watch the score move.
- **Networking Practice** (`/networking-practice/`): Pick one of twelve scenarios, draft the intro in your own words, run it against a two-minute timer, rate it, and keep every rep. The draft saves as you type.
- **Interview Glow Up** (`/interview-glow-up/`): Decode a job posting into the skills it tests, build proof-based stories with a three-state readiness, and pack the best ones for the call. A full-screen HUD shows the packet during the interview.

A two-question career review at `/start/` saves a profile the tools read for defaults, and `/dashboard/` turns saved work into next actions and links.

## Design

Evergreen & Brass direction: a dark Night theme and a light Dawn theme built on deep greens with brass accents, set in Fraunces, Inter, and JetBrains Mono. The palette lives once in `src/styles/globals.css` as named Tailwind tokens. Design intent is documented in `DESIGN.md` and `PRODUCT.md`; the reasoning behind non-obvious choices is in `docs/decisions.md`.

## Tech stack

- Astro 7, static output, with React 19 islands for the interactive tools
- Tailwind CSS 4 through the Vite plugin, tokens in an inline `@theme` block
- TypeScript 6, Bun 1.4 as package manager and script runner
- Biome for formatting and linting; ESLint 10 with the Astro plugin for `.astro` files
- Vitest for unit tests, Playwright for one end-to-end flow per surface
- Open Graph images rendered at build time with satori and resvg
- Deployed to Cloudflare Workers Static Assets from GitHub Actions

## Getting started

```sh
bun install
bun run dev
```

The site runs at `http://localhost:4321`.

## Scripts

All commands run from the project root:

| Command               | Description                                              |
| :-------------------- | :------------------------------------------------------- |
| `bun run dev`         | Start the local development server                       |
| `bun run build`       | Produce a production build in `./dist/`                  |
| `bun run preview`     | Preview the production build locally                     |
| `bun run test`        | Run the Vitest unit suite once                           |
| `bun run test:watch`  | Run unit tests in watch mode                             |
| `bun run test:e2e`    | Run the Playwright flows against a built `dist/`         |
| `bun run lint`        | Biome check plus ESLint on `.astro` files                |
| `bun run lint:fix`    | Same, applying safe fixes                                |
| `bun run typecheck`   | TypeScript check plus `astro check`                      |
| `bun run format`      | Format with Biome                                        |
| `bun run audit:deps`  | Find unused files, exports, and dependencies with knip   |
| `bun run deploy`      | Build and deploy to Cloudflare Workers with wrangler     |

## Project structure

```text
/
├── public/                  # Static assets, favicons, _headers, _redirects, robots, llms.txt
├── src/
│   ├── components/          # React components: one folder per tool, plus shared/ and ui/
│   ├── config/              # Site metadata, structured data, OG image definitions
│   ├── data/                # networking-scenarios.json
│   ├── layouts/             # Base.astro (shell, nav, footer, noscript context)
│   ├── lib/                 # Scoring logic, storage readers, profile, backup, career-bridge
│   ├── pages/               # Astro routes, including the build-time OG image endpoint
│   ├── scripts/             # Theme boot script (inlined) and the reveal script
│   ├── styles/              # globals.css: design tokens, both themes, utilities
│   └── utils/               # Networking storage helpers
├── tests/                   # Vitest unit tests
├── e2e/                     # Playwright flows
├── docs/decisions.md        # Dated decision log
├── AGENTS.md                # Working rules for agents and contributors
├── DESIGN.md                # Visual direction
├── PRODUCT.md               # Audience, tone, product principles
└── wrangler.jsonc           # Cloudflare Workers Static Assets config
```

## Privacy model

- All tool data lives in `localStorage` under per-tool keys listed in `src/lib/studio-backup.ts`. Nothing you type is transmitted.
- No accounts, no sign-up, no cookies set by the site.
- Hosting and any platform-level analytics are disclosed on the site's privacy and subprocessors pages.

## Contributing

Issues and pull requests are welcome. Read `AGENTS.md` first; it lists the rules that are easy to break. Please open an issue describing your idea or bug before submitting significant changes.

## License

Icons by [Creatype](https://www.flaticon.com/authors/creatype).
This project is released under the MIT License.
