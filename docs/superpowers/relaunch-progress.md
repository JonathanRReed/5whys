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
- 2026-11-12: Networking Practice can record a rep and play it back
  (`networking/RepRecorder`). Full suite green: 895 unit, 64 browser.
- 2026-11-12: offline use and install merged
  (`t3/installable-offline-career-studio`): generated manifest and icons, a
  hand-written service worker (precache 314 files, 12.4 MB), `src/lib/offline.ts`,
  and `UpdateNotice` in the layout. Installed-app behavior on real phones and
  deployed headers are unverified.
- 2026-11-12: built-in voice choice fixed after the owner heard a novelty
  voice during tests: `src/lib/speech/voices.ts` ranks local voices and never
  auto-picks joke voices; read-aloud is off by default with a voice picker
  and a sample; Playwright runs with `--mute-audio`.
- 2026-11-12: bullets worksheet print (`shared/PrintSheet`); Rehearsal Room
  guide; coach is a one-line bar on phones and folds after each step; the
  scroll-to-top button hides while the coach is open on a phone.
- Suite: 916 unit, 72 browser, 2 skipped.

## Tool-flow findings from writing the guides (to fix)

- Networking: a scenario is preselected, so choosing one cannot be detected;
  there is no sample intro; ratings are only detectable through a hint.
- Glow Up: the HUD modal covers the coach.
- Pay: the worksheet is not saved without an application.

## Engine follow-ups to hand back

- 2026-11-12 12:40: the desk browser test timed out twice in the full suite
  (waiting for the Letter tab to be stable) while machine load average was
  over 200 from a parallel builder; it passes alone. RE-RUN THE FULL SUITE
  when the builders are idle before trusting it.
- One browser test failed once after the engine merge and passed on three
  reruns; the failing test was not captured. Watch for a flaky `toBe`.

## User-story walkthroughs (started 2026-11-12 13:30)

Five Opus 5.5 reviewers, each with up to four Sonnet 5.5 sub-agents in poteto
mode, review-only, each in its own worktree and port (4701 to 4705). Reports
land in the session scratchpad under `stories/`: `dev.md`, `student.md`,
`changer.md`, `advisor.md`, `access.md`. When they report: triage, fix what
is real, rerun the suite, then the final pull request.

### Student report (in), fixed so far

Send checks (role named without season, placeholder check, generic hook is
not reused for messages); qualifications tally; browser-model download copy;
invented time estimates removed; guide bar stacks on phones and opens when
turned on; scenario select wraps; homepage demo button waits until live and
the box does not scroll inside the page on phones; Pay starts from the
application's title and searches intern titles by occupation; the desk's
Resume station accepts a pasted resume.

### Student report, still to do (batch with the other four reports)

1. Resume Game: eight overlapping numbers; honest student lines score 0 to
   11; "Aim for 80+"; share card for a low score; structured rewrite builds
   broken sentences ("to so", verb prepended to a verb); inflated verb
   suggestions ("Built" for working a register, "Enabled" for helped);
   "posted" not recognized as a verb; corporate placeholders; exports are a
   report, not a resume (label them).
2. Posting engine: closing and admin lines ("Application closes...",
   "reviewed on a rolling basis") filed as preferred; plain company
   description sentences come back as requirements; "Confirm all" should
   cover Required and Preferred only.
3. /start: no "I found a posting" answer leading to the desk; lists three of
   six tools; assumes a resume exists. Homepage primary action leads to the
   Five Whys only.
4. Five Whys: summary and dashboard use the final answer as the "root
   reason" even when it is the vaguest; add "choose the answer that is the
   real reason"; start from an experience.
