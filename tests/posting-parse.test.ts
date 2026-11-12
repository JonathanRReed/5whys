import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractRequirementLines as legacyExtract } from '../src/lib/glowup-banks';
import {
  decideSection,
  extractRequirementLines,
  findCues,
  headingMeaning,
  MAX_REQUIREMENT_LINES,
  type ParsedPosting,
  type PostingSection,
  parsePosting,
  sliceSpan,
} from '../src/lib/posting';

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, 'fixtures', 'postings', `${name}.txt`),
    'utf8'
  );
}

function find(parsed: ParsedPosting, startsWith: string) {
  const hit = parsed.requirements.find((r) => r.text.startsWith(startsWith));
  if (!hit) throw new Error(`no requirement starting with ${JSON.stringify(startsWith)}`);
  return hit;
}

function sectionOf(parsed: ParsedPosting, startsWith: string): PostingSection {
  return find(parsed, startsWith).section;
}

/** Every span must point at the sentence the requirement came from. */
function expectSpansPointAtSource(parsed: ParsedPosting) {
  for (const r of parsed.requirements) {
    const source = sliceSpan(parsed.text, r.span);
    expect(source, r.text).not.toBeNull();
    const flat = (source ?? '').replace(/\s+/g, ' ');
    // Nested groups are folded into "lead: a, b"; every other requirement is
    // its source sentence, whitespace collapsed.
    const firstWords = r.text.split(/[:]/)[0].slice(0, 30);
    expect(flat.startsWith(firstWords), `${r.text} vs ${flat}`).toBe(true);
  }
  for (const line of parsed.setAside) {
    expect(parsed.text.slice(line.start, line.end)).toBe(line.text);
  }
}

describe('parsePosting: student internship', () => {
  const parsed = parsePosting(fixture('student-internship'));

  it('reads sections from headings', () => {
    expect(sectionOf(parsed, 'Clean and combine ridership data')).toBe('responsibility');
    expect(sectionOf(parsed, 'Write SQL queries')).toBe('responsibility');
    expect(sectionOf(parsed, 'Currently enrolled')).toBe('required');
    expect(sectionOf(parsed, 'Experience with Excel')).toBe('required');
    expect(sectionOf(parsed, 'Python or R')).toBe('preferred');
    expect(sectionOf(parsed, 'Familiarity with GIS')).toBe('preferred');
  });

  it('leaves lines under a heading that names no section unclassified', () => {
    const intro = find(parsed, 'This is a paid ten-week internship');
    expect(intro.section).toBe('unclassified');
    expect(intro.classification?.basis).toBe('none');
  });

  it('sets aside about-us, benefits, title lines, and the equal opportunity statement', () => {
    const texts = parsed.requirements.map((r) => r.text).join('\n');
    expect(texts).not.toMatch(/runs bus and paratransit/);
    expect(texts).not.toMatch(/Free transit pass/);
    expect(texts).not.toMatch(/equal opportunity/);
    expect(parsed.setAside.some((s) => s.reason === 'outside-requirements')).toBe(true);
    expect(parsed.setAside.filter((s) => s.reason === 'header-line')).toHaveLength(2);
    expect(parsed.headings.map((h) => [h.text, h.meaning])).toEqual([
      ['About Us', 'set-aside'],
      ['About the Internship', 'neutral'],
      ["What You'll Do", 'responsibility'],
      ["What We're Looking For", 'required'],
      ['Nice to Have', 'preferred'],
      ['Benefits', 'set-aside'],
    ]);
  });

  it('finds the vague phrases with offsets', () => {
    expect(parsed.vaguePhrases.map((v) => v.id)).toEqual([
      'other-duties',
      'fast-paced',
      'self-starter',
    ]);
    for (const hit of parsed.vaguePhrases) {
      expect(parsed.text.slice(hit.start, hit.end)).toBe(hit.text);
    }
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });

  it('gives every requirement a stable id and starts it as suggested', () => {
    const again = parsePosting(fixture('student-internship'));
    expect(again.requirements.map((r) => r.id)).toEqual(parsed.requirements.map((r) => r.id));
    expect(new Set(parsed.requirements.map((r) => r.id)).size).toBe(parsed.requirements.length);
    expect(
      parsed.requirements.every((r) => r.status === 'suggested' && r.origin === 'parsed')
    ).toBe(true);
  });
});

