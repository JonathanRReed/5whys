# Relaunch design: the application desk, honest resume checking, and on-device AI

Date: 2026-11-12. Status: awaiting owner approval. Nothing here is built yet.

Research behind this document was checked on 2026-11-12. Two reports informed
it: a teardown of six reference career tools, and a study of salary data,
on-device models, speech, resume parsing, and front-end libraries. Where a fact
below is marked "unmeasured" or "unverified", the research could not confirm it
and a spike must settle it before the feature is promised.

## Intent

Make 5 Whys Career Studio the best free place for a student or career changer
to get from "I am interested in this job" to "I am ready for the interview".
Every tool should be as capable as current browser technology allows, including
on-device AI, while the project costs nothing to run and nothing the visitor
writes ever leaves their device.

The owner's words: cutting edge in design, tech, and usability; free forever on
the Cloudflare free tier; the current Evergreen and Brass theme stays and
becomes more interactive; everything launches together in one relaunch.

## Goals

1. One place to work a single application end to end. The posting is pasted
   once and every tool uses it.
2. The most honest and most useful resume checker available: it shows what a
   parser extracts, compares the resume with one posting, and repairs problems.
3. On-device AI wherever it helps, with a complete rule-based version
   underneath every AI feature.
4. A private mock interview with a spoken interviewer, local recording, and
   computed delivery facts.
5. Salary context from public wage data, labeled statistically and dated.
6. The Aa menu from the owner's other sites: theme plus three typefaces.
7. More interaction and motion, all of it caused by something the visitor does.

## Non-goals

- A career explorer in the style of Career Dreamer.
- Company-level salary reports, which need a living contribution database.
- Countries other than the US for salary at relaunch.
- Video recording at relaunch. Audio only. (My call; see "Calls made".)
- Accounts, sync, a backend, analytics, a newsletter, a blog.

## Anti-goals

These would make the relaunch a failure even if it works.

- Any "ATS score", "pass rate", or interview probability. No vendor
  documentation supports a universal number, and reference tools that show one
  mislead students.
- AI that invents achievements, numbers, or employers the student did not
  write.
- A model producing any score or rating. Numbers come from rules the student
  can inspect.
- Keyword stuffing advice. A missing term is a prompt to show evidence or plan
  to get it, never a word to paste in.
- Anything that can ever bill the owner.
- A third-party request at runtime made by site code.
- Any mention of the organization whose workshop material inspired several
  features. It asked not to be named. Wording is rewritten in the site's voice.
- A tool that stops working when no model is available.

## Constraints

- Static Astro 7 site, React 19 islands, Tailwind 4, Bun 1.4, deployed to
  Cloudflare Workers Static Assets on the free plan: 25 MiB per file and
  20,000 files per deployment.
- CSP is `default-src 'self'` with `connect-src 'self'`. Microphone and camera
  are disabled site-wide by Permissions-Policy today.
- Existing rules in `AGENTS.md` hold unless this document changes them:
  storage keys are contracts, islands hydrate from empty state, a tool that
  only read storage must not write, no `confirm()`, shadcn primitives restyled
  in place, no em dashes or invented stats in copy.
- Existing saved work in `localStorage` must survive. Old backup files must
  stay importable.
- The suite that passes today (399 unit tests, 36 browser tests) keeps passing.

## Approaches considered

**A. One application desk on shared engines (chosen).** A posting becomes an
application; resume checking, qualifications, cover letter, interview
rehearsal, and pay are stations on it. The four existing tools are upgraded in
place and stay as standalone doors. Three engines (posting, resume document,
local AI) are built once. Trade-off: engines come first, so visible features
land later.

**B. Tool by tool.** Each tool upgraded alone, each new tool a new plate.
Fastest per piece. Rejected because the student pastes the same posting into
several tools, parsing is duplicated, and AI support ends up uneven.

**C. Ground-up rebuild as one installable app.** Rejected because it discards a
tested codebase and risks the fast static pages that work on school laptops.
Two ideas are borrowed from it: the site becomes installable and usable
offline, and large local data moves to IndexedDB.

The owner chose A ("do what you think would lead to the best product").

## Site structure

Six numbered plates. I to IV keep their names, numerals, and accents.

