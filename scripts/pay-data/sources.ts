import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export const BLS_ROOT = 'https://download.bls.gov/pub/time.series/oe/';
export const ONET_URL = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv.zip';
export const ZIP_SOURCES = ['oesm25nat.zip', 'oesm25st.zip', 'oesm25ma.zip'];
export const FLAT_METADATA = ['oe.area', 'oe.occupation', 'oe.datatype', 'oe.footnote'];
export const USER_AGENT = '5whys-career-studio-data-pipeline';

export async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function acquire(
  input: string,
  name: string,
  url: string,
  offline: boolean
): Promise<string> {
  const destination = path.join(input, name);
  try {
    await access(destination);
    return destination;
  } catch {
    /* Download only absent inputs. */
  }
  if (offline) throw new Error(`Missing local source ${destination}`);
  await mkdir(input, { recursive: true });
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  if (response.headers.get('content-type')?.includes('text/html'))
    throw new Error(`${url}: expected data, received HTML`);
  const temporary = `${destination}.partial`;
  const file = await open(temporary, 'w');
  try {
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      await file.writeFile(chunk.value);
    }
    await file.close();
    await rename(temporary, destination);
    return destination;
  } catch (error) {
    await file.close();
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function sourceReceipt(
  file: string,
  url: string,
  schemas: Record<string, string[]>,
  kind: 'bls' | 'onet',
  notes: string[] = []
) {
  return {
    file: path.basename(file),
    url,
    sha256: await sha256(file),
    release: kind === 'bls' ? 'OEWS May 2025' : 'O*NET 31.0',
    releaseDate: kind === 'bls' ? '2026-05-15' : '2026-08',
    releaseDatePrecision: kind === 'bls' ? 'day' : 'month',
    referenceDate: kind === 'bls' ? '2025-05' : null,
    referenceDateNote:
      kind === 'bls'
        ? 'May 2025 wage estimates'
        : 'Title records have no common observation date. August 2026 is the database release month.',
    license: kind === 'bls' ? 'Public domain' : 'CC BY 4.0',
    licenseUrl:
      kind === 'bls'
        ? 'https://www.bls.gov/bls/linksite.htm'
        : 'https://www.onetcenter.org/license_db.html',
    releaseUrl:
      kind === 'bls'
        ? 'https://www.bls.gov/news.release/ocwage.nr0.htm'
        : 'https://www.onetcenter.org/db_releases.html',
    schemas,
    notes,
  };
}
