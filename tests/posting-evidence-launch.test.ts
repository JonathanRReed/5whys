/**
 * Regressions from the launch review of the posting match. Every input is
 * the exact one the review reproduced; every expectation is what an honest,
 * strict match should say.
 */
import { describe, expect, it } from 'vitest';
import { findNearMisses, findRequirementEvidence, parseYears } from '../src/lib/posting';

const today = new Date(2026, 10, 12);
const evidence = (requirement: string, resume: string) =>
  findRequirementEvidence(requirement, resume, { today });

describe('a denial or a plan is not experience (finding 6)', () => {
  it('does not quote "Never used Python" as evidence of Python', () => {
    const result = evidence(
      'Experience with Python is required.',
      'Jordan Lee\nEXPERIENCE\n• Never used Python in any class or role.'
    );
    expect(result.state).toBe('none');
    expect(result.excerpts).toEqual([]);
  });

  it('does not count a plan to learn Python', () => {
    for (const line of [
      '• Planning to learn Python next semester.',
      '• Will learn Python next semester.',
      '• Hope to use Python in a future class.',
      '• Want to learn Python.',
      '• No experience with Python yet.',
      '• Not yet used Python.',
    ]) {
      const result = evidence(
        'Experience with Python is required.',
        `Jordan Lee\nEXPERIENCE\n${line}`
      );
      expect(result.state, line).toBe('none');
    }
  });

  it('still counts a line that uses Python', () => {
    const result = evidence(
      'Experience with Python is required.',
      'Jordan Lee\nEXPERIENCE\n• Built a grade tracker in Python for my tutoring group.'
    );
    expect(result.state).toBe('evidence');
  });

  it('does not count denied years of a tool', () => {
    const result = evidence(
      'Must have 2 years of Python experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2025\n• Never used Python.'
    );
    expect(result.state).not.toBe('evidence');
    expect(result.excerpts).toEqual([]);
  });

  it('offers no near miss for a negated or planned line', () => {
    const requirement =
      'Coordinate inbound and outbound shipment schedules with carriers and warehouse leads.';
    for (const line of [
      'Never coordinated with the DC on truck schedules or freight flow.',
      'Plan to learn how to coordinate with the DC on truck schedules and freight flow.',
    ]) {
      expect(
        findNearMisses(requirement, `Jordan Lee\nEXPERIENCE\n• ${line}`, { today }),
        line
      ).toEqual([]);
    }
    expect(
      findNearMisses(
        'Track inventory and reconcile stock counts.',
        'Jordan Lee\nEXPERIENCE\n• Never counted items or checked stock.',
        { today }
      )
    ).toEqual([]);
  });
});

describe('"and" in a years requirement asks for both (finding 7)', () => {
  it('does not show Python and SQL when only Python is named', () => {
    const result = evidence(
      'Must have 2 years of Python and SQL experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2025\n• Built APIs using Python.'
    );
    expect(result.state).toBe('partial');
    expect(result.missingTerms.map((t) => t.key)).toContain('sql');
    expect(result.parts.map((p) => p.label).join(' ')).not.toMatch(/Python or SQL/);
  });

  it('shows both when both are named', () => {
    const result = evidence(
      'Must have 2 years of Python and SQL experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2025\n• Built APIs using Python and SQL.'
    );
    expect(result.state).toBe('evidence');
  });

  it('keeps "or" as alternatives', () => {
    const result = evidence(
      'Must have 2 years of Python or SQL experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2025\n• Built APIs using Python.'
    );
    expect(result.state).toBe('evidence');
  });
});

describe('durations are read as written (findings 8 and 15)', () => {
  it('reads 1.5 years as one and a half, not five', () => {
    const years = parseYears('Must have 1.5 years of Python experience.');
    expect(years?.min).toBe(1.5);
    expect(years?.label).toBe('1.5 years');
    const result = evidence(
      'Must have 1.5 years of Python experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2023\n• Built APIs using Python.'
    );
    expect(result.state).toBe('evidence');
    expect(result.note ?? '').not.toMatch(/\b5 years/);
  });

  it('checks a months requirement as a duration', () => {
    const years = parseYears('Must have 3 months of customer service experience.');
    expect(years?.min).toBeCloseTo(0.25);
    expect(years?.label).toBe('3 months');
    const result = evidence(
      'Must have 3 months of customer service experience.',
      'Jordan Lee\nEXPERIENCE\nCashier | Jan 2024 - Jan 2024\n• Delivered customer service at the campus shop.'
    );
    expect(result.state).not.toBe('evidence');
    expect(result.parts.some((p) => p.label === '3 months' && !p.shown)).toBe(true);
  });

  it('meets a six-month requirement with a three-year role', () => {
    const result = evidence(
      'Must have six months of Python experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2023\n• Built APIs using Python.'
    );
    expect(result.kind).toBe('years');
    expect(result.state).toBe('evidence');
  });
});

