# Speech and hosted model libraries

Branch: `t3/production-speech-model-libraries`, based on `relaunch` at
`ab61f2a16f93e2731866574079ce39de2f326df7`. The handoff message names the commit.
No spike branch was merged. No spike evidence, fixtures, or runners were copied.
No components, pages, styles, text-model registry, or storage contracts changed.

## Hosting

Hosting is off by default. `bun run models:fetch` does nothing without
`HOSTED_MODELS=1`. A normal build removes generated `public/models/` before
Astro copies public assets. It never downloads models.

To prepare an opt-in local build:

```sh
HOSTED_MODELS=1 bun run models:fetch
HOSTED_MODELS=1 bun run build
bunx astro preview stop
HOSTED_MODELS=1 E2E_PORT=4633 bun run test:e2e -- e2e/hosted-speech.spec.ts --project=chromium --workers=1
```

The lock pins every source URL, size, and SHA-256. Downloads and existing script
cache entries are verified. Files above 20 MiB are split into verified chunks.
The manifest and chunks go in ignored `public/models/`; verified source bytes
stay in ignored `scripts/models/.cache/`. No model bytes are committed.

The catalogue derives these download sizes from the generated manifest:

| Model | Bytes, including its single-threaded WASM runtime |
| --- | ---: |
| Whisper tiny.en, q8 | 70,398,151 |
| Kokoro, q8, af_heart voice | 119,748,787 |

Each model has its own revision cache under the existing `models-` prefix.
The shared runtime is counted and stored in each model cache, so either model
works independently. `storageReport` and `deleteModels` already recognize this
prefix. No new localStorage key exists.

`downloadModel` is the only public model-byte network operation. It verifies
chunk sizes and hashes, then the assembled file hash, before writing to Cache
Storage. Aborted or failed downloads remove their partial cache. The runtime
fetch hook reads only listed, cached files and rejects other URLs. It never
fetches a missing file. Transformers.js remote models and internal caches are
disabled. Kokoro's pinned adapter replaces its remote voice URL and removes its
separate voice cache. Text generation stays with the existing browser model
and rules; `registerHostedProvider` is untouched.

Callers should hide hosted features unless `hostedModelsAvailable()` resolves
true and `hostedModelsSupported().supported` is true. Read the catalogue to
show the actual download size before calling `downloadModel`. Transcription
and voice preparation require `ready` and never download models themselves.

## Public model exports

Import from `src/lib/models/index.ts`.

| Export | Description |
| --- | --- |
| `hostedModelsAvailable()` | Makes one memoized manifest request and returns false for missing or invalid metadata. |
| `hostedModelCatalogue()` | Returns typed model names, purposes, and manifest-derived byte sizes. |
| `hostedModelsSupported()` | Checks desktop device signals, secure context, storage, worker, crypto, WASM, and audio APIs. |
| `getModelState(id)` | Reports hosting, download activity, and complete cache readiness. |
| `downloadModel(id, options)` | Downloads and verifies same-origin chunks with byte progress and cancellation. |
| `deleteModel(id)` | Cancels a pending download and removes all cached revisions of that model. |
| `createModelFetch(id)` | Creates the cache-only, same-origin fetch hook used inside speech workers. |
| `ModelId` | The `whisper-tiny-en` and `kokoro` identifiers. |
| `ModelState` | The `not-hosted`, `not-downloaded`, `downloading`, and `ready` states. |
| `ModelProgress` | Loaded and total download bytes. |
| `DownloadOptions` | An optional AbortSignal and byte-progress callback. |
| `HostedModel` | Catalogue metadata with a display name, purpose, and download size. |
| `HostedModelSupport` | A support result with a typed refusal reason. |
| `ModelError` | An error carrying a `ModelErrorReason`. |
| `ModelErrorReason` | Hosting, support, readiness, concurrency, integrity, network, and cancellation reasons. |

## Public speech exports

Import from `src/lib/speech/index.ts`.

