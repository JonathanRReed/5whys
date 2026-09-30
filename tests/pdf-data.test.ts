// @vitest-environment node
import { expect, it } from 'vitest';
import { createPdfDataFactory } from '../src/lib/resume-game/pdf-data';

it('loads packaged PDF maps and standard fonts without filesystem or remote fetches', async () => {
  const { PdfDataFactory, getAssetError } = createPdfDataFactory();
  const factory = new PdfDataFactory();
  expect((await factory.fetch({ kind: 'cMapUrl', filename: '90ms-RKSJ-H.bcmap' })).length).toBeGreaterThan(0);
  expect((await factory.fetch({ kind: 'standardFontDataUrl', filename: 'LiberationSans-Regular.ttf' })).length).toBeGreaterThan(0);
  expect(getAssetError()).toBeNull();
});

it('records missing resource errors per import instead of allowing unnoticed partial text', async () => {
  const first = createPdfDataFactory();
  const second = createPdfDataFactory();
  await expect(new first.PdfDataFactory().fetch({ kind: 'cMapUrl', filename: '../../private' })).rejects.toThrow('unavailable');
  expect(first.getAssetError()).toBeInstanceOf(Error);
  expect(second.getAssetError()).toBeNull();
});
