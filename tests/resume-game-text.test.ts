import { describe, expect, it } from 'vitest';
import {
  capitalizeWord,
  countPowerVerbs,
  decodeEntities,
  escapeHtml,
  escapeRegExp,
  highlightResume,
  normalizeLine,
  uniqueId,
} from '../src/lib/resume-game/text';

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    const specials = 'hello.world*+?^$' + '{}()|[]\\';
    expect(escapeRegExp(specials)).toBe('hello\\.world\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('returns empty string unchanged', () => {
    expect(escapeRegExp('')).toBe('');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegExp('hello world 123')).toBe('hello world 123');
  });
});

describe('decodeEntities', () => {
  it('decodes standard HTML entities', () => {
    expect(
      decodeEntities('Hello&nbsp;world&amp;test&lt;tag&gt;&quot;quote&quot;&#39;single&#39;')
    ).toBe('Hello world&test<tag>"quote"\'single\'');
  });

  it('handles case-insensitive entity replacements', () => {
    expect(decodeEntities('Space&NBSP;Amp&AMP;')).toBe('Space Amp&');
  });

  it('returns empty string when input is empty', () => {
    expect(decodeEntities('')).toBe('');
  });

  it('leaves string without entities untouched', () => {
    expect(decodeEntities('Plain text 123')).toBe('Plain text 123');
  });
});

describe('capitalizeWord', () => {
  it('capitalizes first letter and lowercases the rest', () => {
    expect(capitalizeWord('hello')).toBe('Hello');
    expect(capitalizeWord('WORLD')).toBe('World');
    expect(capitalizeWord('jAVASCRIPT')).toBe('Javascript');
  });

  it('handles single character strings', () => {
    expect(capitalizeWord('a')).toBe('A');
    expect(capitalizeWord('Z')).toBe('Z');
  });

  it('returns empty string when input is empty', () => {
    expect(capitalizeWord('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes special HTML characters', () => {
    expect(escapeHtml('<div>"Hello" & \'World\'</div>')).toBe(
      '&lt;div&gt;&quot;Hello&quot; &amp; &#39;World&#39;&lt;/div&gt;'
    );
  });

  it('returns empty string when input is empty', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});

describe('normalizeLine', () => {
  it('decodes entities and strips bullet prefixes', () => {
    expect(normalizeLine('• Developed software')).toBe('Developed software');
    expect(normalizeLine('- Led a team')).toBe('Led a team');
    expect(normalizeLine('* Managed project')).toBe('Managed project');
  });

  it('collapses multiple spaces and trims whitespace', () => {
    expect(normalizeLine('  Led   a    team  of  5 ')).toBe('Led a team of 5');
  });

  it('returns empty string for resume headings', () => {
    expect(normalizeLine('SUMMARY')).toBe('');
    expect(normalizeLine('Experience')).toBe('');
    expect(normalizeLine('  EDUCATION  ')).toBe('');
    expect(normalizeLine('SKILLS')).toBe('');
  });

  it('returns empty string for date ranges', () => {
    expect(normalizeLine('Jan 2020 - Dec 2022')).toBe('');
    expect(normalizeLine('2019 – Current')).toBe('');
    expect(normalizeLine('2021')).toBe('');
  });

  it('returns empty string if alphanumeric count is less than 3', () => {
    expect(normalizeLine('a!')).toBe('');
    expect(normalizeLine('--')).toBe('');
    expect(normalizeLine('12')).toBe('');
  });

  it('returns valid line if conditions are met', () => {
    expect(normalizeLine('Built an automated CI/CD pipeline')).toBe(
      'Built an automated CI/CD pipeline'
    );
  });
});

describe('highlightResume', () => {
  it('returns empty string when input is empty', () => {
    expect(highlightResume('')).toBe('');
  });

  it('highlights numbers and percentages', () => {
    const text = 'Increased sales by 50% across 3 departments.';
    const highlighted = highlightResume(text);
    expect(highlighted).toContain(
      '<mark class="bg-primary/30 text-primary-foreground px-1 rounded">50%</mark>'
    );
    expect(highlighted).toContain(
      '<mark class="bg-primary/30 text-primary-foreground px-1 rounded">3</mark>'
    );
  });

  it('highlights power verbs', () => {
    const text = 'Spearheaded project and launched product.';
    const highlighted = highlightResume(text);
    expect(highlighted).toContain(
      '<mark class="bg-love/30 text-foreground px-1 rounded">Spearheaded</mark>'
    );
    expect(highlighted).toContain(
      '<mark class="bg-love/30 text-foreground px-1 rounded">launched</mark>'
    );
  });

  it('decodes HTML entities and escapes HTML tags before highlighting', () => {
    const text = '&lt;script&gt;alert(1)&lt;/script&gt; Led 100%';
    const highlighted = highlightResume(text);
    expect(highlighted).toContain('&lt;script&gt;');
    expect(highlighted).not.toContain('<script>');
  });
});

describe('countPowerVerbs', () => {
  it('returns 0 for empty input', () => {
    expect(countPowerVerbs('')).toBe(0);
  });

  it('counts power verbs accurately', () => {
    const text = 'Spearheaded and launched 3 major initiatives; orchestrated team workflows.';
    expect(countPowerVerbs(text)).toBe(3);
  });

  it('decodes HTML entities before counting power verbs', () => {
    const text = 'Spearheaded &amp; launched new features';
    expect(countPowerVerbs(text)).toBe(2);
  });
});

describe('uniqueId', () => {
  it('preserves the caller-provided prefix and index', () => {
    expect(uniqueId('bullet', 1)).toMatch(/^bullet-1-/);
    expect(uniqueId('skill', 12)).toMatch(/^skill-12-/);
  });
});