| Plate | Name | Route | What changes |
| --- | --- | --- | --- |
| I, Reflect | The Five Whys | `/career/` | Start from an experience; assemble a statement from your own phrases; optional follow-up question from a local model. |
| II, Prove | The Resume Game | `/resume-game/` | Gains the machine view, the posting match, and the fixer with export. |
| III, Rehearse | Networking Practice | `/networking-practice/` | Rep loop with local recording and playback; prompts from the focused application. |
| IV, Prepare | Interview Glow Up | `/interview-glow-up/` | Competency view; the rehearsal room; coverage counted from packed stories. |
| V, Apply | The Application Desk | `/application/` | New. The spine: posting, qualifications, bullets, cover letter, before-you-send. |
| VI, Weigh | Pay | `/pay/` | New. Wage percentiles and an offer worksheet. |

Two new accents are added to the palette for V and VI. They must stay inside
the warm green and earth family (no blue). Proposed: a lichen yellow-green and
a rosewood. Exact values are a design decision made in `globals.css` during the
build and checked for contrast in Night and Dawn.

The dashboard stays the home for a returning visitor and lists applications,
each opening its desk.

### The application desk

An application already exists as a thin record (`career-applications`) linked
to a decoded Glow Up role. The desk is a new page that walks one application
through stations. Stations are not a forced sequence; each shows its own state
and the desk recommends the next one.

1. **Posting.** Paste once. The posting engine splits it into required,
   preferred, and responsibility lines, and leaves ambiguous lines unclassified
   until the student sorts them. Every requirement keeps its source sentence.
   The student confirms, dismisses, or adds requirements. Vague phrases become
   optional questions to ask the employer, never claims about hidden intent.
2. **Qualifications.** One row per confirmed requirement: have it, not yet, or
   maybe; then how the student will show it or get it. Below the table, a short
   action plan of dated steps. Steps with dates appear on the dashboard.
3. **Bullets.** The guided flow: pick one experience (a class project, a job, a
   club, anything), say what happened because of it, then write two bullets in
   the Resume Game editor against the requirements they answer, then a short
   reflection on why these bullets fit this role. Exports as a one-page
   worksheet through the print stylesheet.
