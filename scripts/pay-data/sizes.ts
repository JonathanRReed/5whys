import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export function measureFile(name: string, content: string) {
  const bytes = Buffer.from(content);
  const budget = name.includes('titles-')
    ? 450 * 1024
    : name.includes('geographies-')
      ? 30 * 1024
      : name.startsWith('oews-')
        ? 50 * 1024
        : null;
  return {
    file: name,
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    gzipBudget: budget,
  };
}

export function assertSizeBudgets(receipts: ReturnType<typeof measureFile>[]) {
  const failures = receipts.filter(
    (receipt) => receipt.gzipBudget !== null && receipt.gzip > receipt.gzipBudget
  );
  if (failures.length)
    throw new Error(
      failures
        .map(
          (receipt) =>
            `${receipt.file}: ${receipt.gzip} gzip bytes exceeds ${receipt.gzipBudget}. Split by occupation-code prefix, retain every row, and update the loaders before publication.`
        )
        .join('\n')
    );
}
