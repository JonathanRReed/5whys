# 5 Whys Career Studio

A small studio of four career tools by Jonathan R. Reed, built as a static Astro site with React islands. The premise: find the real reason first, then build the proof. Primary audience is students and early-career people finding their path, but the tools work for anyone doing focused career work.

Everything you write stays in your browser. No accounts, no cookies set by the site, and your work is never sent to a server.

## The four tools

- **Career 5 Whys** (`/career/`): Ask why five times until the answer stops moving. Two tracks, Career Path and Interest Path, with saved snapshots for later comparison.
- **The Resume Game** (`/resume-game/`): Score each bullet for action, result, and measure, then rewrite weak lines with a structured editor.
- **Networking Practice** (`/networking-practice/`): Rehearse introductions against a timer, rate each rep, and keep versions of your intro.
- **Interview Glow Up** (`/5whys/interview-glow-up/`): Decode a job description into the skills it tests, build proof-based stories, and assemble an interview packet.

A career review at `/start/` recommends a starting tool, and `/dashboard/` summarizes saved work across all four.

## Design

Evergreen & Brass direction: a dark Night theme and a light Dawn theme built on deep greens with brass accents, set in Fraunces, Inter, and JetBrains Mono. Color tokens live in `src/styles/globals.css` and are duplicated for the pre-hydration theme script in `public/career-tools-theme.js`. Design intent is documented in `DESIGN.md` and `PRODUCT.md`.

## Tech stack

- Astro 5, static output, with React 19 islands for the interactive tools
- Tailwind CSS 3 for styling
- Bun as package manager and script runner
- Vitest for tests, ESLint and Prettier for lint and format
- Deployed as a static site (Cloudflare Pages), headers in `public/_headers`

## Getting started

```sh
bun install
bun dev
```

The site runs at `http://localhost:4321`.

## Scripts

All commands run from the project root:

| Command                | Description                             |
| :--------------------- | :-------------------------------------- |
| `bun run dev`          | Start the local development server      |
| `bun run build`        | Produce a production build in `./dist/` |
| `bun run preview`      | Preview the production build locally    |
| `bun run test`         | Run the Vitest suite once               |
| `bun run test:watch`   | Run tests in watch mode                 |
| `bun run lint`         | Lint with ESLint                        |
| `bun run lint:fix`     | Lint and autofix                        |
| `bun run typecheck`    | TypeScript check plus `astro check`     |
| `bun run format`       | Format with Prettier                    |
| `bun run format:check` | Check formatting without writing        |
| `bun run astro ...`    | Run Astro CLI commands                  |

## Project structure

```text
/
├── public/                  # Static assets, favicons, _headers, theme + effects scripts
├── src/
│   ├── components/          # React components: one folder per tool, plus shared/ and ui/
│   ├── config/              # Site metadata and structured data (site.ts)
│   ├── data/                # networking-scenarios.json
│   ├── layouts/             # Base.astro (shell, nav, footer, noscript context)
│   ├── lib/                 # localStorage readers, scoring logic, career-bridge.ts
│   ├── pages/               # Astro routes for the tools and site pages
│   ├── styles/              # globals.css (design tokens, both themes)
│   └── utils/               # storage helpers
├── tests/                   # Vitest tests
├── astro.config.mjs
├── DESIGN.md                # Visual direction
├── PRODUCT.md               # Audience, tone, product principles
└── package.json
```

## Privacy model

- All tool data (reflections, resume text, practice sessions, stories) lives in `localStorage` under per-tool keys. Nothing you type is transmitted.
- No accounts, no sign-up, no cookies set by the site.
- Hosting and any analytics at the platform level are disclosed on the site's privacy and subprocessors pages.

## Contributing

Issues and pull requests are welcome. Please open an issue describing your idea or bug before submitting significant changes.

## License

Icons by [Creatype](https://www.flaticon.com/authors/creatype).
This project is released under the MIT License.