4. **Resume.** Opens the Resume Game with this posting attached (see below).
5. **Letter and messages.** Four parts: name the role with a hook, why you,
   why them, a closing ask. A rule flags the generic opener ("I am writing to
   apply for"). From the finished opener the desk derives a LinkedIn message, a
   follow-up email, and an intro-call opener: templates by rule, rewrites by a
   local model when one is available.
6. **Before you send.** A checklist where the computable items are computed:
   the company and role names in the letter match the application, the letter
   fits one page, it uses words from the posting, it ends with an ask. "Someone
   else has read it" is a box the student ticks.
7. **Interview.** Links to the Glow Up packet and the rehearsal room for this
   role.
8. **Pay.** The wage lookup for this role and place, and the offer worksheet.

## The three engines

All three are pure TypeScript in `src/lib/`, covered by Vitest, with no React.

### Posting engine (`src/lib/posting/`)

Grows out of `glowup-banks.ts` (`extractRequirementLines`,
`detectSkillsFromText`, `getRepeatedTerms`). Adds: section type per line,
source spans so the UI can highlight the sentence, alias-aware term matching,
and a dictionary of vague phrases mapped to employer questions. The existing
40-line cap is revisited. `DecodedRole` and `DecodedBullet` in
`interview-glow-up-data` gain optional fields with load-time defaults, so the
storage key does not change.

Dataset: O*NET 31.0 job titles and software skills (CC BY 4.0) as lazily
loaded static JSON, with the required attribution and change notice on the
site and stored beside the data.

### Resume document engine (`src/lib/resume-doc/`)

Today `pdf-extractor.ts` returns plain text and throws the geometry away, and
DOCX extraction strips XML with regular expressions and ignores headers and
footers. The engine keeps a structured `ResumeDoc`: pages, lines with bounding
boxes and font names, detected sections, parsed contact fields, and findings.
Existing scoring keeps consuming the plain text it derives.

PDF checks, each worded as what our extractor saw, never as a verdict:

| Check | Method | Claim shown |
| --- | --- | --- |
| File size | Exact | "This file is X MB." Greenhouse documents a 2.5 MB parsing limit; cited as one vendor's limit. |
| Page count | Exact | "X pages." |
| No extractable text | Text items against image operators | "We could not read text on page N." |
| Multiple columns | Clustering of text boxes and gutters | "This looks like columns. Check the order below." |
| Reading order | Extraction order against geometry | The plain-text preview itself. |
| Contact near page edge | Top and bottom regions, repetition across pages | "Your contact details sit near the page edge." |
| Section headings | Match against standard terms | "No heading we recognize for experience." |
| Contact fields | Parse email, phone, links | What was found and what was not. |
| Spaced-out letters, unmapped characters | Text heuristics | The offending line, quoted. |
| Date consistency | Pattern comparison | The mixed formats, quoted. |

DOCX: parse the XML properly, including headers, footers, tables, and text
boxes, reusing JSZip. Add Mammoth only if the hand parser proves unreliable.

Detector accuracy is unmeasured. Each detector ships with fixture resumes
(single column, two column, sidebar, table-based, image-only, header contact)
and its false-positive behavior is recorded in tests before the wording is
finalized.

### Local AI layer (`src/lib/local-ai/`)

One interface, three tiers, chosen by feature detection at the moment the
student asks for help. No tier ever runs without a click.

- **Tier 0, rules.** Always present. Every AI task has a rule-based version:
  templates, dictionaries, the existing suggestion engine.
- **Tier 1, the browser's own model.** Chrome's Prompt API (`LanguageModel`,
  stable since Chrome 148 on desktop). Used when `availability()` returns
  `available`. When it returns `downloadable`, the UI offers to let the browser
  fetch its own model and says plainly that the browser downloads it from its
  vendor and that the student's writing still stays on the device. Edge's
  equivalent is preview-only today and is picked up by the same detection when
  it ships. Safari and Firefox have no equivalent.
- **Tier 2, models we host.** Small models served from our own origin, split
  into chunks under the 25 MiB limit and reassembled by a loader we write.
  Used for voice (Kokoro), transcription (Whisper tiny.en, about 41 MB
  quantized), and, only if the spike below passes, a small text model through
  WebLLM for browsers with WebGPU and no built-in model.

Tasks: rewrite a bullet, ask a follow-up why, list likely interview questions,
derive message variants from an opener, translate plain wording into a
posting's terms, ask an interview follow-up.

Guards, enforced in code and tested:

- **No invention.** A rewrite that contains a number, a proper noun, or a tool
  name absent from the student's own text is rejected or shown with the new
  claim struck and flagged.
- **No scores.** The layer has no task that returns a number.
- **Labeled.** Generated text carries "Written on this device" and is never
  merged into the student's text without an explicit accept.
- **Fail closed.** Any error, missing API, or unavailable model falls back to
  Tier 0 silently. There is no cloud fallback.

The existing copy-and-paste prompt for likely questions stays as the path for
visitors with no model.

## The resume checker and fixer (Plate II)

Three views over one imported resume.

1. **Machine view.** The resume beside what the extractor read, line by line
   in reading order, with findings pinned to the lines they concern. This is
   the signature screen of the relaunch (see Design).
2. **Match.** Needs a posting. For each requirement the student confirmed:
   the source sentence, the matching resume excerpt if one exists, and its
   state. The summary is a count with a visible denominator: "7 of 11
   confirmed requirements have evidence in your resume." A missing requirement
   offers two paths: "I have this" opens the bullet editor against that
   requirement; "Not yet" adds it to the qualifications plan.
3. **Fix.** Every finding has a repair: reorder into one column, move contact
   details into the body, rename a heading, normalize dates, rewrite a weak
   line (rules always, local model when available). Repairs apply to the
   site's structured copy of the resume, never to the uploaded file.

**One resume, tailored per application.** The earlier decision stands: there
is one master resume, not one per application. Repairs apply to the master.
Bullets written in an application's Bullets station are added to the master
and remembered as written for that application. The match is never stored; it
is computed live from the master and the application's confirmed
requirements. Each application keeps only a selection: which of the master's
bullets to include when exporting for that role. The dashboard's global resume
readiness keeps its meaning.

**Export.** A clean single-column resume built from the structured copy and
the application's selection: PDF through a print stylesheet (real selectable
text, no dependency) and DOCX written as minimal OOXML with JSZip. The fix
list is also exportable for students who would rather edit their own document.

**Round trip.** "Zero findings" means zero document-reading findings; an
export cannot fix weak writing or missing evidence. The DOCX export is checked
in the browser automatically, because the site holds the bytes it wrote, and
the student is told the result. A printed PDF never returns to the page, so
the print template is proven by an automated browser test (print to PDF, run
the extractor, expect zero findings), and the student is offered "Check the
PDF you saved" by dropping it back in.

