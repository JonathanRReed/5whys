import { expect, it } from 'vitest';
import { bestVoice, isNoveltyVoice, rankVoices, type VoiceLike } from '../src/lib/speech';

const voice = (name: string, lang = 'en-US', extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  voiceURI: `uri:${name}`,
  localService: true,
  ...extra,
});

// The start of a real macOS list: alphabetical, novelty voices first.
const mac = [
  voice('Albert'),
  voice('Bad News'),
  voice('Bahh'),
  voice('Bells'),
  voice('Daniel', 'en-GB'),
  voice('Eddy (English (US))'),
  voice('Fred'),
  voice('Samantha'),
  voice('Thomas', 'fr-FR'),
  voice('Zarvox'),
];

it('never picks a joke voice just because it comes first', () => {
  expect(isNoveltyVoice(mac[0])).toBe(true);
  expect(bestVoice(mac)?.name).toBe('Samantha');
  const ranked = rankVoices(mac).map((v) => v.name);
  expect(ranked).not.toContain('Albert');
  expect(ranked).not.toContain('Zarvox');
  expect(ranked).not.toContain('Thomas');
});

it('prefers an enhanced voice, then the matching accent', () => {
  const list = [voice('Samantha'), voice('Ava (Premium)'), voice('Daniel', 'en-GB')];
  expect(bestVoice(list)?.name).toBe('Ava (Premium)');
  expect(bestVoice(list, 'en-GB')?.name).toBe('Ava (Premium)');
  expect(bestVoice([voice('Samantha'), voice('Daniel', 'en-GB')], 'en-GB')?.name).toBe('Daniel');
});

it('uses a harsh voice only when nothing better exists, and never a remote one', () => {
  expect(bestVoice([voice('Eddy (English (US))'), voice('Albert')])?.name).toBe(
    'Eddy (English (US))'
  );
  expect(bestVoice([voice('Google US English', 'en-US', { localService: false })])).toBeNull();
  expect(bestVoice([voice('Albert'), voice('Zarvox')])).toBeNull();
});