| Export | Description |
| --- | --- |
| `speechCapabilities()` | Detects local voices, local recognition, recorder MIME support, and WebGPU presence. |
| `speakBuiltIn(text, options)` | Speaks through a local voice only, with voice selection and cancellation. |
| `recognizeOnDevice(options)` | Recognizes English only after an available check and with `processLocally` true. |
| `createRecorder(options)` | Returns an in-memory audio recorder with optional microphone levels. |
| `transcribe(blob, options)` | Decodes, averages channels, resamples to 16 kHz, and runs Whisper in a worker. |
| `prepareSpokenQuestions(texts, options)` | Prepares distinct session questions in one Kokoro worker and returns their audio blobs. |
| `playAudio(blob, options)` | Plays a blob and revokes its object URL on completion, error, or cancellation. |
| `deliveryFacts(input)` | Counts words, pace, fillers, and gaps between spoken segments without a rating. |
| `DEFAULT_FILLERS` | Default single-word fillers and separately labelled context-dependent phrases. |
| `SpeechCapabilities` | Detected local voice, recognition, recorder, and GPU capabilities. |
| `RecognitionState` | The `available`, `downloadable`, and `unsupported` recognition states. |
| `SpeakOptions` | An optional local voice URI and AbortSignal. |
| `RecognitionOptions` | An optional partial-transcript callback and AbortSignal. |
| `SpeechError` | An error carrying a `SpeechErrorReason`. |
| `SpeechErrorReason` | Typed capability, permission, device, capture, playback, inference, and cancellation reasons. |
| `RecordedAudio` | The recorded blob, actual MIME type, and elapsed capture duration. |
| `RecorderOptions` | An optional microphone-level callback receiving values from zero to one. |
| `SpeechRecorder` | The asynchronous `start`, asynchronous `stop`, and synchronous `cancel` methods. |
| `Transcript` | Transcript text and timed segments. |
| `TranscriptSegment` | Segment text with start and end times in seconds. |
| `TranscribeOptions` | An optional processing-progress callback and AbortSignal. |
| `SpeechProgress` | Loading, transcription, or synthesis progress with completed and total units. |
| `PrepareQuestionsOptions` | An optional preparation-progress callback and AbortSignal. |
| `PreparedQuestions` | A Map from each exact question text to its audio blob. |
| `DeliveryFactsInput` | Text, duration, optional timed segments, pause threshold, and filler definitions. |
| `DeliveryFacts` | Word count, duration, nullable words per minute, filler counts, and internal pauses. |
| `FillerDefinition` | A phrase and its context-dependent label. |
| `FillerCount` | A filler definition with its count and occurrences. |
| `FillerOccurrence` | A word index and optional containing-segment timestamps. |

Recorder tracks stop on stop, cancellation, capture errors, and late permission
resolution after cancellation. Audio stays in memory; the caller chooses
whether to save a take through the existing recordings store. Playback and
built-in speech support cancellation. Inference workers terminate after each
job, failure, or cancellation. Kokoro prepares the whole question list ahead
of rehearsal; it is not a live voice path.

Words per minute is null below five seconds or without words. Filler locations
use the containing segment's boundaries, not estimated word times. Locations
are null without aligned timed text, including after a transcript edit. Pauses
exclude leading and trailing silence and must exceed the supplied threshold.
All reported numbers are counts or durations derived from the supplied data.

## Internal module exports

These support the public libraries and their tests; interfaces should use the
two index modules above.

| Export | Description |
| --- | --- |
| `MODEL_IDS` | The two supported model identifiers. |
| `ModelPart` | A transport chunk's relative path, size, and hash. |
| `ModelFile` | An assembled file's size, hash, and ordered chunks. |
| `ModelManifest` | Versioned model membership and verified transport metadata. |
| `parseManifest(value)` | Validates manifest paths, sizes, hashes, and model membership. |
| `sha256(bytes)` | Computes a lowercase SHA-256 digest through Web Crypto. |
| `LocalRecognition` | The local recognizer instance contract used by detection and capture. |
| `RecognitionConstructor` | The recognizer constructor and its local availability method. |
| `recognitionConstructor()` | Selects the standard or prefixed browser recognition constructor. |
| `onDeviceRecognitionState()` | Checks English local recognition without starting or installing it. |
| `localVoices()` | Waits up to one second for voices and returns local services only. |
| `recorderMimeType()` | Selects a supported audio MIME type or returns null. |
| `checkSignal(signal)` | Throws the typed speech cancellation error for an aborted signal. |
| `localSpeechRuntime()` | Creates the guarded Vite adapters and eager-import/WASM build checks. |
| `speechLibraries()` | Emits library entries and removes generated model assets when hosting is off. |
| `effectiveHeaders(path, source)` | Parses matching Cloudflare rules, including header detach operations. |
| `previewHeaders()` | Supplies the global headers Astro preview can serve. |

## Headers

| Scope and change | Reason |
| --- | --- |
| `/interview-glow-up/*` and `/networking-practice/*`: detach and replace Permissions-Policy with `microphone=(self)` | Allows same-origin rehearsal capture while keeping camera, geolocation, and payment disabled. |
| Those routes: detach and replace CSP, adding `'wasm-unsafe-eval'` to script-src | Allows the local WASM runtime to compile. |
| Those routes: add `media-src 'self' blob:` | Allows recorded and prepared audio playback. |
| Those routes: add `worker-src 'self' blob:` | Allows local speech workers. |
| `/_astro/speech-worker-*`: detach and replace CSP, adding `'wasm-unsafe-eval'` | A worker executes under its own response policy; the page policy alone is insufficient. |

