# 5 Whys Career Studio

Four browser-based career tools by Jonathan R. Reed, mainly for students and people starting their careers. Work through a career decision, improve resume bullets, practice an introduction, or prepare interview stories.

Your work stays in browser `localStorage`. The site has no accounts and sets no cookies. Export everything from the dashboard to move it to another device. Hosting and platform-level analytics are disclosed on the site's privacy and subprocessors pages.

## Tools

| Tool | What it does |
| --- | --- |
| Career 5 Whys, `/career/` | Work through five questions on a Career Path or Interest Path. Save the root reason and a next step. |
| The Resume Game, `/resume-game/` | Score achievement lines for action, result, and measurement. Rewrite weak lines in a structured editor. Headings, contact details, and education do not affect the score. |
| Networking Practice, `/networking-practice/` | Choose from twelve scenarios, draft an introduction, practice with a two-minute timer, and save a self-rating. Drafts save as you type. |
| Interview Glow Up, `/interview-glow-up/` | Identify skills in a job posting, prepare supporting stories, and keep a full-screen reference open during the interview. Stories have three readiness states, not a score. |

Start at `/start/` to save a career profile for tool defaults. `/dashboard/` links saved work to next steps and provides the export.

## Develop

```sh
bun install
bun run dev
```

Open `http://localhost:4321`. The site uses Astro 7, React 19 islands, Tailwind CSS 4, TypeScript 6, and Bun 1.4. GitHub Actions deploys the static build to Cloudflare Workers Static Assets.

Run commands from the repository root:

| Command | Use |
| --- | --- |
| `bun run build` | Build to `dist/` |
| `bun run preview` | Preview the build |
| `bun run test` | Run Vitest once |
| `bun run test:watch` | Watch unit tests |
| `bun run test:e2e` | Run Playwright against built `dist/` |
| `bun run lint` | Run Biome and ESLint for Astro files |
| `bun run lint:fix` | Apply safe lint fixes |
| `bun run typecheck` | Run TypeScript and Astro checks |
| `bun run format` | Format with Biome |
| `bun run audit:deps` | Find unused files, exports, and dependencies with Knip |
| `bun run deploy` | Build and deploy with Wrangler |

## Repository guide

| Path | Contents |
| --- | --- |
| `src/pages/`, `src/layouts/` | Routes and page layout |
| `src/components/` | One React component folder per tool, plus shared UI |
| `src/lib/` | Scoring, profiles, storage, backups, and cross-tool readers |
| `src/lib/studio-backup.ts` | The complete set of tool storage keys |
| `src/config/` | Site metadata, structured data, and build-time Open Graph images |
| `src/data/` | Networking scenarios |
| `src/scripts/`, `src/styles/` | Theme behavior and shared styles |
| `tests/`, `e2e/` | Unit and browser tests |
| `public/` | Assets, headers, redirects, and crawler files |

Night and Dawn themes share the green and brass tokens in `src/styles/globals.css`. Fonts are Fraunces, Inter, and JetBrains Mono. See [DESIGN.md](DESIGN.md), [PRODUCT.md](PRODUCT.md), and the [decision log](docs/decisions.md).

Read [AGENTS.md](AGENTS.md) before contributing. Open an issue before making a large change.

## License

MIT. Icons by [Creatype](https://www.flaticon.com/authors/creatype).
