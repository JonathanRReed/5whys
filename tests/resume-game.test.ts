import { describe, it, expect } from 'vitest';
import {
  extractBullets,
  buildBullet,
  fieldBonus,
  scoreBullet,
  scoreLabel,
  countPowerVerbs,
  decodeEntities,
  escapeHtml,
} from '../src/lib/resume-game';

describe('extractBullets', () => {
  it('extracts bullet points from text', () => {
    const text = `• Led a team of 5\n• Built a dashboard\nRegular text`;
    const result = extractBullets(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Led a team of 5');
    expect(result[1]).toContain('Built a dashboard');
  });

  it('returns empty array for empty text', () => {
    expect(extractBullets('')).toEqual([]);
  });

  it('handles dash and asterisk bullets', () => {
    const text = `- First bullet\n* Second bullet`;
    const result = extractBullets(text);
    expect(result).toHaveLength(2);
  });
});

describe('buildBullet', () => {
  it('builds a formatted bullet from fields', () => {
    const fields = { verb: 'Led', quantifier: '5', task: 'a team', impact: 'to success' };
    const result = buildBullet(fields);
    expect(result).toContain('Led');
    expect(result).toContain('5');
  });
});

describe('fieldBonus', () => {
  it('returns bonus for complete fields', () => {
    const fields = { verb: 'Led', quantifier: '5', task: 'team', impact: 'success' };
    expect(fieldBonus(fields)).toBeGreaterThan(0);
  });

  it('returns zero for empty fields', () => {
    expect(fieldBonus({ verb: '', quantifier: '', task: '', impact: '' })).toBe(0);
  });
});

describe('scoreBullet', () => {
  it('returns higher score for stronger bullets', () => {
    const strong = 'Led a team of 12 engineers, delivering $2M in cost savings within 6 months.';
    const weak = 'Responsible for team.';
    expect(scoreBullet(strong)).toBeGreaterThan(scoreBullet(weak));
  });

  it('returns 0 for empty string', () => {
    expect(scoreBullet('')).toBe(0);
  });
});

describe('scoreLabel', () => {
  it('returns high signal for strong scores', () => {
    expect(scoreLabel(90).label).toBe('High signal');
  });

  it('returns moderate for medium scores', () => {
    expect(scoreLabel(60).label).toBe('Moderate');
  });

  it('returns hidden value for weak scores', () => {
    expect(scoreLabel(20).label).toBe('Hidden value');
  });
});

describe('countPowerVerbs', () => {
  it('counts strong action verbs', () => {
    const text = 'Led the team and built the product. Drove revenue growth.';
    expect(countPowerVerbs(text)).toBeGreaterThan(0);
  });

  it('returns 0 for weak verbs', () => {
    expect(countPowerVerbs('Responsible for tasks.')).toBe(0);
  });
});

describe('decodeEntities', () => {
  it('decodes HTML entities', () => {
    expect(decodeEntities('&lt;div&gt;')).toBe('<div>');
    expect(decodeEntities('&amp;')).toBe('&');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML characters', () => {
    expect(escapeHtml('<script>')).not.toContain('<');
    expect(escapeHtml('"quoted"')).not.toContain('"');
  });
});