Findings are grouped as document reading, bullet writing, and role coverage.
The Resume Game's overlapping scores are consolidated and each is labeled as
an editorial rubric with its components shown. The word-based page estimate is
replaced by the real page count when a file was imported.

**Same work, wrong words.** A translator inside the bullet editor: a plain
phrase ("I helped with the rollout") beside the terms a posting uses for that
work. An authored dictionary in the student register drives it; a local model
extends it when available. It suggests vocabulary for work the student did. It
does not suggest claiming work they did not do.

## The rehearsal room (Plate IV, and Plate III's rep loop)

- **Questions** come from the packet for the chosen role and the existing
  question bank, one at a time. With a local model, a follow-up question can
  respond to the answer.
- **Voice.** Default: the browser's speech synthesis, restricted to voices
  with `localService === true`; if none exists the question is shown only.
  Opt-in: a neural voice (Kokoro) downloaded once from our origin after a
  button that states the size. Fallback for devices without WebGPU: a smaller
  model, decided by the spike.
- **Answering.** Typed (no permission needed) or spoken. Spoken answers are
  recorded with MediaRecorder as audio, held in memory, and saved to IndexedDB
  only when the student keeps the take. Every take can be deleted.
- **Transcript.** Only on-device: `SpeechRecognition` with
  `processLocally = true` where the browser supports it (Chrome 139 and later
  on desktop, Firefox 160), else Whisper tiny.en from our origin, opt-in. If
  neither is available there is no transcript, and the room still offers
  recording, playback, and self-review. The student can correct a transcript.
- **Delivery facts.** Answer length, words per minute, counted filler words,
  and pauses over a stated threshold, each shown as a count with timestamps to
  replay. No targets presented as standards: research found none that are
  validated. The one cited guide is that structured answers commonly run one
  to two minutes. Nothing infers confidence, personality, or emotion.
- **Self-review.** A checklist per competency: what a strong answer shows and
  a common mistake, authored as content beside the question bank.
- **Readiness** stays the three-state story readiness. A rep count is a count.

Headers change for these routes only: microphone allowed for same origin on
the rehearsal and networking pages, `media-src 'self' blob:`, and
`worker-src 'self' blob:`. Camera stays disabled.

## Pay (Plate VI)

- **Data.** BLS OEWS, May 2025 release (published 2026-05-15), public domain,
  credited. National file loads when the page opens; one small file per state
  or metro area loads on selection. Proposed budgets, to be measured: national
  under 50 KiB gzip, title index under 450 KiB, any one geography under 50 KiB.
- **Title matching.** O*NET job titles, searched in the browser with a small
  fuzzy matcher (uFuzzy, about 4 KB). Ambiguous titles return several
  occupations and the student picks. The typed title never goes in a URL.
- **Labels.** "10th percentile", "25th percentile", "median", and so on, with
  occupation, place, and data year beside every figure. A lower percentile is
  never called a starting salary. Suppressed values show as not published,
  never zero.
- **Offer worksheet.** Base, guaranteed bonus, variable pay, hours, and stated
  assumptions, normalized to hourly and annual. Saved on the application with
  the source and date.
- **Pipeline.** A script fetches pinned releases, validates headers, units,
  and suppression flags, records source, dates, hash, and licence, and fails
  the build if a budget is exceeded.

## Upgrades to the other tools

- **Five Whys.** Optional start from a concrete experience. An editable
  statement assembled from phrases the student selects from their own answers.
  Send an experience to a story draft or an intro. With a model, the next
  "why" responds to the last answer.
- **Networking Practice.** Question, spoken attempt, playback, self-check,
  retry. The previous take and the one chosen fix are shown before the next
  rep. Prompts can come from the focused application.
- **Interview Glow Up.** One competency view joining the posting sentence, the
  skill, a likely question, what a strong answer shows, a common mistake, and
  the student's story. Coverage for a packet counts packed stories and their
  readiness; the existing vault-wide gap list keeps its meaning.
- **Dashboard.** Applications with their next station, dated action steps, and
  "one small thing today" chosen from real gaps. No time estimate is attached,
  because the site computes none. A short resource shelf lists a few
  job boards.

## Design

The identity stays: Evergreen and Brass, the field guide, numbered plates,
Fraunces over Inter. The relaunch pushes the field-guide idea further instead
of replacing it.

