# 5 Whys Career Studio

Six browser-based career tools by Jonathan R. Reed, for students and people changing careers. Work through a career decision, improve a resume, practice an introduction, prepare for an interview, take one job posting from decoding to a sent application, and put an offer into plain terms.

Everything you write stays on your device: `localStorage` for small data, IndexedDB for recordings and your resume file. The site has no accounts, sets no cookies, loads no analytics script, and makes no third-party requests. Export everything from the dashboard to move it to another device. Hosting is disclosed on the site's privacy and subprocessors pages.

## Tools

| Tool | What it does |
| --- | --- |
| Career 5 Whys, `/career/` | Work through five questions on a Career Path or Interest Path. Choose which answer is the real reason, and save it with a next step. |
| The Resume Game, `/resume-game/` | Score achievement lines for action, result, and measurement, and rewrite weak ones. Upload a PDF or Word file to see it the way a parser reads it, repair what breaks, and export a clean copy. Match the resume against a posting, requirement by requirement. There is no "ATS score". |
| Networking Practice, `/networking-practice/` | Choose from twelve scenarios, draft an introduction, practice with a timer, record a rep and play it back, and save a self-rating. |
| Interview Glow Up, `/interview-glow-up/` | Identify skills in a job posting, prepare supporting stories, and rehearse likely questions out loud or in writing in the Rehearsal Room. Stories have three readiness states, not a score. |
| Application Desk, `/application/` | One posting, six stations: decode it, mark where you stand on each requirement, write two bullets, tailor the resume, draft the letter and messages, and check it before you send. |
| Pay, `/pay/` | Look up a job title and put an offer into hourly, weekly, and yearly terms. |

Start at `/start/` to save a career profile for tool defaults. `/dashboard/` tracks applications, shows desk progress and dated steps, measures what is stored on the device, and provides the export. Every tool has a guided mode (`?guide=1`) that walks a first-timer through it.

Suggestions come from rules that run in the page. If the browser has its own built-in model, the visitor can choose to use it; nothing is downloaded without a button that says so, and a model never produces a score. The site works offline once visited and can be installed.

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
| `docs/superpowers/specs/` | The relaunch design |
| `src/scripts/`, `src/styles/` | Theme behavior and shared styles |
| `tests/`, `e2e/` | Unit and browser tests |
| `public/` | Assets, headers, redirects, and crawler files |

Night and Dawn themes share the green and brass tokens in `src/styles/globals.css`. Fonts are Fraunces, Inter, and JetBrains Mono, with Nebula Sans and OpenDyslexic offered in the Aa menu. All are self-hosted. See [DESIGN.md](DESIGN.md), [PRODUCT.md](PRODUCT.md), and the [decision log](docs/decisions.md).

Read [AGENTS.md](AGENTS.md) before contributing. Open an issue before making a large change.

## License

MIT. Icons by [Creatype](https://www.flaticon.com/authors/creatype).
