import { describe, expect, it } from 'vitest';
import { detectSkillsFromText, SKILL_BANK } from '../src/lib/glowup-banks';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function legacySuggestions(text: string) {
  return SKILL_BANK.map((skill) => ({
    skillId: skill.id,
    matchedKeywords: skill.keywords.filter((keyword) =>
      new RegExp(`(?:^|[^a-z0-9+#])${escapeRegExp(keyword)}(?:$|[^a-z0-9+#])`, 'i').test(text)
    ),
  }))
    .filter((suggestion) => suggestion.matchedKeywords.length > 0)
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, 3);
}

describe('glowup substring prefilter parity', () => {
  it('preserves case, punctuation, and boundary behavior for every bank keyword', () => {
    for (const skill of SKILL_BANK) {
      for (const keyword of skill.keywords) {
        for (const text of [
          keyword,
          keyword.toUpperCase(),
          `Built a ${keyword} project`,
          `(${keyword}),`,
          `${keyword}-based`,
          `x${keyword}x`,
          `1${keyword}2`,
          `${keyword}++`,
          `${keyword}#`,
          '',
        ]) {
          expect(detectSkillsFromText(text), `${keyword} in ${JSON.stringify(text)}`).toEqual(
            legacySuggestions(text)
          );
        }
      }
    }
  });

  it.each([
    'Email projects in HTML, but no listed keywords.',
    'Used JavaScript, React, SQL, MYSQL, AWS, cloud, PYTHON, pandas, and NumPy.',
    'Built CI/CD, GitHub Actions, API integration, and front-end accessibility.',
    'Strong leadership, communication, teamwork, problem-solving, and time management.',
    'İOS Kubernetes ﬂask ſecurity, plus HIPAA and medical research.',
  ])('preserves distinct matches, ranking, and the top-three limit in %s', (text) => {
    expect(detectSkillsFromText(text)).toEqual(legacySuggestions(text));
    expect(detectSkillsFromText(text)).toHaveLength(Math.min(3, legacySuggestions(text).length));
  });
});
