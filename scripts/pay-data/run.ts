import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { payAttributions } from '../../src/lib/pay/format';
import { PAY_FILES } from '../../src/lib/pay/loaders';
import { parseGeographies, parseNationalDataset } from '../../src/lib/pay/validate';
import { readBlsFlat, readBlsZips } from './bls';
import { buildCrosswalk, buildTitleIndex, parseDelimited, records, WAGE_COLUMNS } from './rows';
import { assertSizeBudgets, measureFile } from './sizes';
import { acquire, BLS_ROOT, FLAT_METADATA, ONET_URL, sourceReceipt, ZIP_SOURCES } from './sources';

const root = fileURLToPath(new URL('../../', import.meta.url));
const input = process.env.PAY_DATA_INPUT ?? path.join(root, 'scripts/pay-data/input');
const output = path.join(root, 'public/data/pay');
const offline = process.argv.includes('--offline');
const titlesOnly = process.argv.includes('--titles-only');
const unknownFlags = process.argv
  .slice(2)
  .filter((arg) => !['--offline', '--titles-only'].includes(arg));
if (unknownFlags.length) throw new Error(`Unknown arguments: ${unknownFlags.join(', ')}`);

async function loadTitles() {
  const file = await acquire(input, 'db_31_0_csv.zip', ONET_URL, offline);
  const archive = await JSZip.loadAsync(await readFile(file));
  const schemas: Record<string, string[]> = {};
  async function table(name: string, headers: string[]) {
    const matches = Object.values(archive.files).filter(
      (entry) => entry.name === `db_31_0_csv/${name}`
    );
    if (matches.length !== 1 || !matches[0]) throw new Error(`Expected one O*NET ${name} file`);
    const data = parseDelimited(await matches[0].async('string'));
    schemas[name] = data[0] ?? [];
    return records(data, headers);
  }
  const occupations = await table('occupation_data.csv', [
    'O*NET-SOC Code',
    'Title',
    'Description',
  ]);
  const jobs = await table('job_titles.csv', [
    'O*NET-SOC Code',
    'Title',
    'Job Title',
    'Short Title',
    'Source(s)',
  ]);
  const reported = await table('sample_of_reported_titles.csv', [
    'O*NET-SOC Code',
    'Title',
    'Reported Job Title',
    'Shown in My Next Move',
  ]);
  if (occupations.length < 900 || jobs.length < 50000 || reported.length < 8000)
    throw new Error('O*NET source coverage is incomplete');
  return {
    index: buildTitleIndex(occupations, jobs, reported),
    source: await sourceReceipt(file, ONET_URL, schemas, 'onet'),
  };
}

async function loadWages() {
  const errors: string[] = [];
  const zips: string[] = [];
  for (const name of ZIP_SOURCES) {
    try {
      zips.push(
        await acquire(input, name, `https://www.bls.gov/oes/special-requests/${name}`, offline)
      );
    } catch (error) {
      errors.push(String(error));
    }
  }
  if (zips.length === 3) return readBlsZips(zips);
  let metadataReady = true;
  for (const name of FLAT_METADATA) {
    try {
      await acquire(input, name, BLS_ROOT + name, offline);
    } catch (error) {
      metadataReady = false;
      errors.push(String(error));
    }
  }
  for (const name of ['oe.data.0.Current', 'oe.data.1.AllData']) {
    try {
      const file = await acquire(input, name, BLS_ROOT + name, offline);
      if (metadataReady) return readBlsFlat(input, file);
    } catch (error) {
      errors.push(String(error));
    }
  }
  throw new Error(
    `${errors.join('\n')}\nNo complete BLS source set is available. Download oesm25nat.zip, oesm25st.zip, and oesm25ma.zip from https://www.bls.gov/oes/tables.htm into ${input}, unchanged. Then run bun run pay:data --offline. Alternatively place oe.area, oe.occupation, oe.datatype, oe.footnote, and oe.data.0.Current (or oe.data.1.AllData) from ${BLS_ROOT} in that directory. The flat data must contain year 2025, period A01. No wage outputs have been written.`
  );
}

async function fileCount(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (file === output || entry.name.startsWith('.pay-stage-')) continue;
    count += entry.isDirectory() ? await fileCount(file) : 1;
  }
  return count;
}