5. Glow Up: engineer-register copy ("Decode the JD", JWT sample, "revenue
   impact", "Panic-proof HUD"); "What this job tests" percentages add to more
   than 100; repeated phrases count the employer's name.
6. Vocabulary a student would not know (see the report's table): Plate,
   Hidden value, Signal, OCR, HUD, Packet, percentile, Subprocessors.
7. Pay cannot ship without wage data (owner).

### Career changer report (in)

Fixed by the lead: Pay worksheet (parsing, validation, overtime, side by
side), company short name in the send check, wrapping export button.

Handed to builders (running, branch names in their reports):
- Posting match and sorter (Opus): false and missed evidence, alternatives,
  years of experience, `findNearMisses` for "same work, wrong words",
  non-requirement lines, Confirm all, partial state.
- Resume Game honesty (Opus): one score with parts, fair scoring, verbs,
  sentence builder, PDF text into the editor, examples by profile, exports.
- Interview content (Opus): questions from real requirements, questions by
  audience (layoff, career change), own stories offered, skill tagging,
  counts instead of percentages, plain register.

Still for the lead after those merge:
- Restyle the near-miss and partial rows; wire "I have this: write a bullet"
  to carry the requirement, and add desk bullets to the master resume.
- Dashboard: show each application's next station from desk state; list all
  six tools. /start: an "I found a posting" answer and all six tools.
- Examples and placeholders by profile on the desk (letter example, bullets
  placeholders, new-application placeholders).
- Five Whys: choose which answer is the real reason; start from an
  experience.
- Pay: save the wage source with the offer once wage data exists; title
  search ranks badly for coordinator titles (check after data lands).

### Career advisor report (the lead reviewer ended without a final report;
its four sub-reports are in `stories/advisor/`: factcheck.md, privacy.md,
bias.md, workshop.md)

Fixed by the lead: coach portalled to body (its buttons were dead under the
footer on 1366x768 and iPads), folds on small screens, announces each step,
moves focus on "Show me where", keeps focus when a step changes, and opens
from `?guide=1`; "Clear everything on this device" (`src/lib/clear-device.ts`)
with a shared-computer warning on the dashboard and privacy page; backup
plain-text warning; `img-src` no longer allows other sites.

Still to do from the advisor (after the three fix builders merge):
- Resume: "stronger verb" table inflates roles (Championed, Drove,
  Engineered); page estimate from word count is wrong and calls two pages
  optimal for students; numeric "Target" lines; dates earn "measure" credit;
  retail, food, childcare verbs score as no action verb; visa or declaration
  lines scored as bullets; buzzword check flags real technical terms. (Check
  what the Resume Game builder already covered, then follow up.)
- Desk: eligibility and legally sensitive lines (work authorization, "native
  speaker", criminal record, age proxies, lifting) shown as qualifications to
  "have" or "get". They need their own treatment: a condition, not a skill,
  with a plain note and no "plan to get".
- Interview: "Write the Proof first. If the receipt is weak, the story needs
  a different example" is bad advice; delivery counts cannot be turned off
  and typed answers are counted; timers assume fast fluent speech.
- Letter: 400 words called "one page" (use about 350 and say it is a guide);
  LinkedIn note written to 300 characters (free accounts allow fewer: write
  to 200); a first message should not ask a stranger for time.
- Gaps: work authorization and international students; employment gaps;
  thank-you note and follow-up timing; guided mode is hard to find (homepage
  and /start do not mention it; link tools with `?guide=1`).
- Privacy page: say whether analytics is on (owner must confirm in the
  Cloudflare dashboard); subprocessors page says Pages and analytics.
- Resume Game opened directly shows the professional sample, not a student
  one (student register first).

### Developer report (in: `stories/dev.md`)

Privacy claim verified by the reviewer: over 23,000 requests, none to another
origin, no CSP violations under production headers.

Fixed by the lead: guide bar is server-rendered (it popped in, layout shift
0.22 on the desk); "thank you" no longer passes as an ask; "I'm writing to"
is caught as a generic opener; the analytics host is gone from the CSP.

With a builder (GPT): precache diet (12.5 MB on first visit), reuse of
unchanged assets across deploys, readable failure when a lazy part is not
downloaded, backup import validation, size cap, double-submit guard, and the
"what the backup leaves out" sentence.

Still to do after the fix builders merge:
- DOCX upload scores nothing (old extractor flattens it): verify the Resume
  Game builder's `toEditorText` path fixed it; remove the duplicate readers.
- A visitor with only recordings gets the empty dashboard and no Storage
  panel (`hasData` in `career-bridge.ts` ignores recordings and desk work).
- On-device AI honesty: no component calls `recognizeOnDevice` or
  `translateWording`; the invented-claim guard misses claims without digits
  ("doubling weekly visitors"); say plainly on the site that suggestions are
  rules unless the browser has a model.
- JSZip loads up front on the desk and Resume Game: import it on demand.
- `<ClientRouter />` is in the layout although the design says no client
  router; knip (`bun run audit:deps`) fails; `RehearsalRoom` has 22 state
  hooks (split it); the coach polls every 500 ms (acceptable, revisit).
- Lighthouse mobile performance: 78 home, 86 Resume Game, 68 desk.
- Subprocessors page still describes Cloudflare Web Analytics; the CSP now
  blocks it. Owner to confirm analytics is off, then correct that page.

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
  
  Five Whys: start from an experience, identity statement from own phrases,
  send to a story or intro;
  homepage specimen hero (plates and nav are done);
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
