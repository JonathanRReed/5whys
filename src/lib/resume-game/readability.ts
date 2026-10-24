import { normalizeLine } from './text';

// Pre-compiled regex patterns to avoid repeated instantiation on every word/sentence during readability analysis
const NON_ALPHA_PATTERN = /[^a-z]/g;
const VOWEL_GROUP_PATTERN = /[aeiouy]+/g;
const THIRD_LAST_CHAR_VOWEL_PATTERN = /[aeiouy]/;
const SENTENCE_TERMINATOR_PATTERN = /([.!?])\s+/g;

// Unified, non-capturing passive voice regex avoids creating intermediate match groups on every scan
const PASSIVE_VOICE_PATTERN = /\b(?:was|were|been|being|is|are|be)\s+\w+(?:ed|en)\b/gi;

// Bounded LRU-style syllable cache to avoid re-evaluating regexes and string operations
// on common resume words across real-time typing and scoring passes.
const SYLLABLE_CACHE_MAX = 5000;
const syllableCache = new Map<string, number>();

function countSyllables(word: string): number {
  if (!word) return 0;

  const cached = syllableCache.get(word);
  if (cached !== undefined) return cached;

  const lower = word.toLowerCase().replace(NON_ALPHA_PATTERN, '');
  if (!lower) {
    if (syllableCache.size < SYLLABLE_CACHE_MAX) {
      syllableCache.set(word, 0);
    }
    return 0;
  }

  // Count vowel groups
  const matches = lower.match(VOWEL_GROUP_PATTERN);
  let count = matches ? matches.length : 0;
  // Silent e
  if (lower.endsWith('e') && count > 1) count--;
  // Handle words ending in le
  if (
    lower.endsWith('le') &&
    lower.length > 2 &&
    !THIRD_LAST_CHAR_VOWEL_PATTERN.test(lower[lower.length - 3])
  ) {
    count++;
  }

  const result = Math.max(1, count);
  if (syllableCache.size < SYLLABLE_CACHE_MAX) {
    syllableCache.set(word, result);
  }
  return result;
}

export function analyzeReadability(text: string) {
  const normalized = normalizeLine(text);
  if (!normalized) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      syllableCount: 0,
      gradeLevel: 0,
      passiveVoiceCount: 0,
      passiveVoicePercent: 0,
      isReadable: false,
    };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  // Split on sentence terminators
  const sentences = normalized
    .replace(SENTENCE_TERMINATOR_PATTERN, '$1|')
    .split('|')
    .filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = wordCount / sentenceCount;

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level (simplified)
  const gradeLevel =
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / Math.max(1, wordCount)) - 15.59;

  // Passive voice detection: was/were/be + past participle, or common passive patterns
  const passiveMatches = normalized.match(PASSIVE_VOICE_PATTERN);
  const passiveVoiceCount = passiveMatches ? passiveMatches.length : 0;
  const passiveVoicePercent = (passiveVoiceCount / sentenceCount) * 100;

  // A bullet is "readable" if it's concise, not too complex, and not too passive
  const isReadable =
    wordCount >= 8 &&
    wordCount <= 32 &&
    gradeLevel <= 14 &&
    avgWordsPerSentence <= 25 &&
    passiveVoicePercent < 40;

  return {
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    syllableCount,
    gradeLevel: Math.max(0, gradeLevel),
    passiveVoiceCount,
    passiveVoicePercent,
    isReadable,
  };
}
