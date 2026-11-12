import { createHash } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

if (process.env.HOSTED_MODELS !== '1') {
  console.log('Hosted models are off. Set HOSTED_MODELS=1 to fetch them.');
} else {
  const root = resolve(import.meta.dirname, '../..');
  const lock = await Bun.file(`${import.meta.dirname}/models.lock.json`).json();
  const output = `${root}/public/models`;
  const staging = `${output}.staging`;
  const cache = `${import.meta.dirname}/.cache`;
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await mkdir(cache, { recursive: true });
  const files = {};
  const models = { 'whisper-tiny-en': [], kokoro: [] };
  try {
    for (const entry of lock.files) {
      if (
        !/^[\w./-]+$/.test(entry.path) ||
        entry.path.includes('..') ||
        entry.path.startsWith('/') ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
      )
        throw new Error('Invalid model lock.');
      const saved = Bun.file(`${cache}/${entry.sha256}`);
      let bytes;
      if (await saved.exists()) {
        bytes = new Uint8Array(await saved.arrayBuffer());
      } else {
        const response = await fetch(entry.url);
        if (!response.ok) throw new Error(`Model HTTP ${response.status}: ${entry.path}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256)
        throw new Error(`Model integrity failure: ${entry.path}`);
      await Bun.write(saved, bytes);
      const parts = [];
      const chunkSize = 20 * 1024 * 1024;
      for (let offset = 0, i = 0; offset < bytes.length; offset += chunkSize, i++) {
        const path =
          entry.path + (bytes.length > chunkSize ? `.part-${String(i).padStart(4, '0')}` : '');
        const part = bytes.subarray(offset, offset + chunkSize);
        await mkdir(dirname(`${staging}/${path}`), { recursive: true });
        await Bun.write(`${staging}/${path}`, part);
        parts.push({ path, bytes: part.length, sha256: hash(part) });
      }
      files[entry.path] = { bytes: bytes.length, sha256: entry.sha256, parts };
      for (const id of entry.models) models[id].push(entry.path);
    }
    await Bun.write(
      `${staging}/manifest.json`,
      `${JSON.stringify({ version: 1, models, files }, null, 2)}\n`
    );
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    console.log(`Prepared ${lock.files.length} verified model files.`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
