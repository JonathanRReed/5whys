export const MODEL_IDS = ['whisper-tiny-en', 'kokoro'] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export interface ModelPart {
  path: string;
  bytes: number;
  sha256: string;
}
export interface ModelFile {
  bytes: number;
  sha256: string;
  parts: ModelPart[];
}
export interface ModelManifest {
  version: 1;
  models: Record<ModelId, string[]>;
  files: Record<string, ModelFile>;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const path = (v: unknown): v is string =>
  typeof v === 'string' && /^[\w./-]+$/.test(v) && !v.includes('..') && !v.startsWith('/');
const bytes = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 256 * 1024 * 1024;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

/** Validate transport metadata before allocating buffers or constructing URLs. */
export function parseManifest(value: unknown): ModelManifest {
  if (!record(value) || value.version !== 1 || !record(value.models) || !record(value.files))
    throw new Error('Invalid model manifest.');
  const files: Record<string, ModelFile> = {};
  for (const [key, file] of Object.entries(value.files)) {
    if (
      !path(key) ||
      !record(file) ||
      !bytes(file.bytes) ||
      !hash(file.sha256) ||
      !Array.isArray(file.parts) ||
      !file.parts.length
    )
      throw new Error('Invalid model file.');
    const parts: ModelPart[] = file.parts.map((part: unknown) => {
      if (
        !record(part) ||
        !path(part.path) ||
        !bytes(part.bytes) ||
        part.bytes > 20 * 1024 * 1024 ||
        !hash(part.sha256)
      )
        throw new Error('Invalid model chunk.');
      return { path: part.path, bytes: part.bytes, sha256: part.sha256 };
    });
    if (
      parts.reduce((n, p) => n + p.bytes, 0) !== file.bytes ||
      new Set(parts.map((p) => p.path)).size !== parts.length
    )
      throw new Error('Invalid chunk sizes.');
    files[key] = { bytes: file.bytes, sha256: file.sha256, parts };
  }
  const models = {} as Record<ModelId, string[]>;
  for (const id of MODEL_IDS) {
    const paths = value.models[id];
    if (
      !Array.isArray(paths) ||
      !paths.length ||
      !paths.every((p) => path(p) && Object.hasOwn(files, p)) ||
      new Set(paths).size !== paths.length
    )
      throw new Error('Invalid model catalogue.');
    models[id] = paths;
  }
  return { version: 1, models, files };
}

export async function sha256(data: Uint8Array<ArrayBuffer>): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