describe('parsePosting: retail part-time', () => {
  const parsed = parsePosting(fixture('retail-part-time'));

  it('reads responsibilities and requirements', () => {
    expect(sectionOf(parsed, 'Greet customers')).toBe('responsibility');
    expect(sectionOf(parsed, 'Must be 16 years or older')).toBe('required');
    expect(find(parsed, 'Must be 16 years or older').classification?.basis).toBe('heading-and-cue');
    expect(sectionOf(parsed, 'Availability to work weekends')).toBe('required');
  });

  it('lets a preferred cue win inside the requirements list', () => {
    const cash = find(parsed, 'Cash handling experience is a plus');
    expect(cash.section).toBe('preferred');
    expect(cash.classification).toMatchObject({ basis: 'cue', cue: 'a plus' });
    expect(sectionOf(parsed, 'Customer service experience preferred but not required')).toBe(
      'preferred'
    );
  });

  it('does not read "no prior experience required" as a requirement', () => {
    const train = find(parsed, 'No prior retail experience required');
    expect(train.section).toBe('unclassified');
    expect(train.text).toBe('No prior retail experience required; we will train you');
  });

  it('sets aside pay, location, and schedule details', () => {
    const details = parsed.setAside.filter((s) => s.reason === 'job-details').map((s) => s.text);
    expect(details).toEqual([
      'Location: 214 Market Street, Ashford',
      'Pay: $15.50 per hour, competitive pay with an employee discount',
      'Part-time, 15 to 25 hours per week, with flexible scheduling.',
    ]);
    expect(parsed.requirements.some((r) => r.text === 'Schedule')).toBe(false);
  });

  it('flags the vague phrases', () => {
    expect(parsed.vaguePhrases.map((v) => v.id)).toEqual([
      'competitive-pay',
      'like-family',
      'other-duties',
      'flexible-schedule',
    ]);
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });
});

describe('parsePosting: entry-level analyst', () => {
  const parsed = parsePosting(fixture('entry-level-analyst'));

  it('reads numbered responsibilities and qualification headings', () => {
    expect(sectionOf(parsed, 'Gather requirements from stakeholders')).toBe('responsibility');
    expect(sectionOf(parsed, 'Track project tasks in Jira')).toBe('responsibility');
    expect(sectionOf(parsed, "Bachelor's degree in business")).toBe('required');
    expect(sectionOf(parsed, '0 to 2 years of experience')).toBe('required');
    expect(sectionOf(parsed, 'Experience with Power BI or Tableau')).toBe('preferred');
    expect(sectionOf(parsed, 'Exposure to Agile or Scrum')).toBe('preferred');
  });

  it('strips list numbers without eating numbers in the text', () => {
    expect(find(parsed, 'Gather requirements').text).toBe(
      'Gather requirements from stakeholders in billing, finance, and clinical operations'
    );
    expect(find(parsed, '0 to 2 years').text).toMatch(/^0 to 2 years/);
  });

  it('sets aside benefits under "What we offer"', () => {
    const texts = parsed.requirements.map((r) => r.text).join('\n');
    expect(texts).not.toMatch(/401\(k\)|Tuition/);
    expect(parsed.vaguePhrases.map((v) => v.id)).toEqual([
      'many-hats',
      'dynamic',
      'depends-on-experience',
    ]);
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });
});

describe('parsePosting: no headings', () => {
  const parsed = parsePosting(fixture('no-headings'));

  it('classifies only lines that carry their own cue', () => {
    expect(sectionOf(parsed, 'Must be a current Bellmont student')).toBe('required');
    expect(sectionOf(parsed, 'Public speaking experience is a plus')).toBe('preferred');
    expect(sectionOf(parsed, 'Experience with social media')).toBe('preferred');
    expect(sectionOf(parsed, 'Spanish or another second language')).toBe('preferred');
    expect(sectionOf(parsed, 'You will be responsible for checking in')).toBe('responsibility');
  });

  it('leaves lines with no cue unclassified rather than guessing', () => {
    expect(sectionOf(parsed, 'Lead walking tours')).toBe('unclassified');
    expect(sectionOf(parsed, 'Answer questions about academics')).toBe('unclassified');
    expect(sectionOf(parsed, 'Help staff the welcome desk')).toBe('unclassified');
    expect(parsed.headings).toEqual([]);
  });

  it('sets aside the application instructions', () => {
    expect(parsed.setAside.find((s) => s.text.startsWith('Apply by'))?.reason).toBe('job-details');
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });
});

