import { describe, expect, it } from 'vitest';
import {
  ACTION_VERBS,
  analyzeResumeLength,
  applyFieldChange,
  buildBullet,
  buildDeepSignalReport,
  computeBenchmarkScore,
  countPowerVerbs,
  createBulletRecord,
  decodeEntities,
  detectResumeStructure,
  detectWeakWords,
  escapeHtml,
  extractBullets,
  extractSkills,
  findQuantifiers,
  generateBulletSuggestions,
  getVerbStrength,
  hasOutcomeLink,
  hasQuantifier,
  POWER_VERBS_STRONG,
  STUDENT_SAMPLE_RESUME,
  scoreBullet,
  scoreLabel,
  seedFields,
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

describe('honest scoring', () => {
  it('scores a fresh record exactly as written, with no free points', () => {
    const record = createBulletRecord('Helped with events', 0);
    expect(record.edited).toBe(false);
    expect(record.improved).toBe('Helped with events');
    expect(record.improvedScore).toBe(record.baselineScore);
  });

  it('only moves the score once a field changes', () => {
    const record = createBulletRecord('Responsible for social media', 0);
    const edited = applyFieldChange(
      applyFieldChange(record, 'verb', 'Wrote'),
      'quantifier',
      '3 posts a week'
    );
    expect(edited.edited).toBe(true);
    expect(edited.improvedScore).toBeGreaterThan(record.baselineScore);
    expect(edited.improved).toMatch(/^• Wrote/);
  });

  it('extracts involvement verbs so the weak-verb rewrite can fire', () => {
    expect(seedFields('Worked on the newsletter with two other students').verb).toBe('Worked');
    expect(seedFields('Responsible for social media').verb).toBe('Responsible');
    const types = generateBulletSuggestions(
      createBulletRecord('Worked on the newsletter with two other students', 0)
    ).map((s) => s.type);
    expect(types).toContain('weak-verb');
  });
});

describe('quantifiers', () => {
  it('ignores years, date ranges, and phone numbers', () => {
    expect(hasQuantifier('Member of Chess Club 2022-2024')).toBe(false);
    expect(hasQuantifier("Dean's List Spring 2024")).toBe(false);
    expect(hasQuantifier('Call (555) 201-4477 for details')).toBe(false);
    expect(findQuantifiers('Raised $1,200 for 3 charities in 2024')).toEqual(['$1,200', '3']);
  });

  it('keeps counts, money, percentages, and multipliers', () => {
    expect(hasQuantifier('Cut wait time by 40%')).toBe(true);
    expect(hasQuantifier('Tutored 12 students')).toBe(true);
    expect(hasQuantifier('Grew followers 3x')).toBe(true);
  });

  it('does not reward a date range with quantifier points', () => {
    expect(scoreBullet('Member of Chess Club 2022-2024')).toBeLessThan(
      scoreBullet('Organized 6 chess tournaments for 40 members')
    );
  });
});

describe('outcome link', () => {
  it('needs a connector that leads into a result, not a bare "to"', () => {
    expect(hasOutcomeLink('Led to the store to buy 5 things and to return')).toBe(false);
    expect(hasOutcomeLink('Batched approvals to cut invoice time by 3 days')).toBe(true);
    expect(hasOutcomeLink('Rebuilt the form, resulting in 2x sign-ups')).toBe(true);
    expect(hasOutcomeLink('Automated reporting by scripting the export')).toBe(true);
  });

  it('no longer awards outcome points for a bare "to"', () => {
    // Verb and count still earn their points; the outcome link does not.
    expect(scoreBullet('Led to the store to buy 5 things and to return')).toBeLessThan(80);
    expect(scoreBullet('Led to the store to buy 5 things and to return')).toBeLessThan(
      scoreBullet('Led a team of 5 to cut setup time by half')
    );
  });
});

describe('detectResumeStructure', () => {
  it('skips contact, headings, education, and skills lines when there are no glyphs', () => {
    const structure = detectResumeStructure(STUDENT_SAMPLE_RESUME);
    expect(structure.usedGlyphs).toBe(false);
    expect(structure.bullets).toEqual([
      'Responsible for social media',
      'Worked on the weekly newsletter with two other students',
      'Helped with events during welcome week',
      'Participated in club meetings and the spring fundraiser',
    ]);
    expect(structure.skipped.contact).toBeGreaterThanOrEqual(2);
    expect(structure.skipped.heading).toBeGreaterThanOrEqual(3);
    expect(structure.skipped.education).toBeGreaterThanOrEqual(1);
    expect(structure.skipped.skills).toBeGreaterThanOrEqual(1);
    expect(structure.note).toMatch(/No bullet markers found/);
  });

  it('uses only the marked lines when glyphs are present', () => {
    const text = 'Jordan Lee\nEXPERIENCE\n• Led a team of 5\n• Built a dashboard\nRegular text';
    const structure = detectResumeStructure(text);
    expect(structure.usedGlyphs).toBe(true);
    expect(structure.bullets).toEqual(['Led a team of 5', 'Built a dashboard']);
  });
});

describe('extractSkills', () => {
  it('does not read a semester, an initial, or a verb as a skill', () => {
    const { hard } = extractSkills(
      "Dean's List Spring 2024. R. Smith. Let's go team. Great chef at the cafe."
    );
    expect(hard).not.toContain('spring');
    expect(hard).not.toContain('r');
    expect(hard).not.toContain('go');
    expect(hard).not.toContain('chef');
  });

  it('still finds the same names in a real skills context', () => {
    const { hard } = extractSkills(
      'Skills: Python, R, Go, Spring Boot, Express.js, Bash scripting'
    );
    expect(hard).toEqual(
      expect.arrayContaining(['python', 'r', 'go', 'spring', 'express', 'shell'])
    );
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
  it('keeps every bullet score within 0-100', () => {
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
  it('flags a bullet with a weak verb and no number, with one worked example each', () => {
    const record = createBulletRecord('Responsible for club stuff and things', 0);
    const suggestions = generateBulletSuggestions(record);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('weak-verb');
    expect(types).toContain('missing-number');
    expect(types.filter((t) => t === 'missing-number')).toHaveLength(1);
    for (const suggestion of suggestions) {
      if (suggestion.type === 'missing-number') {
        expect(suggestion.studentExample).toBeTruthy();
        expect(suggestion.professionalExample).toBeTruthy();
      }
    }
  });

  it('rotates worked examples across bullets', () => {
    const a = generateBulletSuggestions(createBulletRecord('Helped with events', 0), 0).find(
      (s) => s.type === 'missing-number'
    );
    const b = generateBulletSuggestions(
      createBulletRecord('Helped with the newsletter', 1),
      1
    ).find((s) => s.type === 'missing-number');
    const c = generateBulletSuggestions(
      createBulletRecord('Helped with the fundraiser', 2),
      2
    ).find((s) => s.type === 'missing-number');
    const examples = new Set([a?.studentExample, b?.studentExample, c?.studentExample]);
    expect(examples.size).toBeGreaterThan(1);
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
