/**
 * Choosing a built-in voice. The browser's list is alphabetical and, on a
 * Mac, opens with novelty voices, so "the first English voice" is a bad one.
 * These rules rank the voices that are on the device; they never fetch one.
 */

/** macOS joke voices and the old robotic set. Never chosen automatically. */
const NOVELTY = new Set(
  [
    'albert',
    'bad news',
    'bahh',
    'bells',
    'boing',
    'bubbles',
    'cellos',
    'good news',
    'jester',
    'organ',
    'superstar',
    'trinoids',
    'whisper',
    'wobble',
    'zarvox',
    'deranged',
    'hysterical',
    'pipe organ',
    'fred',
    'junior',
    'kathy',
    'ralph',
    'princess',
    'bruce',
    'agnes',
    'vicki',
    'victoria',
  ].map((name) => name.toLowerCase())
);

/** The "Eloquence" voices: intelligible, but harsh. Kept only as a last resort. */
const ROBOTIC = new Set(
  ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'].map((n) =>
    n.toLowerCase()
  )
);

/** Voices people generally find pleasant, when present. */
const PREFERRED = [
  'samantha',
  'ava',
  'allison',
  'susan',
  'zoe',
  'evan',
  'nathan',
  'tom',
  'alex',
  'daniel',
  'karen',
  'moira',
  'tessa',
  'serena',
  'google us english',
  'google uk english female',
  'aria',
  'jenny',
  'guy',
  'zira',
  'david',
  'mark',
];

export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default?: boolean;
}

const baseName = (voice: VoiceLike) =>
  (voice.name ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/^microsoft\s+/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();

export function isNoveltyVoice(voice: VoiceLike): boolean {
  return NOVELTY.has(baseName(voice));
}

/** Higher is better. Zero or below means "do not pick this on your own". */
export function scoreVoice(voice: VoiceLike, language = 'en-US'): number {
  if (!voice.localService) return -1000;
  const lang = (voice.lang ?? '').replace('_', '-').toLowerCase();
  const wanted = language.toLowerCase();
  if (!lang.startsWith(wanted.split('-')[0])) return -500;
  const base = baseName(voice);
  if (NOVELTY.has(base)) return -100;

  let score = 10;
  if (lang === wanted) score += 30;
  else if (lang === 'en-us') score += 20;
  if (/premium|enhanced|natural|neural|siri/i.test(voice.name ?? '')) score += 60;
  const rank = PREFERRED.indexOf(base);
  if (rank >= 0) score += 40 - rank;
  if (voice.default) score += 15;
  if (ROBOTIC.has(base)) score -= 45;
  if (/compact/i.test(voice.voiceURI ?? '')) score -= 5;
  return score;
}

/** Local voices for the language, best first, with novelty voices left out. */
export function rankVoices<T extends VoiceLike>(voices: readonly T[], language = 'en-US'): T[] {
  return voices
    .map((voice) => ({ voice, score: scoreVoice(voice, language) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.voice.name ?? '').localeCompare(b.voice.name ?? ''))
    .map((entry) => entry.voice);
}

export function bestVoice<T extends VoiceLike>(voices: readonly T[], language = 'en-US'): T | null {
  return rankVoices(voices, language)[0] ?? null;
}

/** A device preference, like the theme. */
export const VOICE_STORAGE_KEY = 'career-tools-voice';

export function loadVoiceChoice(): string | null {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveVoiceChoice(voiceURI: string | null): void {
  try {
    if (voiceURI) window.localStorage.setItem(VOICE_STORAGE_KEY, voiceURI);
    else window.localStorage.removeItem(VOICE_STORAGE_KEY);
  } catch {
    /* storage unavailable: the choice applies for this visit */
  }
}
