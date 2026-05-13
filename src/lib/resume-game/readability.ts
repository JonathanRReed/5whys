import { normalizeLine } from './text';

function countSyllables(word: string): number {
  if (!word) return 0;
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return 0;
  // Count vowel groups
  const matches = lower.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 0;
  // Silent e
  if (lower.endsWith('e') && count > 1) count--;
  // Handle words ending in le
  if (lower.endsWith('le') && lower.length > 2 && !/[aeiouy]/.test(lower[lower.length - 3])) {
    count++;
  }
  return Math.max(1, count);
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
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = wordCount / sentenceCount;

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level (simplified)
  const gradeLevel =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / Math.max(1, wordCount)) -
    15.59;

  // Passive voice detection: was/were/be + past participle, or common passive patterns
  const passiveMatches = normalized.match(
    /\b(was|were|been|being|is|are|be)\s+\w+ed\b|\b(was|were|been|being|is|are|be)\s+\w+en\b/gi
  );
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