describe('a tool started late does not get the whole job (finding 16)', () => {
  it('limits Python to the months since it was started', () => {
    const result = evidence(
      'Must have 2 years of Python experience.',
      'Jordan Lee\nEXPERIENCE\nDeveloper | Jan 2020 - Jan 2025\n• Built APIs using Java.\n• Started learning Python in Dec 2024.'
    );
    expect(result.state).not.toBe('evidence');
    expect(result.note ?? '').not.toMatch(/5 years/);
  });
});

describe('an expected degree is in progress (finding 17)', () => {
  it('does not count an expected B.S. as held', () => {
    const result = evidence(
      'Bachelor degree in Computer Science required.',
      'Jordan Lee\nEDUCATION\nB.S. Computer Science, expected May 2028'
    );
    expect(result.state).toBe('partial');
    expect(result.note ?? '').toMatch(/in progress/i);
  });

  it('counts a completed degree', () => {
    const result = evidence(
      'Bachelor degree in Computer Science required.',
      'Jordan Lee\nEDUCATION\nB.S. Computer Science, May 2024'
    );
    expect(result.state).toBe('evidence');
  });

  it('counts an expected degree when the posting asks for one in progress', () => {
    const result = evidence(
      "Pursuing a bachelor's degree in Computer Science.",
      'Jordan Lee\nEDUCATION\nB.S. Computer Science, expected May 2028'
    );
    expect(result.state).toBe('evidence');
  });
});

describe('enrollment is shown by an education line (student F9)', () => {
  const resume =
    'Maya Ortiz\nmaya@example.edu\nLakeshore Community College, Associate in Business, expected May 2027\nEXPERIENCE\nCashier | Jun 2025 - Present\n• Ran the register during lunch rush.';

  it('shows "Currently enrolled" from an expected education line', () => {
    const result = evidence('Currently enrolled in a college or community college program', resume);
    expect(result.state).toBe('evidence');
    expect(result.excerpts[0]?.text).toMatch(/Lakeshore Community College/);
  });

  it('does not show enrollment from a finished degree', () => {
    const result = evidence(
      'Currently enrolled in a college or community college program',
      'Maya Ortiz\nEDUCATION\nLakeshore Community College, Associate in Business, May 2022'
    );
    expect(result.state).not.toBe('evidence');
  });
});

describe('a near miss keeps a named tool missing (finding 24)', () => {
  it('does not offer Excel for a spreadsheet line', () => {
    const misses = findNearMisses(
      'Prepare weekly sales reports using Excel.',
      'Jordan Lee\nEXPERIENCE\n• Prepared weekly sales reports using spreadsheets.',
      { today }
    );
    for (const miss of misses) expect(miss.postingTerms).not.toContain('Excel');
  });
});

describe('the fixes stay strict without losing honest lines', () => {
  it('reads a deadline in months as no experience requirement', () => {
    expect(parseYears('Obtain certification within 6 months of hire')).toBeNull();
    expect(parseYears('Over 2 years of experience in retail')?.minMonths).toBe(24);
  });

  it('splits a list that ends in ", and"', () => {
    expect(
      parseYears(
        'Must have 2 years of experience in operations, logistics, and supply chain'
      )?.fields.map((f) => f.key)
    ).toEqual(['operations', 'logistics', 'supply chain']);
  });

  it('keeps "Never missed a shift" as work done', () => {
    const result = evidence(
      'Experience handling cash',
      'Jordan Lee\nEXPERIENCE\nCashier | Jan 2023 - Present\n• Never missed a shift while handling cash for 200 customers.'
    );
    expect(result.state).toBe('evidence');
  });

  it('counts a finished bachelor even when a master is in progress', () => {
    const resume = 'Jordan\nEDUCATION\nB.S. Biology, 2020\nM.S. Biology, expected 2027';
    expect(evidence("Bachelor's degree required", resume).state).toBe('evidence');
    expect(evidence("Master's degree in Biology required", resume).state).toBe('partial');
    expect(evidence("Pursuing a master's degree", resume).state).toBe('evidence');
  });
});