- **Signature: the specimen.** A posting or a resume is shown as a specimen
  sheet, the way a field guide shows a leaf with labels pinned to its parts.
  Findings and requirements are callouts attached to the exact line they
  concern. This is the one bold element; everything around it stays quiet.
- **Motion only answers an action.** Decoding a posting lifts its phrases into
  requirement tags. Attaching a story fills its row in the qualifications
  table. Accepting a rewrite morphs the old line into the new one. These use
  CSS and the View Transitions API, with ordinary rendering as the fallback and
  reduced motion respected. A small Motion import is allowed only for an
  interaction CSS cannot do.
- **Navigation between pages** uses native cross-document view transitions
  where supported, so the plate numeral and the application's name carry
  across. No client router.
- **One orchestrated homepage moment**: a real, working specimen in the hero
  that a visitor can try, replacing a described feature list.
- **The Aa menu** is ported from the owner's other sites (source:
  `~/Downloads/HWC-Site/src/components/layout/PreferencesMenu.tsx` and the
  fonts in that site's `public/fonts/`). It replaces the theme toggle in
  `Navigation`. Theme: Night, Dawn. Typeface: the default (Fraunces headings,
  Inter body, JetBrains Mono labels); Nebula Sans for readability; and
  OpenDyslexic. The two alternatives replace headings, body, and labels alike.
  Fonts are self-hosted under the SIL Open Font License. The
  boot script applies the saved typeface before paint, as it does the theme.
  Every screen is checked in all three typefaces, because OpenDyslexic is wide
  and has caused overflow on the owner's other sites.
- **Layout.** Left-aligned throughout. The desk is a two-pane sheet on wide
  screens (specimen left, work right) and a single column with a station
  switcher on phones.
- **Copy** stays spare, sentence case, no exclamation marks, no em dashes, and
  every number computed.

`DESIGN.md` is updated: motion may now show a change the visitor caused (not
only hover, focus, and loading), the two new accents, the specimen pattern,
and the three typefaces.

## Storage, offline, and privacy

- Small data stays in `localStorage` under existing keys. New keys are added
  to `career-bridge.ts` and `studio-backup.ts` in the same commit.
- IndexedDB holds recordings, the structured resume, the original resume
  file, and downloaded models (through the Cache API). Media never goes in
  `localStorage`.
- Desk state lives under one new key, `career-application-desk`, keyed by
  application id: qualifications rows, the action plan, the bullets-flow
  answers, the letter and message variants, checklist ticks, the offer
  worksheet, and the resume bullet selection. `career-applications` stays
  thin, as decided on 2026-09-11.
- Every application on the desk has a decoded role. The Posting station
  creates and links one when missing. The Glow Up decode screen stays as a
  second way in and edits the same record through the same engine.
- The backup file version is bumped and the backup becomes asynchronous so it
  can read IndexedDB. It includes the structured resume (text, with applied
  repairs) so a repaired resume moves between devices. It excludes the
  original resume file, recordings, and models; the export dialog says so, and
  on a new device the machine view asks for the file again to show the
  side-by-side. Old backups import unchanged.
- The typeface preference is a device preference like the theme: its own key,
  applied by the boot script, not part of the backup.
- A "Storage" panel in the Aa menu shows what is stored on the device and its
  size, and deletes models and recordings.
- A service worker caches the static shell so the tools open offline, and a
  web manifest makes the site installable. Model chunks are cached only after
  an opt-in download.
- Privacy copy is rewritten to say exactly what is true: nothing you write
  leaves your device; models we offer download from this site; if you choose
  your browser's own model, your browser downloads it from its maker.
- CSP additions, each verified at runtime before merging: `'wasm-unsafe-eval'`
  in `script-src`, `media-src 'self' blob:`, `worker-src 'self' blob:`.

## Model hosting on the free tier

The live site is currently served by the Cloudflare Pages Git integration
(the Workers deploy job in CI is skipped because its secrets are not set, and
the custom domain is still attached to Pages). Pages has the same 25 MiB and
20,000 file limits. The relaunch does not depend on moving the domain: build
scripts must run under whichever platform builds `main`, and spike 1 tests
that platform. Wage and title data are small enough to generate once and
commit; only model files are fetched at build time.

A build script downloads pinned model files, verifies their SHA-256, splits
any file over 20 MiB into numbered chunks, and writes them with a manifest into
the build output. Model files are never committed to git. A loader fetches the
chunks from our origin and reassembles them; for Transformers.js this is a
custom fetch with `allowRemoteModels` off and the ONNX runtime files hosted
locally.

