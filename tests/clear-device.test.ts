import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { clearDevice } from '../src/lib/clear-device';
import {
  closeLocalDb,
  countRecordings,
  getResumeDoc,
  saveRecording,
  saveResumeDoc,
} from '../src/lib/local-db';

afterEach(async () => {
  window.localStorage.clear();
  await closeLocalDb();
});

it('removes everything a visitor wrote and keeps only display preferences', async () => {
  window.localStorage.setItem('career-tools-theme', 'dawn');
  window.localStorage.setItem('career-tools-font', 'dyslexic');
  window.localStorage.setItem(
    'networking-practice-draft',
    'Hi, I am Maria. My number is 555-0187.'
  );
  window.localStorage.setItem('career-why-session-v2', '{"topic":"private"}');
  window.localStorage.setItem('career-tools-guides', '{}');
  await saveResumeDoc({ name: 'Maria' });
  await saveRecording({
    tool: 'networking-practice',
    question: 'intro',
    durationMs: 1000,
    audio: new Blob([new Uint8Array(64)], { type: 'audio/webm' }),
  });

  const result = await clearDevice();

  expect(result.complete).toBe(true);
  expect(result.removedKeys).toBe(3);
  expect(Object.keys(window.localStorage).sort()).toEqual([
    'career-tools-font',
    'career-tools-theme',
  ]);
  expect(await getResumeDoc()).toBeNull();
  expect(await countRecordings()).toBe(0);
});
