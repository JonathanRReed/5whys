import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { effectiveHeaders } from '../scripts/models/headers.mjs';

test('downloads Whisper and transcribes generated speech using only this origin', async ({
  page,
}, info) => {
  test.skip(
    process.env.HOSTED_MODELS !== '1' || info.project.name !== 'chromium',
    'Opt-in desktop hosted-model check.'
  );
  test.setTimeout(180_000);
  const directory = await mkdtemp(join(tmpdir(), '5whys-speech-'));
  try {
    const text =
      'I worked with my team to plan a student event. We wrote a checklist and finished the work together.';
    const clip = join(directory, 'speech.wav');
    if (process.platform === 'darwin') {
      execFileSync('say', ['-r', '150', '-o', join(directory, 'speech.aiff'), text]);
      execFileSync('afconvert', [
        '-f',
        'WAVE',
        '-d',
        'LEI16@16000',
        '-c',
        '1',
        join(directory, 'speech.aiff'),
        clip,
      ]);
    } else {
      execFileSync('espeak-ng', ['-s', '150', '-w', clip, text]);
    }
    const files = await readdir('dist/_astro');
    const speech = files.find((name) => /^speech\.[\w-]+\.js$/.test(name));
    const models = (
      await Promise.all(
        files
          .filter((name) => /^models\.[\w-]+\.js$/.test(name))
          .map(async (name) => ({ name, source: await readFile(`dist/_astro/${name}`, 'utf8') }))
      )
    ).find((file) => file.source.includes('as hostedModelsAvailable'))?.name;
    expect(speech).toBeTruthy();
    expect(models).toBeTruthy();
    const requests: string[] = [];
    page.context().on('request', (request) => {
      requests.push(request.url());
    });
    const previewOrigin = new URL(info.project.use.baseURL ?? 'http://localhost:4633').origin;
    await page.context().route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== previewOrigin) {
        await route.abort();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), ...effectiveHeaders(url.pathname) },
      });
    });
    await page.goto('/interview-glow-up/workspace/');
    const origin = new URL(page.url()).origin;
    const result = await page.evaluate(
      async ({ speech, models, encoded }) => {
        const modelApi = await import(`/_astro/${models}`);
        const speechApi = await import(`/_astro/${speech}`);
        if (!(await modelApi.hostedModelsAvailable()))
          throw new Error('Build with HOSTED_MODELS=1 after models:fetch.');
        await modelApi.downloadModel('whisper-tiny-en');
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        return speechApi.transcribe(new Blob([bytes], { type: 'audio/wav' }));
      },
      { speech, models, encoded: (await readFile(clip)).toString('base64') }
    );
    expect(result.text.toLowerCase()).toContain('team');
    expect(result.segments.length).toBeGreaterThan(0);
    expect(
      result.segments.every((s: { start: number; end: number }) => s.start >= 0 && s.end >= s.start)
    ).toBe(true);
    expect(
      requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== origin)
    ).toEqual([]);
    expect(requests.some((url) => url.includes('.part-'))).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