## Spikes before anything is promised

Each is throwaway code that answers one question. A failed spike removes or
downgrades the feature; it does not block the relaunch. The pass lines below
are the lead's proposals; the owner sees each result and has the final say.

1. **Free-tier hosting.** Pass: a preview deployment carrying the chunked
   model files succeeds on the free plan of the platform that builds `main`,
   and fetching models adds no more than three minutes to a build. Fail:
   hosted models are dropped and AI is Tier 0 and Tier 1 only.
2. **Chunked loading under our CSP.** Pass: Whisper tiny.en and Kokoro load
   and run from our origin with the headers above in current Chrome, Safari,
   and Firefox, with no request to another origin.
3. **Small text model quality.** Thirty synthetic student bullets, authored
   for the test in the style of the repository's sample resume (no real
   student data). The owner and the lead read the rewrites. Pass: at least 24
   of 30 are judged better than the original and none slips an invented claim
   past the guard. Fail: Tier 2 text generation is dropped and text AI is
   Tier 1 only.
4. **Speed on weak devices.** Pass on a low-end laptop: a model is ready
   within 20 seconds of a cached load, transcription takes no longer than the
   recording, and a spoken question starts within 3 seconds. Phones need a
   real device from the owner. Until phone results exist, hosted voice and
   transcription are offered on desktop only and hidden on phones.
5. **Column detector accuracy.** Pass: no false positive on the single-column
   fixtures and every multi-column and sidebar fixture flagged.

## Shipping

- All work lands on one long-lived `relaunch` branch, cut from
  `revamp/applications-spine`. `main` and the live site do not change until
  the end.
- Each piece is built on its own branch and merged into `relaunch` after the
  full check suite passes. `main` is merged into `relaunch` regularly.
- One final pull request to `main`, opened when everything is done and
  verified. The owner merges it. That merge is the launch.

Order on the relaunch branch:

0. Foundation: the Aa menu; `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` updates;
   headers; IndexedDB store; backup version; the local AI layer with Tier 0
   and Tier 1; the spikes.
1. Posting engine, the application desk shell, qualifications.
2. Resume document engine, machine view, match, fix, export, round trip.
3. Bullets flow, letter and messages, before-you-send.
4. Rehearsal room: voice, recording, transcript, delivery facts.
5. Pay: data pipeline, lookup, offer worksheet.
6. Five Whys and Networking upgrades, dashboard, homepage, motion pass,
   offline and install.
7. Hardening: accessibility, performance budgets, one browser flow per
   station, Night and Dawn, phone width, all three typefaces.

## Who builds what

- Design and every user-facing surface: the lead session (Claude Fable 5.2).
- Feature logic and tests behind interfaces the lead defines: Claude Opus 5.5
  at high effort.
- Data pipelines, PDF geometry, speech and model plumbing, and research:
  GPT-6.1 Sol at high effort.

## Verification

For every piece: `bun run typecheck && bun run lint && bun run test &&
bun run build`, then `bun run test:e2e`. Visual work is checked in Night and
Dawn, at phone width, in three typefaces, with reduced motion on. Privacy is
checked by a browser test that fails if any page makes a request to another
origin.

## Calls made on the owner's behalf

The owner said "do whatever is best" on these. Each can be struck.

1. The fixer both lists fixes and exports a clean resume file.
2. Audio only in the rehearsal room at relaunch; no camera.
3. US wage data only.
4. Chrome's built-in model may be offered even when the browser must download
   it from Google first, with that stated on the button.
5. A model never returns a score.
6. Every tool works fully with no model.
7. No model downloads without a button that states the size.
8. Two new accent colors for plates V and VI.
9. The workshop-derived features are rewritten in the site's voice with no
   attribution.
10. Pull requests are opened for the owner to merge; nothing is merged to
    `main` by an agent.
11. One master resume with a per-application bullet selection, not a resume
    per application.
12. The backup carries the structured resume but not the original file,
    recordings, or models.
13. Hosted voice and transcription are desktop-only until tested on a real
    phone.
14. The relaunch stays on whichever Cloudflare platform builds `main` today;
    moving the domain to Workers is not part of it.
15. The spike pass lines above.

## Left to the builder

Exact accent values, component breakdown, file names inside each engine, the
wording of each finding, the content of the vague-phrase and wrong-words
dictionaries, the question-bank guidance notes, and the test fixture resumes.
