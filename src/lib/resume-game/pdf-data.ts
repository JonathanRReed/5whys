const assets = {
  ...import.meta.glob<string>('/node_modules/pdfjs-dist/cmaps/*.bcmap', {
    query: '?url&inline',
    import: 'default',
  }),
  ...import.meta.glob<string>('/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', {
    query: '?url&inline',
    import: 'default',
  }),
};

type AssetRequest = { kind: string; filename: string };

export function createPdfDataFactory() {
  let assetError: Error | null = null;
  class PdfDataFactory {
    async fetch({ kind, filename }: AssetRequest): Promise<Uint8Array> {
      try {
        const directory =
          kind === 'cMapUrl' ? 'cmaps' : kind === 'standardFontDataUrl' ? 'standard_fonts' : null;
        const load = directory
          ? assets[`/node_modules/pdfjs-dist/${directory}/${filename}`]
          : undefined;
        if (!load) throw new Error('Required PDF text data is unavailable.');
        const uri = await load();
        if (!uri.startsWith('data:') || !uri.includes(';base64,')) {
          throw new Error('Required PDF text data is invalid.');
        }
        const binary = atob(uri.slice(uri.indexOf(',') + 1));
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
      } catch (error) {
        assetError = error instanceof Error ? error : new Error('Could not load PDF text data.');
        throw assetError;
      }
    }
  }
  return { PdfDataFactory, getAssetError: () => assetError };
}
