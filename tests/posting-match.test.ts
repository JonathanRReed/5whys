import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractRequirementTerms,
  findRequirementEvidence,
  findTermMatches,
  type OccupationLookup,
  parsePosting,
} from '../src/lib/posting';

const resume = readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'postings', 'student-resume.txt'),
  'utf8'
);

const keys = (text: string) => extractRequirementTerms(text).map((t) => t.key);

function evidenceTexts(requirement: string, document: string): string[] {
  return findRequirementEvidence(requirement, document).excerpts.flatMap((e) =>
    e.matches.map((m) => m.text)
  );
}

describe('generic words are never requirements or matches', () => {
  const GENERIC = ['currently', 'enrolled', 'degree', 'program'];

  it('finds no term in an enrollment requirement', () => {
    expect(keys('Must be currently enrolled in a degree program')).toEqual([]);
    expect(keys('Currently enrolled in an accredited degree program')).toEqual([]);
    for (const word of GENERIC) expect(keys(word), word).toEqual([]);
  });

  it('does not count those words as evidence even when the resume repeats them', () => {
    expect(resume).toMatch(/Currently enrolled in the honors program/);
    const evidence = findRequirementEvidence(
      'Must be currently enrolled in a degree program',
      resume
    );
    expect(evidence.terms).toEqual([]);
    expect(evidence.excerpts).toEqual([]);
  });

  it('never produces them as a term from any fixture posting', () => {
    for (const name of [
      'student-internship',
      'retail-part-time',
      'entry-level-analyst',
      'no-headings',
      'one-paragraph',
      'nested-bullets',
    ]) {
      const raw = readFileSync(
        path.join(import.meta.dirname, 'fixtures', 'postings', `${name}.txt`),
        'utf8'
      );
      for (const requirement of parsePosting(raw).requirements) {
        for (const term of extractRequirementTerms(requirement.text)) {
          for (const variant of term.variants) {
            for (const word of variant.split(/[\s-]+/)) {
              expect(GENERIC, `${name}: ${requirement.text}`).not.toContain(word);
            }
          }
        }
      }
    }
  });

  it('keeps the real term next to generic words', () => {
    expect(keys("Currently enrolled in a bachelor's degree program in Computer Science")).toEqual([
      "bachelor's",
      'computer science',
    ]);
  });

  it('turns a short requirement the student typed into terms', () => {
    expect(keys('Spanish')).toEqual(['spanish']);
    expect(keys('Food handler card')).toEqual(['food handler', 'handler card']);
    expect(evidenceTexts('Valid driver’s license', "Driver's license, clean record")).toEqual([
      "Driver's license",
    ]);
  });

  it('finds nothing a resume could show in eligibility lines', () => {
    expect(keys('Must be 18 years or older')).toEqual([]);
    expect(keys('Must be able to lift 30 pounds and stand for long periods')).toEqual([]);
    expect(keys('Availability to work weekends and holidays')).toEqual([]);
    expect(keys('Comfortable working in a fast-paced environment as a self-starter')).toEqual([]);
  });
});

describe('skill bank aliases', () => {
  it('lets a skill name be shown by any of its tools', () => {
    expect(evidenceTexts('Experience with JavaScript', 'Built a budgeting app in React')).toEqual([
      'React',
    ]);
    expect(evidenceTexts('Knowledge of Python', 'Cleaned data with pandas')).toEqual(['pandas']);
  });

  it('does not let one tool stand in for another', () => {
    expect(evidenceTexts('Experience with Tableau', 'Built pivot tables in Excel')).toEqual([]);
    expect(evidenceTexts('Experience with Django', 'Wrote Python scripts')).toEqual([]);
  });

  it('treats spellings of one thing as the same', () => {
    expect(evidenceTexts("Bachelor's degree required", 'B.S. in Economics')).toEqual(['B.S.']);
    expect(evidenceTexts("Bachelor's degree required", 'BA, History, 2026')).toEqual(['BA']);
    expect(evidenceTexts('Point of sale experience', 'Ran the POS at closing')).toEqual(['POS']);
    expect(evidenceTexts('Experience with POS systems', 'Used a point-of-sale register')).toEqual([
      'point-of-sale',
    ]);
    expect(evidenceTexts('Front-end development', 'Frontend work on a class site')).toEqual([
      'Frontend',
    ]);
    expect(evidenceTexts('Cash handling experience', 'Handled cash for 200 customers')).toEqual([
      'Handled cash',
    ]);
  });

  it('ignores bank keywords that are ordinary words in a posting', () => {
    expect(keys('Available for the Spring 2027 semester')).toEqual([]);
    expect(keys('Build pivot tables in Excel')).toEqual(['pivot tables', 'excel']);
    expect(
      extractRequirementTerms('Build pivot tables in Excel').some(
        (t) => t.skillId === 'adaptability'
      )
    ).toBe(false);
  });

  it('only counts Excel the program, not "excel" the verb', () => {
    expect(evidenceTexts('Proficient in Excel', 'I excel at teamwork')).toEqual([]);
    expect(evidenceTexts('Proficient in Excel', 'Built models in Excel')).toEqual(['Excel']);
  });

  it('matches on word boundaries only', () => {
    expect(evidenceTexts('Experience with AI tools', 'Sent email campaigns')).toEqual([]);
    expect(evidenceTexts('Knowledge of Java', 'Wrote JavaScript for a class site')).toEqual([]);
    expect(evidenceTexts('Knowledge of Java', 'Wrote Java for a class project')).toEqual(['Java']);
    // MySQL is a kind of SQL, so it counts.
    expect(evidenceTexts('Knowledge of SQL', 'Wrote MySQL queries')).toEqual(['MySQL']);
  });
});

