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
- 2026-11-12: resume engine fixes merged (`t3/fix-resume-document-engine`):
  wrapped lines, bullet detection, one repair offer, dates left as written.
- 2026-11-12: posting match in the Resume Game (`PostingMatch`), linked from
  the desk with `?application=<id>`.
- 2026-11-12: Pay page at `/pay/` (Plate VI, madder): on-device title search,
  percentile table (renders once wage files exist), offer worksheet saved per
  application. Not in the nav yet. LAUNCH BLOCKER: do not ship `/pay/`
  without the BLS wage files, or hide the lookup.
- 2026-11-12: spikes finished (`t3/local-ai-relaunch-spikes`, NOT merged; read
  `spikes/REPORT.md` there). Decisions: Whisper tiny.en ships opt-in on
  desktop; Kokoro is too slow live (about 10 s to first audio on an M4 Pro),
  so questions are synthesized ahead of a session; no hosted text model;
  hosted models are off unless `HOSTED_MODELS=1` at build, because a real
  deploy with 163 MB of model chunks is unproven.
- 2026-11-12: navigation now keeps the six tools behind one Tools menu at
  every width; homepage shows six plates and says six tools.
- 2026-11-12: storage panel on the dashboard (`StoragePanel`).
- 2026-11-12: Five Whys offers a model-written follow-up question when the
  browser's own model is ready (`SharperWhy`).
- 2026-11-12: Glow Up can write likely questions on the device; share images
  for `/application/` and `/pay/`; privacy page states what stays on the
  device and how on-device AI works.
- 2026-11-12: guided mode (owner request): `src/lib/guide.ts`, guides in
  `src/lib/guides/`, `shared/GuideCoach` mounted on `/resume-game/` and
  `/application/`. Steps complete by watching the page (`data-guide` hooks).
- 2026-11-12: Letter station gained recipient, sender, a worked example,
  and "skill: proof" scaffolding from requirements marked "have it";
  the full letter is assembled with greeting and sign-off.
- 2026-11-12: speech and hosted model libraries merged
  (`t3/production-speech-model-libraries`; report in `scripts/models/REPORT.md`).
- 2026-11-12: Rehearsal Room at `/interview-glow-up/rehearse/`: questions from
  the decoded role, typed or recorded answers, playback, editable transcript
  (Whisper when hosted and downloaded), counted delivery facts, self-check,
  follow-up question, keep a recording. Linked from the desk and Glow Up.
- 2026-11-12: `speechCapabilities()` no longer probes on-device recognition
  unless asked: `SpeechRecognition.available()` crashed headless Chromium.
- 2026-11-12 12:55: full suite green with builders idle (891 unit, 50 browser,
  2 skipped opt-in model tests). The earlier desk timeout was load.
- 2026-11-12: guides for all six tools merged
  (`t3/add-four-tool-guided-walkthroughs`); sample posting button on the desk
  and in Glow Up (`src/lib/posting/sample.ts`).
- 2026-11-12: homepage working specimen (`HomeSpecimen`); Glow Up story form
  says what is missing before Save; coach hides the "why" line on phones;
  desk Resume station (per-application bullet selection and tailored .docx).

## Tool-flow findings from writing the guides (to fix)

- Networking: a scenario is preselected, so choosing one cannot be detected;
  there is no sample intro; ratings are only detectable through a hint.
- Glow Up: the HUD modal covers the coach.
- Pay: the worksheet is not saved without an application.
- Coach on a phone in OpenDyslexic covers up to about 45% of the screen on
  the longest step. Consider starting collapsed on phones.
- No guide yet for the Rehearsal Room.

## Engine follow-ups to hand back

- 2026-11-12 12:40: the desk browser test timed out twice in the full suite
  (waiting for the Letter tab to be stable) while machine load average was
  over 200 from a parallel builder; it passes alone. RE-RUN THE FULL SUITE
  when the builders are idle before trusting it.
- One browser test failed once after the engine merge and passed on three
  reruns; the failing test was not captured. Watch for a flaky `toBe`.

## In flight (builders, started 2026-11-12)

| Piece | Model | Paths |
| --- | --- | --- |

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
  worksheet print export for the bullets flow;
  Networking rep loop with recording and playback (reuse `createRecorder`,
  `TakeReview` ideas); a guide for the rehearsal room;
  Five Whys: start from an experience, identity statement from own phrases,
  send to a story or intro;
  homepage specimen hero (plates and nav are done);  offline and install;
  DESIGN.md specimen section; README and docs/decisions.md entries for the
  relaunch; llms.txt and sitemap check for the new pages.
- Posting engine noise: plain description sentences can come through as
  unclassified requirements; the student dismisses them.
- The mobile glow-up browser test is slow (8 s) and can time out when
  builders are running in parallel; rerun before treating it as a failure.

## When the build is done (owner's instruction, 2026-11-12)

Run user-story walkthroughs of the finished site for five groups, each led by
an Opus 5.5 agent that may launch Sonnet 5.5 sub-agents (in poteto mode, see
`~/.claude/skills/poteto-mode`) for sub-stories:

1. An opinionated senior web developer and tech reviewer, in the style of
   Theo Browne: judges speed, polish, privacy claims, and engineering taste.
2. A student.
3. Three more chosen by the lead: a career changer after a layoff, a career
   services advisor who would recommend it to students, and a visitor who
   relies on a screen reader and the OpenDyslexic typeface on a phone.

Each walks the built site in a real browser and reports what broke, what
confused them, and what they would change. Fix what they find before the
final pull request.

## Open questions for the owner

- Preview does not serve route-specific headers, so the microphone header is
  simulated in `e2e/rehearsal.spec.ts`. Real microphone use on the deployed
  site is unverified until a preview deploy.

- BLS wage files must be downloaded by hand in a browser into
  `scripts/pay-data/input/` (oesm25nat.zip, oesm25st.zip, oesm25ma.zip from
  https://www.bls.gov/oes/tables.htm), then `bun run pay:data --offline`.
  Until then `/pay/` can ship only the offer worksheet and title search.

- A real phone is needed to test hosted voice and transcription; until then
  they are desktop only.
- A preview deploy on Cloudflare is needed to prove model hosting on the free
  plan. Not done without the owner's go-ahead.