describe('parsePosting: one long paragraph', () => {
  const raw = fixture('one-paragraph');
  const parsed = parsePosting(raw);

  it('splits the paragraph into sentences with their own spans', () => {
    expect(raw.split('\n').filter(Boolean)).toHaveLength(1);
    expect(parsed.requirements.length).toBeGreaterThanOrEqual(5);
    const must = find(parsed, 'Must be at least 18');
    expect(raw.slice(must.span?.start, must.span?.end)).toBe(
      'Must be at least 18 years old and have a high school diploma or GED.'
    );
  });

  it('classifies each sentence by its own cue', () => {
    expect(sectionOf(parsed, 'Must be at least 18')).toBe('required');
    expect(sectionOf(parsed, 'Previous customer service experience is required')).toBe('required');
    expect(sectionOf(parsed, 'Experience with an integrated library system')).toBe('preferred');
    expect(sectionOf(parsed, 'You will check materials')).toBe('unclassified');
  });

  it('sets aside pay, hours, and the equal opportunity sentence', () => {
    expect(parsed.setAside.map((s) => s.reason).sort()).toEqual([
      'boilerplate',
      'job-details',
      'job-details',
    ]);
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });
});

describe('parsePosting: nested bullets', () => {
  const raw = fixture('nested-bullets');
  const parsed = parsePosting(raw);

  it('folds short sub-bullets into their parent as one requirement', () => {
    const tools = find(parsed, 'Proficiency in at least one of the following');
    expect(tools.text).toBe(
      'Proficiency in at least one of the following: Canva, Adobe Photoshop, Figma'
    );
    expect(tools.section).toBe('required');
    expect(raw.slice(tools.span?.start, tools.span?.end)).toMatch(
      /^Proficiency in at least one of the following:[\s\S]*Figma$/
    );
    expect(find(parsed, 'Plan and schedule social media posts').text).toBe(
      'Plan and schedule social media posts across our channels: Instagram, TikTok, LinkedIn'
    );
    expect(sectionOf(parsed, 'Experience with email marketing tools')).toBe('preferred');
  });

  it('lets long sub-bullets stand alone under a lead that ends in a colon', () => {
    expect(sectionOf(parsed, 'Coordinate with store managers')).toBe('responsibility');
    expect(sectionOf(parsed, 'Design flyers and signage in Canva')).toBe('responsibility');
    expect(parsed.setAside.find((s) => s.reason === 'group-lead')?.text).toBe(
      'Support in-store events from start to finish:'
    );
  });

  it('joins a bullet wrapped onto the next line', () => {
    const wrapped = find(parsed, 'Write product descriptions');
    expect(wrapped.text).toBe(
      'Write product descriptions for the online store and keep them consistent with our brand voice'
    );
    expect(raw.slice(wrapped.span?.start, wrapped.span?.end)).toContain('\n');
  });

  it('keeps spans on the source sentence', () => {
    expectSpansPointAtSource(parsed);
  });
});