describe('simple morphology', () => {
  it('matches plural, -ing, and -ed forms', () => {
    expect(evidenceTexts('Greet customers', 'Greeted each customer at the door')).toEqual([]);
    expect(evidenceTexts('Greet customers', 'Greeted customers at the door')).toEqual([
      'Greeted customers',
    ]);
    expect(evidenceTexts('Stock shelves weekly', 'Stocking shelves overnight')).toEqual([
      'Stocking shelves',
    ]);
    expect(evidenceTexts('Plan events for members', 'Planned events for 80 members')).toEqual([
      'Planned events',
    ]);
    expect(evidenceTexts('Manage databases', 'Designed a database for the club')).toEqual([
      'database',
    ]);
    expect(
      evidenceTexts('Study ridership data by route', 'Studied ridership in two cities')
    ).toEqual(['Studied ridership']);
  });
});

describe('match offsets', () => {
  it('points every match and excerpt at the searched text', () => {
    const evidence = findRequirementEvidence('Experience with Excel and SQL', resume);
    expect(evidence.excerpts.length).toBeGreaterThan(0);
    for (const excerpt of evidence.excerpts) {
      expect(resume.slice(excerpt.start, excerpt.end)).toBe(excerpt.text);
      for (const match of excerpt.matches) {
        expect(resume.slice(match.start, match.end)).toBe(match.text);
        expect(match.start).toBeGreaterThanOrEqual(excerpt.start);
        expect(match.end).toBeLessThanOrEqual(excerpt.end);
      }
    }
  });

  it('keeps offsets right through curly quotes', () => {
    const doc = 'Jordan’s project: wrote SQL for a bachelor’s thesis';
    const matches = findTermMatches(extractRequirementTerms("Bachelor's degree and SQL"), doc);
    expect(matches.map((m) => doc.slice(m.start, m.end))).toEqual(['SQL', 'bachelor’s']);
  });

  it('marks excerpts from a skills list as listed', () => {
    const evidence = findRequirementEvidence('Experience with Tableau', resume);
    expect(evidence.excerpts).toHaveLength(1);
    expect(evidence.excerpts[0]).toMatchObject({
      text: 'Excel, SQL, Tableau, Spanish (conversational)',
      listedOnly: true,
    });
    const described = findRequirementEvidence('Experience with pivot tables', resume);
    expect(described.excerpts[0].listedOnly).toBe(false);
  });

  it('cuts a letter paragraph into sentence excerpts', () => {
    const letter = `Dear hiring team, I am a second-year economics student at Ohio Valley University and I am applying for the data analytics internship. Last spring I cleaned survey data in Excel for a faculty study, which taught me to check every column before trusting a total. I would welcome the chance to bring that care to your planning team.`;
    const evidence = findRequirementEvidence('Experience with Excel', letter);
    expect(evidence.excerpts).toHaveLength(1);
    expect(evidence.excerpts[0].text).toBe(
      'Last spring I cleaned survey data in Excel for a faculty study, which taught me to check every column before trusting a total.'
    );
  });

  it('reports found and missing terms separately', () => {
    const evidence = findRequirementEvidence('Python or R for data analysis', resume);
    expect(evidence.foundTerms.map((t) => t.key)).toEqual(['data analysis']);
    expect(evidence.missingTerms.map((t) => t.key)).toEqual(['python']);
  });
});

describe('occupation lookup hook', () => {
  const lookup: OccupationLookup = {
    matchSoftware(text) {
      const start = text.indexOf('QuickBooks');
      return start === -1
        ? []
        : [{ term: 'Intuit QuickBooks', start, end: start + 10, aliases: ['QuickBooks'] }];
    },
  };

  it('adds software terms from a caller-supplied dataset', () => {
    const terms = extractRequirementTerms('Bookkeeping in QuickBooks', { lookup });
    expect(terms.find((t) => t.source === 'occupation')).toMatchObject({
      key: 'intuit quickbooks',
      label: 'QuickBooks',
      variants: ['intuit quickbooks', 'quickbooks'],
    });
    expect(
      findRequirementEvidence('Bookkeeping in QuickBooks', 'Reconciled accounts in QuickBooks', {
        lookup,
      }).foundTerms.map((t) => t.key)
    ).toContain('intuit quickbooks');
  });

  it('works without a dataset', () => {
    expect(keys('Bookkeeping in QuickBooks')).toEqual(['quickbooks']);
  });
});
