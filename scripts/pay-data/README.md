# Pay data and library

The library and both source readers are implemented. The checked-in release is
**titles only**. BLS denied every attempted wage download with HTTP 403 on
November 12, 2026. No real wage file, geography list, or completed crosswalk has
been generated. Do not show invented or fixture wages while these files are absent.

## Refresh the data

```sh
bun install
bun run pay:data
```

The command reads existing inputs before downloading absent files. It tries the
three OEWS ZIPs, then the documented BLS flat-file directory. All downloads use
the User-Agent `5whys-career-studio-data-pipeline`. Normal site builds never run
this command or download data. The only new dependency, `read-excel-file`, is a
devDependency for BLS XLSX parsing. There is no added runtime dependency.

If BLS blocks the command, download these unchanged May 2025 files from the
[BLS table page](https://www.bls.gov/oes/tables.htm) in a browser:

| Input | Download |
| --- | --- |
| `scripts/pay-data/input/oesm25nat.zip` | [National ZIP](https://www.bls.gov/oes/special-requests/oesm25nat.zip) |
| `scripts/pay-data/input/oesm25st.zip` | [State ZIP](https://www.bls.gov/oes/special-requests/oesm25st.zip) |
| `scripts/pay-data/input/oesm25ma.zip` | [Metropolitan and nonmetropolitan ZIP](https://www.bls.gov/oes/special-requests/oesm25ma.zip) |
| `scripts/pay-data/input/db_31_0_csv.zip` | [O*NET 31.0 CSV archive](https://www.onetcenter.org/dl_files/database/db_31_0_csv.zip) |

Then run `bun run pay:data --offline`. `PAY_DATA_INPUT=/absolute/path` selects a
different input directory. Raw inputs are ignored by Git.

Alternatively, place `oe.area`, `oe.occupation`, `oe.datatype`, `oe.footnote`, and
`oe.data.0.Current` from the [BLS flat-file directory](https://download.bls.gov/pub/time.series/oe/)
in the input directory. `oe.data.1.AllData` can replace `oe.data.0.Current`.
These files are mutable upstream. The reader accepts only year 2025 and period
A01, records the exact file hashes, and requires national, state, and area
coverage. Keep the downloaded inputs to reproduce the release. `oe.series` is
not needed because the series identifiers encode the join keys, as documented
in [oe.txt](https://download.bls.gov/pub/time.series/oe/oe.txt).

`bun run pay:data --offline --titles-only` reproduces the current partial release
from the O*NET archive. This mode refuses to replace an existing wage release.
The full command prepares and validates all payloads before replacing the output
directory. Download or validation failure leaves existing output unchanged.

## Outputs and limits

All browser files live in `public/data/pay/`. Every file is compact JSON.
`provenance.json` records source URLs, release and reference dates, date precision,
SHA-256 hashes, licences, actual headers, transformations, units, and attribution.
The O*NET release date is August 2026, with month precision. Title records have
no common observation date, so their reference date is null with an explanation.

| File | Raw bytes | Gzip bytes | Brotli bytes | Gzip limit |
| --- | ---: | ---: | ---: | ---: |
| `onet-31.0-titles-v1.json` | 1,969,640 | 366,180 | 295,579 | 460,800 |
| `provenance.json` | 3,285 | 1,578 | 1,237 | No separate limit |
| `oews-may-2025-national-v1.json` | Not generated | Not measured | Not measured | 51,200 |
| `oews-may-2025-geographies-v1.json` | Not generated | Not measured | Not measured | 30,720 |
| `oews-may-2025-state-<FIPS>-v1.json` | Not generated | Not measured | Not measured | 51,200 each |
| `oews-may-2025-area-<seven-digit-code>-v1.json` | Not generated | Not measured | Not measured | 51,200 each |

The title index has 1,016 occupations and 59,548 deduplicated title pairs,
including official, alternate, short, and reported titles. Source bit masks
preserve every category when a pair occurs in several input lists. Normalization
affects search and deduplication; the original display text stays in the index.

There are two emitted public files, plus 14 other public files. That leaves
19,984 deployment file slots before built assets. The receipt is
`scripts/pay-data/size-receipt.json`. It covers the public payloads, not itself.
That local receipt measures 444 raw bytes, 247 gzip bytes, and 210 Brotli bytes.
It has no browser transfer budget and does not add a deployment file.
The verified build contains 271 files including both pay files, leaving 19,729
deployment slots. This count will change as the lead adds the remaining tools.
Gzip uses level 9; Brotli uses quality 11. An exceeded limit prints the measured
size and fails without truncating data. The proposed next step is a split by
occupation-code prefix and a matching loader change, not removal of rows.

The final wage file count and wage transfer budgets remain unverified until the
BLS download succeeds. The pipeline also refuses a dataset that leaves fewer
than 1,000 deployment slots before built assets.

## Public API

Import from `src/lib/pay/index.ts`. Nothing fetches at import or construction.
No React, DOM, storage, or browser globals are required by the library.

| Function or constant | Contract |
| --- | --- |
| `createPayLoaders(fetcher, basePath?)` | Makes lazy validated loaders with success caching and retry after failure; the base must be an absolute same-origin path. |
| `loaders.loadNational()` | Loads the pinned national wages and explicit O*NET-SOC crosswalk. |
| `loaders.loadTitles()` | Loads the pinned O*NET title index independently of wages. |
| `loaders.loadGeographies()` | Loads the list of valid geography IDs and their parent states. |
| `loaders.loadGeography(id)` | Loads the selected state or area after checking its ID against the list; `national` uses the national loader. |
| `createTitleSearch(index, crosswalk?)` | Prepares normalized titles once and returns a local search function accepting query text and an optional result limit. |
| `normalizeTitle(title)` | Normalizes Unicode, accents, punctuation, whitespace, and case while distinguishing C++ and C#. |
| `lookupPay(options)` | Returns ten percentile figures, separate hourly and annual means, and employment for one occupation and optional geography. |
| `formatPayValue(value, unit?)` | Formats USD, not-published, missing, and at-or-above values; the default unit is annual. |
| `percentileLabel(percentile)` | Names the percentile and labels the median as the 50th percentile. |
| `percentileExplanation(percentile)` | Explains the wage distribution without claims about experience or expected pay. |
| `payAttributions(period?)` | Returns the exact BLS and O*NET credit strings and the links to display with them. |
| `PAY_FILES` | Holds the three fixed national, title, and geography-list filenames. |
| `PAY_PERCENTILES` | Holds the five supported percentile values in display order. |

The search function defaults to 12 candidates and permits up to 50. It ranks
exact official matches, exact alternate matches, exact reported matches, token
prefix matches, then fuzzy token matches. Fuzzy matching allows one insertion,
deletion, substitution, or adjacent transposition per query token of at least
four characters. It returns distinct occupations for ambiguous titles. It does
not return a confidence score. A small matcher avoids another runtime dependency.

Each candidate includes `onetCode`, `title`, `matchedTitle`, `match`, `label`,
`occupationCode`, and `mapping`. Without a crosswalk, `occupationCode` and
`mapping` are null. Do not strip the O*NET suffix and assume the result is a
published wage occupation. Pass the national dataset's crosswalk when available.
Specialties and published SOC broad groups are labeled `broader`. Unmatched
combinations stay `unavailable`; no all-other occupation is guessed.

`lookupPay` takes `{ occupationCode, national, geography?, states?, fallback? }`.
Fallback defaults to false. When true, each missing or not-published figure can
use the supplied parent state, then national data. A published or top-coded
local figure stays local. The function never downloads fallback data itself.
For a cross-state area, supply at most one chosen parent state. Supplying several
throws. All figures carry the actual source place, requested place, fallback
flag, occupation title and code, reference period, and publication date. Means
and employment carry the same source labels.

| Exported type | Meaning |
| --- | --- |
| `PayValue` | Published amount, not-published marker, at-or-above amount, or missing value. |
| `PayUnit` | Hourly or annual USD. |
| `Percentile` | One of 10, 25, 50, 75, or 90. |
| `GeographyLevel` | National, state, or area. |
| `PayPeriod` | Data reference period and publication date. |
| `Geography` | Stable ID, name, level, area kind, and parent state IDs. |
| `WageSeries` | A mean and all five percentile states for one unit. |
| `WageRecord` | Employment plus separate hourly and annual wage series. |
| `WageDataset` | One geography's validated occupation titles and wage records for a pinned period. |
| `NationalDataset` | National wage dataset with the explicit occupation crosswalk. |
| `CrosswalkEntry` | Same-SOC, broader-group, or unavailable mapping with its explanation. |
| `OccupationCrosswalk` | O*NET-SOC codes mapped to crosswalk entries. |
| `TitleOccupation` | Original O*NET-SOC code and official title. |
| `TitleRow` | Display title, occupation-array index, and source bit mask. |
| `TitleIndex` | Validated pinned O*NET occupations and title rows. |
| `TitleMatchKind` | Official, alternate, reported, token, or fuzzy match. |
| `TitleCandidate` | Labeled search result with original title and explicit wage mapping. |
| `PayFigure` | A labeled percentile value with occupation, place, dates, and fallback status. |
| `PayLookup` | Ten percentile figures, both means, and employment for an occupation. |
| `PayFetch` | Injected fetch-like function returning status and unknown JSON. |
| `PayLoaders` | The four on-demand data-loading methods. |

The wire format stores wage columns in the order recorded in provenance. A
positive number means published. Objects with `kind` preserve missing,
not-published, and at-or-above values. Loaders expand arrays into named typed
records. Internal validators and pipeline helpers are not part of the barrel API.

## Attribution to display

Display this BLS line:

> Source: U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025. Published 2026-05-15. Public domain.

Display this O*NET line:

> Occupation titles adapted by 5 Whys Career Studio from the O*NET® 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), under CC BY 4.0. Changes: title normalization, deduplication, and occupation-code mapping. O*NET® is a trademark of USDOL/ETA. USDOL/ETA has not approved, endorsed, or tested these modifications.

Link "O*NET® 31.0 Database" to `https://www.onetcenter.org/database.html`,
"CC BY 4.0" to `https://creativecommons.org/licenses/by/4.0/`, and the change
record to `/data/pay/provenance.json`. The helper returns these links. The
[O*NET licence](https://www.onetcenter.org/license_db.html) requires credit,
the licence link, and identification of modifications. The text also retains
the trademark and non-endorsement notices.

## Verification boundaries

The pay tests cover malformed headers and rows, numeric units, duplicate keys,
percentile ordering, missing and suppressed values, top-coding, source hashes,
title deduplication and ranking, ambiguous real titles, explicit broader-group
mapping, local-only loader URLs, lazy loading, retries, caching, geography
fallback labels, and mixed-release rejection. A source-to-generated-fixture
test asserts that every not-published marker remains explicit and never becomes
zero.

Synthetic XLSX ZIPs and flat files each cover 700 occupations and 551
geographies. They exercise the actual spreadsheet reader and streaming flat-file
reader. Their invented values stay in temporary test directories. They do not
verify the inaccessible real BLS files, their actual footnotes, or their budgets.
Unknown source headers, footnotes, markers, and units fail rather than produce
an approximation. The real O*NET archive and committed title index were verified.

Fresh checks passed on November 12, 2026:

- `bun install`
- `bun run typecheck && bun run lint && bun run test && bun run build`
- `E2E_PORT=4386 bun run test:e2e`

The suite passed all 421 unit tests, including 22 pay tests, and all 36 browser
tests. Typecheck and lint reported no errors. Existing hints and lint warnings
remain outside the assigned files. No interface changed, so no pay UI or visual
review is claimed.

The optional `bun run audit:deps` still fails on unrelated entries: `vite/client`,
`devalue`, `fast-uri`, the `check` binary, and `signalGrade`. It reports no
remaining pay dependency or export findings. Those unrelated files are untouched.

Outside the assigned directories, `package.json`, `bun.lock`, and `knip.json`
change. The manifest adds `pay:data` and the spreadsheet devDependency. Knip
includes the pay scripts in its project and treats the public pay barrel as an
entry point for the lead's upcoming UI. No pages,
components, styles, headers, storage contracts, or deployment settings change.
