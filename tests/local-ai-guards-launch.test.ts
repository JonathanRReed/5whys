import { describe, expect, it } from 'vitest';
import { findInventedClaims, QUESTION_CLAIM_KINDS } from '../src/lib/local-ai/guards';

// Regression cases from the launch review: each input is the report's exact
// probe, so a guard change that reopens one of these fails here.

const kinds = (original: string | string[], generated: string) =>
  findInventedClaims(original, generated).map((c) => [c.kind, c.text]);

describe('findInventedClaims: a name at the start of a sentence', () => {
  it('flags an employer the visitor never named, even as the first word', () => {
    expect(
      kinds(
        'Prepared weekly customer reports.',
        'Acme hired me to prepare weekly customer reports.'
      )
    ).toEqual([['proper-noun', 'Acme']]);
  });

  it('flags a person with an accented name as a whole word', () => {
    expect(
      kinds('Prepared weekly customer reports.', 'Zoë hired me to prepare weekly customer reports.')
    ).toEqual([['proper-noun', 'Zoë']]);
    expect(kinds('Interned at a clinic', 'Interned at a clinic run by Zoë')).toEqual([
      ['proper-noun', 'Zoë'],
    ]);
  });

  it('flags a possessive name at the start of a sentence', () => {
    expect(kinds('Answered phones.', "Acme's phones were answered by me.")).toEqual([
      ['proper-noun', "Acme's"],
    ]);
  });

  it('still accepts a name the visitor wrote and ordinary opening words', () => {
    expect(
      kinds('Worked at Acme preparing reports.', 'Acme hired me to prepare weekly reports.')
    ).toEqual([]);
    expect(
      kinds('prepared weekly customer reports', 'Prepared weekly customer reports. Kept them tidy.')
    ).toEqual([]);
    expect(kinds('Answered phones', 'Tell me about a time you answered phones.')).toEqual([]);
    expect(kinds('Answered phones', 'What did you learn answering phones?')).toEqual([]);
    expect(kinds('Answered phones', 'Customers called and I answered phones.')).toEqual([]);
  });

  it('does not flag an ordinary opening word in a question', () => {
    const claims = findInventedClaims('Python required', 'Walk me through a project.', {
      kinds: QUESTION_CLAIM_KINDS,
    });
    expect(claims).toEqual([]);
  });
});

describe('findInventedClaims: ownership must be the visitor’s', () => {
  it('does not take another person’s title as the visitor managing', () => {
    expect(
      kinds('Helped the manager prepare reports.', 'Managed the customer reporting team.')
    ).toEqual([['ownership', 'Managed']]);
  });

  it('does not take helping to manage as managing', () => {
    expect(kinds('Helped manage the reports.', 'Managed the customer reporting team.')).toEqual([
      ['ownership', 'Managed'],
    ]);
    expect(kinds('Assisted in leading the club fair.', 'Led the club fair.')).toEqual([
      ['ownership', 'Led'],
    ]);
  });

  it('keeps assistance when the rewrite keeps it', () => {
    expect(kinds('Helped manage the reports.', 'Helped manage the weekly reports.')).toEqual([]);
  });

  it('still accepts the visitor’s own title and own verb', () => {
    expect(kinds('Shift manager at the campus cafe', 'Managed the campus cafe shift.')).toEqual([]);
    expect(kinds('Worked as a manager at the cafe', 'Managed the cafe.')).toEqual([]);
    expect(kinds('Managed the front desk.', 'Managed the front desk.')).toEqual([]);
    expect(kinds('Responsible for managing the account', 'Managed the account')).toEqual([]);
  });
});

describe('findInventedClaims: money must be money in the input', () => {
  it('flags a count that becomes dollars', () => {
    expect(
      kinds(
        'Prepared 10 reports each month.',
        'Prepared reports that increased sales by 10 dollars.'
      )
    ).toEqual([['currency', '10 dollars']]);
    expect(
      kinds('Prepared 10 reports each month.', 'Prepared reports that increased sales by $10.')
    ).toEqual([['currency', '$10']]);
  });

  it('flags money written in number words', () => {
    expect(
      kinds('Prepared 10 reports each month.', 'Prepared reports that raised ten dollars.')
    ).toEqual([['currency', 'ten dollars']]);
  });

  it('still accepts money the visitor raised or wrote with a sign', () => {
    expect(kinds('Raised 1,400 at the bake sale', 'Raised $1,400 at the bake sale')).toEqual([]);
    expect(kinds('Collected $300 in donations', 'Collected 300 dollars in donations')).toEqual([]);
  });
});

describe('findInventedClaims: percentages in words', () => {
  it('flags a percentage written in words', () => {
    expect(
      kinds('Prepared 10 reports each month.', 'Prepared reports that increased sales ten percent.')
    ).toEqual([['percentage', 'ten percent']]);
    expect(
      kinds(
        'Prepared 10 reports each month.',
        'Prepared reports that increased sales ten per cent.'
      )
    ).toEqual([['percentage', 'ten per cent']]);
  });

  it('accepts a percentage the visitor wrote in either form', () => {
    expect(kinds('Cut wait time 10%', 'Cut wait time by ten percent')).toEqual([]);
    expect(kinds('Cut wait time ten percent', 'Cut wait time by 10%')).toEqual([]);
  });
});

describe('findInventedClaims: a month and year is one date', () => {
  it('flags months and years recombined into new dates', () => {
    expect(
      kinds(
        'Prepared reports in May 2024 and June 2025.',
        'Prepared reports in May 2025 and June 2024.'
      )
    ).toEqual([
      ['date', 'May 2025'],
      ['date', 'June 2024'],
    ]);
  });

  it('accepts the same dates in another order or format', () => {
    expect(
      kinds(
        'Prepared reports in May 2024 and June 2025.',
        'Prepared reports in June 2025 and May 2024.'
      )
    ).toEqual([]);
    expect(kinds('Started 05/2024', 'Started in May 2024')).toEqual([]);
    expect(kinds('Started in Sept 2023', 'Started in September 2023')).toEqual([]);
  });
});
