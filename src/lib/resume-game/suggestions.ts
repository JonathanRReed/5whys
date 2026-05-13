import type { BulletRecord } from './types';
import { getVerbStrength, suggestStrongerVerb } from './constants';
import { analyzeReadability } from './readability';

export type BulletSuggestion = {
  type: 'missing-verb' | 'weak-verb' | 'missing-number' | 'missing-impact' | 'too-long' | 'passive-voice' | 'too-short' | 'readability';
  message: string;
  fix?: string;
};

export function generateBulletSuggestions(bullet: BulletRecord): BulletSuggestion[] {
  const suggestions: BulletSuggestion[] = [];
  const { original, fields } = bullet;
  const readability = analyzeReadability(original);

  // Missing verb
  if (!fields.verb.trim()) {
    suggestions.push({
      type: 'missing-verb',
      message: 'Start with an action verb like "Led", "Built", or "Increased".',
    });
  }

  // Weak verb
  if (fields.verb.trim()) {
    const strength = getVerbStrength(fields.verb);
    if (strength === 'weak') {
      const stronger = suggestStrongerVerb(fields.verb);
      suggestions.push({
        type: 'weak-verb',
        message: `"${fields.verb}" is a weak verb.`,
        fix: stronger ? `Try: "${stronger}"` : undefined,
      });
    }
  }

  // Missing quantifier
  if (!fields.quantifier.trim() && !/\$?\d+[\d,]*\.?\d*%?/.test(original)) {
    suggestions.push({
      type: 'missing-number',
      message: 'Add a metric: % improvement, $ saved, users served, or time reduced.',
    });
  }

  // Missing impact
  if (!fields.impact.trim() && !/(\bby\b|\bto\b|\bresult(ing)? in\b|\bleading to\b)/i.test(original)) {
    suggestions.push({
      type: 'missing-impact',
      message: 'Add a business result. What changed because of your work?',
    });
  }

  // Too long
  if (readability.wordCount > 32) {
    suggestions.push({
      type: 'too-long',
      message: `At ${readability.wordCount} words, this bullet is hard to scan. Trim to 20–28 words.`,
    });
  }

  // Too short
  if (readability.wordCount < 8) {
    suggestions.push({
      type: 'too-short',
      message: `At ${readability.wordCount} words, this bullet lacks detail. Expand with context and impact.`,
    });
  }

  // Passive voice
  if (readability.passiveVoiceCount > 0) {
    suggestions.push({
      type: 'passive-voice',
      message: `Uses passive voice (${readability.passiveVoiceCount}x). Switch to active: "Built X" instead of "X was built".`,
    });
  }

  // Readability
  if (!readability.isReadable && readability.wordCount >= 8) {
    suggestions.push({
      type: 'readability',
      message: 'Bullet is complex or hard to scan. Simplify sentence structure and cut filler words.',
    });
  }

  return suggestions;
}

export function signalGrade(visible: number): { grade: string; label: string; color: string } {
  if (visible >= 80) return { grade: 'A', label: 'Excellent signal', color: 'text-[hsl(var(--love))]' };
  if (visible >= 65) return { grade: 'B', label: 'Good signal', color: 'text-[hsl(var(--foam))]' };
  if (visible >= 50) return { grade: 'C', label: 'Moderate signal', color: 'text-[hsl(var(--gold))]' };
  return { grade: 'D', label: 'Weak signal', color: 'text-[hsl(var(--destructive))]' };
}