async function main() {
  if (titlesOnly) {
    const existing = await readdir(output).catch(() => []);
    if (existing.some((name) => name.startsWith('oews-')))
      throw new Error(
        'Titles-only mode cannot replace an existing wage release. Run the full pipeline.'
      );
  }
  const titles = await loadTitles();
  // Prepare all payloads before replacing any committed output.
  const payloads = new Map<string, unknown>([[PAY_FILES.titles, titles.index]]);
  const sources = [titles.source];
  if (!titlesOnly) {
    const wages = await loadWages();
    sources.push(...wages.sources);
    const national = wages.files.find((file) => file.geography.id === 'national');
    if (!national) throw new Error('Missing national data');
    const crosswalk = buildCrosswalk(
      titles.index.occupations.map(([code]) => code),
      national.occupations
    );
    const nationalWire = { ...national, crosswalk };
    parseNationalDataset(nationalWire);
    payloads.set(PAY_FILES.national, nationalWire);
    const geographies = {
      schemaVersion: 1,
      geographies: wages.files
        .map((file) => file.geography)
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
    parseGeographies(geographies);
    payloads.set(PAY_FILES.geographies, geographies);
    for (const file of wages.files) {
      if (file.geography.id !== 'national')
        payloads.set(`oews-may-2025-${file.geography.id}-v1.json`, file);
    }
  }
  payloads.set('provenance.json', {
    schemaVersion: 1,
    status: titlesOnly ? 'titles-only' : 'complete',
    missing: titlesOnly
      ? ['BLS national, state, and area wages', 'Geography list', 'O*NET-SOC to OEWS crosswalk']
      : [],
    sources,
    changes: [
      'Title pairs deduplicated by Unicode and punctuation normalization. Original display text retained, official titles preferred, all source categories retained as bit masks.',
      'Short titles are included as alternate titles.',
      'Wages retain separate published hourly and annual amounts. No wages are annualized or inferred.',
      'OEWS detailed cross-industry, all-ownership rows only. Aggregate occupation and industry rows excluded.',
      'O*NET specialties map to their published SOC code or its published SOC broad group. Other combinations remain explicitly unavailable.',
    ],
    valueSchema: {
      number: 'Published positive amount',
      'not-published': 'Source marker retained',
      'at-or-above': 'Source marker and published lower bound retained',
      missing: 'Empty source cell or absent flat-file series, never zero',
    },
    wageColumns: WAGE_COLUMNS,
    units: {
      TOT_EMP: 'Workers',
      'H_*': 'USD per hour, cents',
      'A_*': 'USD per year, whole dollars',
    },
    crosswalkRuleSource: 'https://www.bls.gov/oes/oes_ques.htm',
    topCodingSource: 'https://www.bls.gov/oes/oes_ques.htm#qf1',
    topCoding: {
      '#': { hourly: 115, annual: 239200 },
      note: 'Preserved only when the source marks a value. May 2025 can publish specific estimates above these limits.',
    },
    titleSources: {
      1: 'Official occupation title',
      2: 'Alternate or short title',
      4: 'Reported title',
      note: 'Bits combine when a pair occurs in several source lists.',
    },
    attributions: payAttributions(),
  });
  const serialized = [...payloads].map(([name, data]) => ({ name, content: JSON.stringify(data) }));
  const receipts = serialized.map(({ name, content }) => measureFile(name, content));
  // Print measurements even when a limit fails. Never trim rows to meet a budget.
  for (const receipt of receipts) console.log(JSON.stringify(receipt));
  assertSizeBudgets(receipts);
  const otherPublicFiles = await fileCount(path.join(root, 'public'));
  const builtAssets = await access(path.join(root, 'dist'))
    .then(() => fileCount(path.join(root, 'dist')))
    .catch(() => null);
  const receipt = {
    status: titlesOnly ? 'titles-only' : 'complete',
    emittedFiles: payloads.size,
    otherPublicFiles,
    remainingBeforeBuiltAssets: 20000 - payloads.size - otherPublicFiles,
    previousBuildFiles: builtAssets,
    files: receipts,
  };
  if (receipt.remainingBeforeBuiltAssets < 1000)
    throw new Error('Pay data leaves fewer than 1,000 files for built assets');
  await mkdir(path.dirname(output), { recursive: true });
  const stage = await mkdtemp(path.join(path.dirname(output), '.pay-stage-'));
  const backup = `${stage}-previous`;
  let savedPrevious = false;
  try {
    for (const { name, content } of serialized) await writeFile(path.join(stage, name), content);
    try {
      await rename(output, backup);
      savedPrevious = true;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    try {
      await rename(stage, output);
    } catch (error) {
      if (savedPrevious) await rename(backup, output);
      throw error;
    }
    if (savedPrevious) await rm(backup, { recursive: true });
    await writeFile(
      path.join(root, 'scripts/pay-data/size-receipt.json'),
      `${JSON.stringify(receipt, null, 2)}\n`
    );
    console.log(
      `${payloads.size} pay files emitted; ${receipt.remainingBeforeBuiltAssets} deployment slots remain before built assets.`
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
