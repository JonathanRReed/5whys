import { describe, expect, it } from 'vitest';
import {
  cleanModelText,
  findInventedClaims,
  firstLine,
  looksLikeRating,
  QUESTION_CLAIM_KINDS,
} from '../src/lib/local-ai/guards';

const kinds = (original: string | string[], generated: string) =>
  findInventedClaims(original, generated).map((c) => [c.kind, c.text]);

describe('findInventedClaims: numbers', () => {
  it('flags a number the student never wrote', () => {
    expect(
      kinds('Posted for the club Instagram', 'Posted 3 times a week for the club Instagram')
    ).toEqual([['number', '3']]);
  });

  it('accepts numbers from the input, with or without thousands separators', () => {
    expect(kinds('Raised 1400 for the food bank', 'Raised 1,400 for the food bank')).toEqual([]);
    expect(kinds('grew from 240 to 610 followers', 'Grew followers from 240 to 610')).toEqual([]);
  });

  it('treats spelled-out and digit numbers as the same value', () => {
    expect(kinds('Tutored three students', 'Tutored 3 students weekly')).toEqual([]);
    expect(kinds('Tutored 25 students', 'Tutored twenty-five students')).toEqual([]);
    expect(kinds('Tutored students', 'Tutored three hundred students')).toEqual([
      ['number', 'three hundred'],
    ]);
  });

  it('does not treat a lone "one" as a count', () => {
    expect(kinds('Ran the front desk', 'Ran the front desk as one of the regulars')).toEqual([]);
  });

  it('flags years and decimals as numbers', () => {
    expect(kinds('Tutored calculus', 'Tutored calculus since 2021 with a 4.8 rating')).toEqual([
      ['number', '2021'],
      ['number', '4.8'],
    ]);
  });

  it('accepts a number scaled with k when the input has the full value', () => {
    expect(kinds('Raised $2,000', 'Raised $2k')).toEqual([]);
    expect(kinds('Raised $2k', 'Raised $2,000')).toEqual([]);
  });
});

describe('findInventedClaims: percentages and money', () => {
  it('flags an invented percentage once, not also as a number', () => {
    expect(kinds('Grew the newsletter', 'Grew the newsletter by 40%')).toEqual([
      ['percentage', '40%'],
    ]);
  });

  it('requires a percentage to be a percentage in the input', () => {
    expect(kinds('Tutored 40 students', 'Raised pass rates 40%')).toEqual([['percentage', '40%']]);
    expect(kinds('cut wait time 40 percent', 'Cut wait time by 40%')).toEqual([]);
  });

  it('flags invented money in symbols and words', () => {
    expect(kinds('Ran a bake sale', 'Ran a bake sale that raised $500')).toEqual([
      ['currency', '$500'],
    ]);
    expect(kinds('Ran a bake sale', 'Ran a bake sale that raised 500 dollars')).toEqual([
      ['currency', '500 dollars'],
    ]);
  });

  it('accepts money the student wrote, even without the sign', () => {
    expect(kinds('Raised 1,400 at the bake sale', 'Raised $1,400 at the bake sale')).toEqual([]);
  });
});

describe('findInventedClaims: dates', () => {
  it('flags months, weekdays, numeric dates, and relative dates', () => {
    expect(
      kinds(
        'Organized the fair',
        'Organized the fair in March, every Friday, on 3/14, and again next semester'
      )
    ).toEqual([
      ['date', 'March'],
      ['date', 'Friday'],
      ['date', '3/14'],
      ['date', 'next semester'],
    ]);
  });

  it('accepts a month the input names in full or short form', () => {
    expect(kinds('Started in Sept', 'Started in September')).toEqual([]);
  });

  it('does not read the verbs may and march as months', () => {
    expect(kinds('Asked students', 'Asked students what they may need')).toEqual([]);
  });
});