describe('section evidence', () => {
  it('maps common heading variants', () => {
    expect(headingMeaning('Requirements:')).toBe('required');
    expect(headingMeaning('Basic Qualifications')).toBe('required');
    expect(headingMeaning('What you’ll need')).toBe('required');
    expect(headingMeaning('Preferred Qualifications')).toBe('preferred');
    expect(headingMeaning('Nice-to-haves')).toBe('preferred');
    expect(headingMeaning('Bonus points')).toBe('preferred');
    expect(headingMeaning('Key Responsibilities')).toBe('responsibility');
    expect(headingMeaning('What you will do')).toBe('responsibility');
    expect(headingMeaning('A day in the life')).toBe('responsibility');
    expect(headingMeaning('Benefits & Perks')).toBe('set-aside');
    expect(headingMeaning('Schedule')).toBe('neutral');
    expect(headingMeaning('Experience with Excel')).toBeNull();
  });

  it('does not read duty timing or negations as a requirement cue', () => {
    expect(findCues('Other duties as required').required).toBeUndefined();
    expect(findCues('Travel when needed').required).toBeUndefined();
    expect(findCues('No experience required').required).toBeUndefined();
    expect(findCues('No experience required').negated).toBe('no experience required');
    expect(findCues('Degree not required, but must be 16 or older').required).toBe('must');
    expect(findCues('Eligible for a performance bonus').preferred).toBeUndefined();
  });

  it('leaves a line unclassified when heading and cue disagree', () => {
    const duty = decideSection(
      { meaning: 'responsibility', heading: 'Responsibilities' },
      findCues('Must keep the stockroom organized')
    );
    expect(duty).toMatchObject({ section: 'unclassified', basis: 'conflict', cue: 'must' });

    const both = decideSection(null, findCues('Excel required and SQL preferred'));
    expect(both.section).toBe('unclassified');
    expect(both.basis).toBe('conflict');
  });

  it('reads an inline label as a heading for the rest of the paragraph', () => {
    const parsed = parsePosting(
      'Responsibilities include greeting guests and keeping the lobby tidy. Requirements: must be able to work Saturdays and early mornings. Preferred: front desk experience at a hotel or gym.'
    );
    expect(parsed.requirements.map((r) => [r.text, r.section])).toEqual([
      ['greeting guests and keeping the lobby tidy.', 'responsibility'],
      ['must be able to work Saturdays and early mornings.', 'required'],
      ['front desk experience at a hotel or gym.', 'preferred'],
    ]);
  });

  it('keeps short lines under a requirement heading and drops them elsewhere', () => {
    const parsed = parsePosting(
      'Requirements\n- Excel\n- Valid driver’s license\n\nRemote\nFull-time'
    );
    expect(parsed.requirements.map((r) => r.text)).toEqual(['Excel', 'Valid driver’s license']);
    const loose = parsePosting('Remote\nFull-time\nExcel');
    expect(loose.requirements).toEqual([]);
  });

  it('reads a capitalized requirement as a requirement, not a heading', () => {
    const parsed = parsePosting('MUST BE 18 OR OLDER');
    expect(parsed.requirements[0]).toMatchObject({ section: 'required' });
  });
});

describe('requirement limit', () => {
  it('raises the old 40-line cap and counts what it drops', () => {
    expect(MAX_REQUIREMENT_LINES).toBeGreaterThan(40);
    const lines = Array.from(
      { length: 60 },
      (_, i) => `- Maintain inventory record number ${i + 1}`
    );
    const raw = `Responsibilities\n${lines.join('\n')}`;
    expect(parsePosting(raw).requirements).toHaveLength(60);
    expect(extractRequirementLines(raw).requirements).toHaveLength(60);

    const capped = parsePosting(raw, { maxRequirements: 10 });
    expect(capped.requirements).toHaveLength(10);
    expect(capped.overLimitCount).toBe(50);
    expect(capped.setAside.filter((s) => s.reason === 'over-limit')).toHaveLength(50);
  });
});

describe('legacy extractRequirementLines', () => {
  it('is the same function from glowup-banks and from the posting engine', () => {
    expect(legacyExtract).toBe(extractRequirementLines);
  });

  it('keeps its line-based behavior', () => {
    const result = extractRequirementLines(
      [
        'Requirements:',
        '• Experience with Python and SQL',
        '1. Build dashboards for the sales team',
        '3.0 GPA or higher in your major',
        'We are an equal opportunity employer and value diversity.',
        'Remote',
      ].join('\n')
    );
    expect(result.requirements).toEqual([
      'Experience with Python and SQL',
      'Build dashboards for the sales team',
      '3.0 GPA or higher in your major',
    ]);
    expect(result.skippedCount).toBe(3);
  });
});

describe('occupation lookup hook', () => {
  it('passes titles through from a caller-supplied lookup and loads nothing itself', () => {
    const raw = 'Data Analyst Intern\nBuild reports in Excel for the finance team';
    const parsed = parsePosting(raw, {
      lookup: {
        matchTitles: (text) => {
          const start = text.indexOf('Data Analyst');
          return [
            { term: 'Data Analyst', start, end: start + 12, code: '15-2051.00' },
            { term: 'Out of range', start: 0, end: 9999 },
          ];
        },
      },
    });
    expect(parsed.titles).toEqual([
      { term: 'Data Analyst', start: 0, end: 12, code: '15-2051.00' },
    ]);
    expect(parsePosting(raw).titles).toEqual([]);
  });
});