Ordinary routes retain the original policy and microphone denial. Camera stays
disabled everywhere. No COOP or COEP headers were added. WASM uses one thread,
as verified in the spike and in the production Whisper check here.

Cloudflare merges matching rules. Each replaced policy uses `! Name` first.
Tests parse the file and assert complete effective policies for `/`,
`/interview-glow-up/workspace/`, `/networking-practice/`, and a speech worker.

Astro preview supports global `server.headers` and discards user Vite preview
plugins. Preview therefore uses the speech CSP globally, keeps microphone
denied globally, and disables HTTP caching. It does not reproduce the
route-specific microphone policy. The opt-in browser test applies the parsed
production headers to page and worker responses before running transcription.
A deployed Cloudflare response remains unverified.

## Build output

The default build contains no `models/` directory and no WASM files. No HTML
page references either new library entry. The build traverses static imports
from entries and fails if Transformers.js or Kokoro enters that graph; worker
package imports remain dynamic. ONNX's unused WASM URL fallbacks are adapted
so Vite cannot copy unchunked binaries into `_astro/`.

These are raw bytes from the final default build, not transfer measurements:

| Lazy output | Bytes |
| --- | ---: |
| `speech.BmTVhXMQ.js` | 10,080 |
| `models.CYc8f0Zj.js`, public entry | 271 |
| `models.C9NEpJew.js`, model implementation | 5,957 |
| `models.ujb9ROJW.js`, shared storage code | 2,353 |
| `speech-worker-105pWSFh.js` | 4,526 |
| `transformers.web-zGcyd-Nb.js` | 495,426 |
| `kokoro-Ct0nQKUY.js`, including phonemizer | 1,329,834 |
| `speech-ort-DXIbolS2.mjs`, executable runtime module | 53,057 |

The executable runtime module is library code, not model weights. It is loaded
only by a triggered speech worker. Its installed bytes are hash-pinned by the
build adapter. The WASM binary is in the opt-in model manifest instead.

## Verification

Fresh default-off checks passed:

- `bun install`.
- `bun run typecheck && bun run lint && bun run test && bun run build`.
- `bunx astro preview stop; E2E_PORT=4633 bun run test:e2e`.
- 873 unit tests across 75 files; 44 browser tests passed, with the two
  desktop/mobile opt-in model cases skipped as intended.
- The checker reports eight existing hints. Lint reports seventeen existing
  warnings. No new-file lint finding remains.
- Build inspection confirmed no model files, no WASM, and no HTML references
  to the speech or model library entries.

The 54 added unit cases cover manifest handling, reassembly, chunk and assembled
hash failures, oversized and truncated responses, model states, concurrent
downloads, cancellation, external cache deletion, desktop gating, local speech
capabilities, voice waiting and remote-voice refusal, recorder cleanup and
levels, audio channel averaging and resampling setup, worker cancellation,
question deduplication, object URL cleanup, delivery facts, build adapters,
and effective header policies.

An additional opt-in Chromium run downloaded Whisper from the local preview,
transcribed newly generated English speech, returned timed segments, and
asserted that every observed HTTP request used the preview origin. It passed
with the parsed production headers applied to page and worker responses.
The clip is generated in a temporary directory with macOS `say` and
`afconvert`, or `espeak-ng` on other systems. Nothing is committed as a fixture.

A separate local Chromium check downloaded Kokoro through the production API
and prepared two questions. It returned nonempty WAV blobs of 225,644 and
148,844 bytes. Every observed HTTP request stayed on the preview origin.
This checked synthesis and returned audio, not audible playback or latency.

## Minimal configuration edits

- `package.json`: pinned Transformers.js 4.3.2 and Kokoro 1.2.1, the
  `models:fetch` command, and the spike-verified Transformers override for
  Kokoro's declared 3.x dependency. Bun also reordered the existing
  `pdfjs-dist` entry without changing its version.
- `bun.lock`: records these dependencies and their required packages.
- `.gitignore`: excludes generated models, staging output, and the script cache.
- `knip.json`: declares the two public library entries and model scripts.
- `astro.config.mjs`: configures module workers, the guarded runtime adapters,
  library entry emission, default-off model removal, and preview headers.

## Unverified

No deploy, hosted-model free-tier qualification, or Cloudflare response check
was performed. Production-library inference was tested in local Chromium,
not installed Safari, Firefox, low-end laptops, or physical phones/tablets.
Hosted speech remains desktop-only. Browser-suite mobile profiles are
emulations and do not qualify real phones.

Real microphone permissions, hardware recording, audible local voices,
on-device recognition with an installed language pack, audible prepared
playback, and durable Safari cache behavior remain unverified. Their local
API paths have fake-based tests. No claim about real interview transcription
accuracy or inference latency follows from the synthetic clip.