describe('findInventedClaims: names and tools', () => {
  it('flags a proper noun in the middle of a sentence', () => {
    expect(kinds('Interned at a clinic', 'Interned at a clinic called Kaiser')).toEqual([
      ['proper-noun', 'Kaiser'],
    ]);
  });

  it('ignores ordinary capitals at the start of a sentence or list item', () => {
    expect(kinds('answered phones', 'Answered phones. Greeted visitors.\n- Kept the log')).toEqual(
      []
    );
  });

  it('flags acronyms and internal capitals even at the start of a sentence', () => {
    expect(kinds('ran a club account', 'LinkedIn posts for the club')).toEqual([
      ['proper-noun', 'LinkedIn'],
    ]);
  });

  it('accepts names from the input in any case and with a possessive', () => {
    expect(kinds('Worked at acme', "Supported Acme's front desk")).toEqual([]);
    expect(kinds('Contact: Priya', 'Hi Priya, thanks for your time')).toEqual([]);
  });

  it('allows the pronoun I and its contractions', () => {
    expect(kinds('helped at the shelter', "Each week I helped, and I'm still there")).toEqual([]);
  });

  it('flags a known tool or skill the student never named, as a tool', () => {
    expect(kinds('Tracked donations', 'Tracked donations in Excel and Tableau')).toEqual([
      ['tool', 'Excel'],
      ['tool', 'Tableau'],
    ]);
  });

  it('flags a lowercase tool too', () => {
    expect(kinds('cleaned survey data', 'cleaned survey data with python')).toEqual([
      ['tool', 'python'],
    ]);
  });

  it('uses context gates so the verb go is not the language Go', () => {
    expect(kinds('helped students', 'helped students go further')).toEqual([]);
  });

  it('accepts tools the student named', () => {
    expect(
      kinds('Built a tracker in Google Sheets', 'Built a donation tracker in Google Sheets')
    ).toEqual([]);
  });
});

describe('findInventedClaims: ownership', () => {
  it('flags a verb of ownership the student did not use', () => {
    expect(kinds('Helped with the rollout', 'Led the rollout')).toEqual([['ownership', 'Led']]);
    expect(kinds('Helped plan the fair', 'Spearheaded the fair')).toEqual([
      ['ownership', 'Spearheaded'],
    ]);
  });

  it('accepts another form of a verb the student used', () => {
    expect(kinds('Responsible for managing the account', 'Managed the account')).toEqual([]);
    expect(kinds('In charge of running the booth', 'Ran the booth')).toEqual([]);
  });

  it('accepts leadership when the student held a role that carries it', () => {
    expect(kinds('President of the chess club', 'Led the chess club')).toEqual([]);
    expect(kinds('Member of the chess club', 'Student leadership in the chess club')).toEqual([
      ['ownership', 'leadership'],
    ]);
  });

  it('can skip ownership for questions put to the student', () => {
    const claims = findInventedClaims('Python required', 'When did you lead a team?', {
      kinds: QUESTION_CLAIM_KINDS,
    });
    expect(claims).toEqual([]);
  });
});

describe('findInventedClaims: shape', () => {
  it('reports every occurrence with offsets the interface can strike', () => {
    const generated = 'Posted 3 times, then 3 more';
    const claims = findInventedClaims('Posted often', generated);
    expect(claims).toHaveLength(2);
    for (const claim of claims) {
      expect(generated.slice(claim.start, claim.end)).toBe(claim.text);
    }
  });

  it('accepts several inputs as a list', () => {
    expect(kinds(['Role: analyst', 'Company: Northwind'], 'Analyst work at Northwind')).toEqual([]);
  });

  it('returns nothing for empty text', () => {
    expect(findInventedClaims('anything', '')).toEqual([]);
  });

  it('returns nothing when the output only rewords the input', () => {
    const original =
      'Responsible for posting 3 times a week on the campus radio Instagram, growing followers from 240 to 610';
    const generated =
      'Posted 3 times a week on the campus radio Instagram, growing followers from 240 to 610';
    expect(findInventedClaims(original, generated)).toEqual([]);
  });
});

describe('output hygiene', () => {
  it('spots ratings', () => {
    expect(looksLikeRating('I would give this line a 7/10.')).toBe(true);
    expect(looksLikeRating('Score: 82')).toBe(true);
    expect(looksLikeRating('This is 4 out of 5.')).toBe(true);
    expect(looksLikeRating('What did you measure, and how?')).toBe(false);
  });

  it('removes em dashes, exclamation marks, and emphasis', () => {
    expect(cleanModelText('**Great** work — really!')).toBe('Great work, really.');
  });

  it('takes the first real line without labels, bullets, or quotes', () => {
    expect(firstLine('\n\nRewrite: "Organized the fair."\nSecond line')).toBe(
      'Organized the fair.'
    );
    expect(firstLine('- What was your part?')).toBe('What was your part?');
  });
});
