# Relaunch progress

Working note for the relaunch loop. The approved design is
`docs/superpowers/specs/2026-11-12-relaunch-design.md`. Update this file at the
end of every working pass. Delete it in the final pull request.

## Rules of the loop

- All work lands on the local `relaunch` branch. Nothing is pushed and no pull
  request is opened until the owner asks or the project is finished. The final
  pull request to `main` is opened for the owner to merge.
- Builders work in their own worktrees and commit on their own branches. The
  lead reviews each report, merges the branch into `relaunch`, and runs
  typecheck, lint, unit tests, build, and browser tests before moving on.
- The lead (Claude Fable 5.2) does all design and user interface. Opus 5.5 at
  high effort builds feature logic. GPT-6.1 Sol at high effort does data,
  PDF geometry, speech and model plumbing, and research.
- No deploys to Cloudflare without asking the owner.
- Browser tests: run with `E2E_PORT=<free port>`; stop any leftover preview
  with `bunx astro preview stop` first.

## Done

- 2026-11-12: local work rebased onto origin/main (`revamp/applications-spine`).
- 2026-11-12: design approved by the owner.
- 2026-11-12: Aa display menu (theme, three typefaces), on `relaunch`.
- 2026-11-12: AGENTS.md and DESIGN.md updated with relaunch rules.

- 2026-11-12: resume document engine merged (`t3/resume-document-engine`).
- 2026-11-12: machine view in the Resume Game (import, findings, repairs,
  clean DOCX with read-back check, print to PDF), with browser tests.
- 2026-11-12: local AI layer merged (`t3/local-ai-layer`); storage, desk state
  and async backup merged (`t3/relaunch-local-storage-application-desk`).
- 2026-11-12: structured resume persists in IndexedDB; rewrite help in the
  bullet editor (`RewriteHelp`, `shared/AiText`); on-device AI status in the
  Aa menu.
- 2026-11-12: pay library and pipeline merged (`t3/pay-data-pipeline-and-library`).
  Titles index is committed. Wage data is NOT: BLS returns 403 to every
  automated download (curl, pipeline, headless browser).
- 2026-11-12: posting engine merged (`t3/relaunch-posting-engine`).
- 2026-11-12: Application Desk at `/application/` (Plate V): posting specimen
  with editable requirements and questions to ask, qualifications with resume
  evidence and an action plan, the two-bullet flow, letter with the three
  message variants, before-you-send checks (`src/lib/desk-checks.ts`). Nav
  link "Apply". Shared `src/lib/view-transition.ts`. Browser test added.

## Engine follow-ups to hand back

- Resume engine: a wrapped bullet's second line is kept as its own line, and
  bullets from browser-printed PDFs (glyph in a separate text item) are not
  marked as bullets, so the clean export loses them. Join continuation lines
  and detect bullet glyph items.
- Resume engine: two findings (columns, reading order) offer the same repair;
  consider merging them into one finding.
- Machine view: persist the structured resume once the storage library lands;
  add the posting match and rewrite hooks.

## In flight (builders, started 2026-11-12)

| Piece | Model | Paths |
| --- | --- | --- |
| Resume engine follow-up (bullets, wrapped lines) | GPT-6.1 Sol | `src/lib/resume-doc/` |
| Model hosting and speech spikes | GPT-6.1 Sol | `spikes/`, `scripts/models/` |

## Next for the lead

1. Two new accents (plates V and VI), six-plate navigation and homepage plates.
2. As each engine lands: merge, verify, then build its interface.
   - Posting engine + desk state: the Application Desk page (`/application/`).
   - Resume engine: machine view, match, fix, export in the Resume Game.
   - Local AI: capability panel in the Aa menu, rewrite and follow-up hooks.
   - Pay: `/pay/` page and the offer worksheet.
   - Spikes: decide hosted voice and transcription; then the rehearsal room.
3. Five Whys and Networking upgrades, dashboard, homepage specimen hero,
   motion pass, offline and install, privacy copy.
4. Hardening pass and the final pull request.

## Notes for the lead

- Desk APIs: `src/lib/application-desk.ts` (state per application, pay
  equivalents, `deleteApplication`), `src/lib/local-db` (recordings, resume
  file and doc, `storageReport`), `src/lib/local-ai` (six tasks, each returns
  `AiResult` with `source` and `inventedClaims`).
- `ApplicationsPanel` remove text should also say desk work is deleted.
- Backup import has no double-click guard.
- `rules.ts` in local-ai imports from `components/career-5whys/shared.ts`;
  move the pure helpers into `src/lib` when touching Five Whys.
- Still to build (lead): dashboard links into the desk and dated steps;
  desk resume station (per-application bullet selection and export); posting
  match inside the Resume Game; worksheet print export for the bullets flow;
  Storage panel; `/pay/` (worksheet and title search now, wages when data
  arrives); rehearsal room (after spikes); Five Whys and Networking upgrades;
  homepage with six plates and the specimen hero; offline and install;
  privacy copy; DESIGN.md specimen section.
- Posting engine noise: plain description sentences can come through as
  unclassified requirements; the student dismisses them.
- The mobile glow-up browser test is slow (8 s) and can time out when
  builders are running in parallel; rerun before treating it as a failure.

## Open questions for the owner

- BLS wage files must be downloaded by hand in a browser into
  `scripts/pay-data/input/` (oesm25nat.zip, oesm25st.zip, oesm25ma.zip from
  https://www.bls.gov/oes/tables.htm), then `bun run pay:data --offline`.
  Until then `/pay/` can ship only the offer worksheet and title search.

- A real phone is needed to test hosted voice and transcription; until then
  they are desktop only.
- A preview deploy on Cloudflare is needed to prove model hosting on the free
  plan. Not done without the owner's go-ahead.
