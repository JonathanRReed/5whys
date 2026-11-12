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
| Posting engine | Opus 5.5 | `src/lib/posting/` |
| Local AI layer | Opus 5.5 | `src/lib/local-ai/` |
| Storage, desk state, backup | Opus 5.5 | `src/lib/local-db/`, `src/lib/application-desk.ts`, `studio-backup.ts` |
| Pay data and lookup | GPT-6.1 Sol | `scripts/pay-data/`, `public/data/pay/`, `src/lib/pay/` |
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

## Open questions for the owner

- A real phone is needed to test hosted voice and transcription; until then
  they are desktop only.
- A preview deploy on Cloudflare is needed to prove model hosting on the free
  plan. Not done without the owner's go-ahead.
