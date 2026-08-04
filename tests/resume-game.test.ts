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
  createBulletRecord,
  buildDeepSignalReport,
  computeBenchmarkScore,
  detectWeakWords,
  getVerbStrength,
  seedFields,
  generateBulletSuggestions,
  analyzeResumeLength,
  POWER_VERBS_STRONG,
  ACTION_VERBS,
  WEAK_WORDS,
} from '../src/lib/resume-game';

const SAMPLE_TEXT = `• Led a 6-person product pod launching a pricing diagnostics dashboard adopted by 4 global regions within the first quarter.
• Automated weekly revenue reporting with Python + Airflow, trimming manual analysis time by 9 hours per analyst.
• Mentored three new hires, coaching them on stakeholder narrative reviews that helped lift NPS by 14 points.`;

function recordsFrom(text: string) {
  return extractBullets(text).map((line, index) => createBulletRecord(line, index));
}

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

  it('falls back to plain lines when no bullet glyphs exist', () => {
    const text = 'Led a team of 4 tutors for intro physics\nBuilt a grading script in Python';
    expect(extractBullets(text)).toHaveLength(2);
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

  it('lets a genuinely excellent bullet reach 100', () => {
    const excellent = 'Automated weekly grant reporting in Excel to save the lab 6 hours per week.';
    expect(scoreBullet(excellent)).toBe(100);
  });

  it('never exceeds 100', () => {
    const maxed =
      'Spearheaded a 12-person launch team to cut onboarding time by 40% across 3 regions.';
    expect(scoreBullet(maxed)).toBeLessThanOrEqual(100);
  });
});

describe('score clamping', () => {
  it('caps improvedScore at 100 even with field and edit bonuses', () => {
    // Base rubric score is 97 here; the +15 field bonus would push past 100
    // without clamping.
    const record = createBulletRecord('• Led a team of 12 to cut costs by 30%.', 0);
    expect(record.improvedScore).toBeLessThanOrEqual(100);
    expect(record.baselineScore).toBeLessThanOrEqual(100);
    expect(record.improvedScore).toBeGreaterThanOrEqual(0);
  });

  it('keeps the benchmark score within 0-100', () => {
    const { score } = computeBenchmarkScore(recordsFrom(SAMPLE_TEXT));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('signal strength leading-verb credit', () => {
  it('credits bullets whose improved text starts with an action verb', () => {
    // The improved text starts with a bullet glyph; the leading-verb check
    // must still recognize "Led" as the first word.
    const text = '• Led a team of 12 to cut costs by 30%.';
    const report = buildDeepSignalReport(recordsFrom(text), text);
    expect(report.visible).toBeGreaterThanOrEqual(80);
  });

  it('scores the full sample resume as high signal', () => {
    const report = buildDeepSignalReport(recordsFrom(SAMPLE_TEXT), SAMPLE_TEXT);
    expect(report.visible).toBeGreaterThanOrEqual(80);
    expect(report.benchmarkScore).toBeGreaterThan(80);
  });
});

describe('verb classification', () => {
  it('treats managed as a normal medium verb, not weak', () => {
    expect(getVerbStrength('managed')).toBe('medium');
    expect(getVerbStrength('Managed')).toBe('medium');
  });

  it('does not flag managed as a weak word', () => {
    expect(WEAK_WORDS).not.toContain('managed');
    expect(detectWeakWords('Managed a cross-functional team of 8')).toEqual([]);
  });

  it('still flags hedging phrases', () => {
    expect(detectWeakWords('Responsible for helping with events')).toContain('responsible for');
  });

  it('classifies tiers correctly', () => {
    expect(getVerbStrength('spearheaded')).toBe('strong');
    expect(getVerbStrength('helped')).toBe('weak');
    expect(getVerbStrength('built')).toBe('medium');
  });

  it('makes every strong verb extractable from a bullet', () => {
    for (const verb of POWER_VERBS_STRONG) {
      expect(ACTION_VERBS).toContain(verb);
      const fields = seedFields(`${verb} the project workflow`);
      expect(fields.verb.toLowerCase()).toBe(verb);
    }
  });
});

describe('bulletCount fallback', () => {
  it('uses the extracted bullet count when the text has no bullet glyphs', () => {
    const text =
      'Led a team of 4 tutors for intro physics\nBuilt a grading script in Python saving 3 hours weekly';
    const records = recordsFrom(text);
    const report = buildDeepSignalReport(records, text);
    expect(records).toHaveLength(2);
    expect(report.bulletCount).toBe(2);
  });

  it('accepts an extracted count directly in analyzeResumeLength', () => {
    const result = analyzeResumeLength('Plain line one\nPlain line two', 2);
    expect(result.bulletCount).toBe(2);
  });

  it('still prefers glyph counting when glyphs exist', () => {
    const result = analyzeResumeLength('• One\n• Two\n• Three', 99);
    expect(result.bulletCount).toBe(3);
  });
});

describe('generateBulletSuggestions', () => {
  it('flags a bullet with no verb and no number, with worked examples', () => {
    const record = createBulletRecord('Responsible for club stuff and things', 0);
    const suggestions = generateBulletSuggestions(record);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('missing-number');
    expect(types).toContain('scope-alternatives');
    for (const suggestion of suggestions) {
      if (suggestion.type === 'missing-number' || suggestion.type === 'scope-alternatives') {
        expect(suggestion.studentExample).toBeTruthy();
        expect(suggestion.professionalExample).toBeTruthy();
      }
    }
  });

  it('returns no flags for a complete bullet', () => {
    const record = createBulletRecord(
      '• Automated weekly grant reporting in Excel to save the lab 6 hours per week.',
      0
    );
    expect(generateBulletSuggestions(record)).toHaveLength(0);
  });

  it('references the actual word count when a bullet is too short', () => {
    const record = createBulletRecord('Built a website', 0);
    const suggestion = generateBulletSuggestions(record).find((s) => s.type === 'too-short');
    expect(suggestion).toBeTruthy();
    expect(suggestion?.message).toMatch(/\d+ words/);
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
