/**
 * Regression tests from the student and career-changer walkthroughs
 * (2026-11-12). Every line below is a real line from those reports.
 */
import { File as NodeFile } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RewriteHelp from '../src/components/resume-game/RewriteHelp';
import Scoreboard from '../src/components/resume-game/Scoreboard';
import { readCareerDashboard } from '../src/lib/career-bridge';
import type { ResumeDoc, ResumeLine } from '../src/lib/resume-doc';
import { extractDocx, extractPdf, toEditorText } from '../src/lib/resume-doc';
import type { BulletFields } from '../src/lib/resume-game';
import {
  applyFieldChange,
  buildBullet,
  buildReviewReport,
  createBulletRecord,
  detectResumeStructure,
  FIELD_PLACEHOLDERS,
  generateBulletSuggestions,
  hasResult,
  PROFESSIONAL_PLACEHOLDER,
  PROFESSIONAL_SAMPLE_RESUME,
  registerForStage,
  STRONG_SCORE,
  scoreBullet,
  scoreParts,
  summarizeLines,
  summarySentences,
  useResumeSession,
} from '../src/lib/resume-game';
import { docxBytes, xmlParagraph } from './fixtures/resume-doc';

afterEach(cleanup);

const suggestionText = (line: string) =>
  generateBulletSuggestions(createBulletRecord(line, 0))
    .flatMap((s) => [s.message, s.fix ?? ''])
    .join(' ');

describe('one score per line, with its parts', () => {
  it('adds the four parts to the line score', () => {
    const line = 'worked the register and made food';
    const parts = scoreParts(line);
    expect(
      parts.action.points + parts.work.points + parts.result.points + parts.measure.points
    ).toBe(scoreBullet(line));
  });

  it('describes the resume in counts, not percentages', () => {
    const lines = [
      'posted on instagram for the club',
      'worked the register and made food',
      'helped w inventory',
      'helped out on weekends',
      'Packed donations at the food bank on Saturdays so families could pick up groceries (40 boxes)',
    ];
    const sentences = summarySentences(summarizeLines(lines));
    expect(sentences).toContain('1 of 5 lines says what happened because of the work.');
    expect(sentences).toContain('1 of 5 lines has a number that says what it counts.');
    expect(sentences.join(' ')).not.toMatch(/%/);
  });

  it('downloads a review that says it is a review, with no retired numbers', () => {
    const bullets = ['posted on instagram for the club', 'worked the register and made food'].map(
      (line, index) => createBulletRecord(line, index)
    );
    const report = buildReviewReport(bullets, '2026-11-12');
    expect(report.split('\n')[0]).toBe('# Resume Game review');
    expect(report).toMatch(/not a resume/);
    expect(report).not.toMatch(
      /health score|Visible value|Average|Target|Signal|Hidden value|Quantified|Verb coverage/i
    );
    expect(report).not.toMatch(/—/);
  });

  it('labels the downloads as a review', () => {
    render(<Scoreboard bullets={[]} onExportDocx={() => {}} onExportMarkdown={() => {}} />);
    expect(screen.getByRole('button', { name: 'Download this review (Word)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download this review (Markdown)' })).toBeVisible();
    expect(screen.queryByText(/Export DOCX|Export Markdown|Average/)).toBeNull();
  });
});

describe('scoring fairness', () => {
  it('lets an honest line with no number score strong', () => {
    for (const line of [
      'Built an Excel cycle count routine that gave the store the best inventory variance in the district two years running',
      'Packed donations at the food bank on Saturdays so families could pick up groceries',
    ]) {
      expect(scoreBullet(line)).toBeGreaterThanOrEqual(STRONG_SCORE);
    }
  });

  it('does not reward a number that says nothing (the invented "30")', () => {
    const record = createBulletRecord('worked the register and made food', 0);
    const edited = applyFieldChange(record, 'quantifier', '30');
    expect(edited.improvedScore).toBe(record.baselineScore);
    expect(edited.improved).toBe('Worked the register and made food.');
  });

  it('treats a team size as scope, not a result', () => {
    const line =
      'Supervised a 14-person produce and deli team; wrote the weekly schedule and ordering.';
    expect(scoreParts(line).measure.points).toBe(0);
    expect(scoreParts(line).measure.note).toMatch(/size of the group/);
    expect(suggestionText(line)).not.toMatch(/Tie your number/);
    expect(
      scoreParts('Ran a $14M-volume store with 62 associates across three shifts.').measure.note
    ).toMatch(/\$14M/);
  });

  it('recognizes results written without "to" or "which"', () => {
    expect(hasResult('kept payroll within 2% of plan for 11 straight quarters')).toBe(true);
    expect(hasResult('promoted 9 associates into key holder roles')).toBe(true);
    for (const line of [
      'Owned the weekly labor schedule in Kronos and kept payroll within 2% of plan for 11 straight quarters.',
      'Hired, trained, and coached associates; promoted 9 associates into key holder or department lead roles.',
      'Covered for the store manager during a 4-month leave and kept the store on plan.',
      'Coordinated with the DC on truck schedules and freight flow; got trucks worked within 6 hours of arrival.',
    ]) {
      expect(scoreBullet(line)).toBe(100);
      expect(suggestionText(line)).not.toMatch(/result is not|happened because/);
    }
  });

  it('scores vague one-clause lines low but not zero, and asks what happened', () => {
    for (const line of ['worked the register and made food', 'posted on instagram for the club']) {
      const score = scoreBullet(line);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(50);
      const impact = generateBulletSuggestions(createBulletRecord(line, 0)).find(
        (s) => s.type === 'missing-impact'
      );
      expect(impact?.fix).toMatch(/^What happened because you did this\?/);
    }
  });

  it('is deterministic', () => {
    const line =
      'Cut shrink from 2.9% to 1.6% of sales by fixing receiving checks and retraining the back-of-house crew.';
    expect(scoreBullet(line)).toBe(scoreBullet(line));
    expect(scoreBullet(line)).toBe(100);
  });
});

describe('verbs', () => {
  it('reads ordinary verbs as verbs', () => {
    for (const line of [
      'posted on instagram for the club',
      'Owned the weekly labor schedule in Kronos.',
      'Ran the freight and receiving side of the store.',
      'Covered for the store manager during a 4-month leave.',
      'Stocked the dairy aisle',
      'Served guests at the front counter',
      'Counted both registers at close',
    ]) {
      expect(scoreParts(line).action.points).toBe(20);
      expect(suggestionText(line)).not.toMatch(/instead of an action verb|does not start with/);
    }
  });

  it('never offers a grander verb than the work', () => {
    for (const line of [
      'worked the register and made food',
      'helped w inventory',
      'helped out on weekends',
      'posted on instagram for the club',
    ]) {
      expect(suggestionText(line)).not.toMatch(/Built|Enabled|Try "|Try:/);
    }
  });

  it('asks what the visitor did, from a small table of honest equivalents', () => {
    expect(suggestionText('helped w inventory')).toMatch(/What was your part\?/);
    expect(suggestionText('Responsible for scheduling the front desk')).toMatch(
      /Who did the scheduling\? If it was you, start the line with "Scheduled"\./
    );
    expect(suggestionText('Responsible for social media')).toMatch(
      /What did you do as the person responsible\?/
    );
  });
});

describe('the structured rewrite builds a sentence', () => {
  const base: BulletFields = {
    verb: 'Packed',
    task: 'donations at the food bank on Saturdays',
    impact: 'so families could pick up groceries',
    quantifier: '40 boxes',
  };
  const keys = ['verb', 'task', 'impact', 'quantifier'] as const;

  it('replaces the line\'s own verb instead of prepending (report: "Ran posted on instagram")', () => {
    const record = createBulletRecord('posted on instagram for the club', 0);
    expect(applyFieldChange(record, 'verb', 'Ran').improved).toBe('Ran on instagram for the club.');
  });

  it('never doubles "to" or "so" (report: "to so families")', () => {
    expect(buildBullet(base)).toBe(
      'Packed donations at the food bank on Saturdays, 40 boxes, so families could pick up groceries.'
    );
    expect(buildBullet({ ...base, impact: 'to keep the pantry stocked' })).toBe(
      'Packed donations at the food bank on Saturdays, 40 boxes, to keep the pantry stocked.'
    );
    expect(
      buildBullet({ ...base, impact: 'families could pick up groceries', quantifier: '' })
    ).toBe('Packed donations at the food bank on Saturdays, so families could pick up groceries.');
  });

  it('places a measure where it reads, not always in parentheses', () => {
    expect(buildBullet({ ...base, impact: '', quantifier: 'for 40 families a week' })).toBe(
      'Packed donations at the food bank on Saturdays for 40 families a week.'
    );
    expect(buildBullet({ ...base, impact: '' })).toBe(
      'Packed donations at the food bank on Saturdays, 40 boxes.'
    );
  });

  it('joins a result that starts with its own verb', () => {
    expect(
      buildBullet({
        verb: 'Owned',
        task: 'the weekly labor schedule in Kronos',
        impact: 'kept payroll within 2% of plan',
        quantifier: '',
      })
    ).toBe('Owned the weekly labor schedule in Kronos and kept payroll within 2% of plan.');
  });

  it('builds a pasteable sentence for every combination of filled fields', () => {
    for (let mask = 1; mask < 16; mask += 1) {
      const fields: BulletFields = { verb: '', task: '', impact: '', quantifier: '' };
      keys.forEach((key, bit) => {
        if (mask & (1 << bit)) fields[key] = base[key];
      });
      const sentence = buildBullet(fields);
      const label = JSON.stringify(fields);
      expect(sentence, label).toMatch(/^[A-Z0-9]/);
      expect(sentence, label).toMatch(/[a-z]\.$/);
      expect(sentence, label).not.toMatch(/\bto so\b|\bso so\b|\bto to\b|\(|\)|\s{2}|\s[,.]|,,/);
      for (const key of keys) {
        if (fields[key]) expect(sentence.toLowerCase(), label).toContain(fields[key].toLowerCase());
      }
    }
  });

  it('replaces "Responsible for" with the verb instead of stacking it on the -ing word', () => {
    const record = createBulletRecord('Responsible for opening and closing the store', 0);
    expect(applyFieldChange(record, 'verb', 'Opened').improved).toBe(
      'Opened and closed the store.'
    );
    const other = createBulletRecord('Responsible for scheduling the front desk', 0);
    expect(applyFieldChange(other, 'verb', 'Scheduled').improved).toBe('Scheduled the front desk.');
  });

  it('keeps an untouched line exactly as written', () => {
    const line =
      'Hired, trained, and coached associates; promoted 9 associates into key holder roles.';
    const record = createBulletRecord(line, 0);
    expect(record.improved).toBe(line);
    expect(buildBullet(record.fields)).toBe(line);
  });
});

describe('uploaded files reach the editor as whole bullets', () => {
  beforeEach(() => {
    vi.stubGlobal('File', NodeFile);
    vi.stubGlobal('window', undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  const changerText = readFileSync('tests/fixtures/changer/resume.txt', 'utf8');
  const expected = detectResumeStructure(changerText).bullets;

  it.each(['resume-single.pdf', 'resume-sidebar.pdf'])(
    'scores the same 13 lines from %s as from the text',
    async (name) => {
      const bytes = readFileSync(`tests/fixtures/changer/${name}`);
      const doc = await extractPdf(new File([bytes], name, { type: 'application/pdf' }));
      const text = toEditorText(doc);
      const scored = detectResumeStructure(text).bullets;
      expect(expected).toHaveLength(13);
      expect(scored).toEqual(expected);
      expect(text).toContain(
        '- Cut shrink from 2.9% to 1.6% of sales by fixing receiving checks and retraining the back-of-house crew.'
      );
      expect(text).not.toMatch(/back-of- house/);
    }
  );

  it('keeps DOCX list paragraphs as "- " bullets', async () => {
    const bytes = await docxBytes(
      [
        xmlParagraph('EXPERIENCE'),
        xmlParagraph('Stocked the dairy aisle on the overnight shift', true),
        xmlParagraph('Counted both registers at close', true),
      ].join('')
    );
    const text = toEditorText(await extractDocx(bytes, 'resume.docx'));
    expect(text).toBe(
      'EXPERIENCE\n- Stocked the dairy aisle on the overnight shift\n- Counted both registers at close'
    );
  });

  it('rejoins a word split at a line-end hyphen', () => {
    const line = (id: string, text: string, extra: Partial<ResumeLine> = {}): ResumeLine => ({
      id,
      text,
      pageIndex: 0,
      box: null,
      fontName: null,
      fontSize: null,
      origin: { kind: 'body', part: 'text' },
      bullet: false,
      items: [],
      ...extra,
    });
    const doc = {
      source: 'text',
      file: { name: 'r.txt', sizeBytes: 0, pageCount: null },
      pages: [{ index: 0, width: null, height: null, hasImages: null }],
      lines: [
        line('a', 'Cut shrink by retraining the back-of-', { bullet: true }),
        line('b', 'house crew.', { continuationOf: 'a' }),
      ],
      extractionOrder: ['a', 'b'],
      geometricOrder: ['a', 'b'],
      sections: [],
      contact: { email: null, phone: null, links: [] },
      plainText: '',
      findings: [],
    } satisfies ResumeDoc;
    expect(toEditorText(doc)).toBe('- Cut shrink by retraining the back-of-house crew.');
  });
});

describe('register follows the profile stage', () => {
  const SOFTWARE =
    /deploy|billing system|dashboard|\$500K|adoption|Q1|cross-functional|API|enterprise/i;

  it('gives students the student set and everyone else the work set', () => {
    expect(registerForStage(null)).toBe('student');
    expect(registerForStage('student')).toBe('student');
    expect(registerForStage('early')).toBe('student');
    expect(registerForStage('transition')).toBe('work');
    expect(registerForStage('mid')).toBe('work');
  });

  it('keeps software language out of placeholders, samples, and examples', () => {
    const lines = [
      'posted on instagram for the club',
      'Supervised a 14-person produce and deli team; wrote the weekly schedule and ordering.',
      'Ran a $14M-volume store with 62 associates across three shifts and four department leads.',
      'Responsible for the front desk',
    ];
    const examples = lines.flatMap((line) =>
      generateBulletSuggestions(createBulletRecord(line, 0)).flatMap((s) => [
        s.studentExample ?? '',
        s.workExample ?? '',
      ])
    );
    for (const text of [
      ...Object.values(FIELD_PLACEHOLDERS.student),
      ...Object.values(FIELD_PLACEHOLDERS.work),
      PROFESSIONAL_PLACEHOLDER,
      PROFESSIONAL_SAMPLE_RESUME,
      ...examples,
    ]) {
      expect(text).not.toMatch(SOFTWARE);
      expect(text).not.toMatch(/—|!/);
    }
  });
});

describe('the rewrite help fits where it is shown', () => {
  it('treats a capital letter as no new wording and uses the given follow-on', async () => {
    render(
      <RewriteHelp
        line="posted on instagram for the club"
        noneFollowUp="Add it above, in your words."
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a rewrite' }));
    expect(
      await screen.findByText(
        /No safer wording found without adding facts\. Add it above, in your words\./
      )
    ).toBeVisible();
    expect(screen.queryByTestId('rewrite-text')).toBeNull();
  });
});

describe('older saved work', () => {
  beforeEach(() => localStorage.clear());

  const oldSession = {
    resumeText: 'worked the register and made food',
    needsRescan: false,
    lastAnalyzedAt: '2026-11-01T00:00:00Z',
    selectedBulletId: 'b1',
    bullets: [
      {
        id: 'b1',
        original: 'worked the register and made food',
        improved: 'worked the register and made food',
        baselineScore: 11,
        improvedScore: 11,
        fields: { verb: 'Worked', task: 'the register and made food', impact: '', quantifier: '' },
      },
    ],
    signalReport: {
      visible: 16,
      hidden: 84,
      benchmarkScore: 59,
      impactCoverage: 0,
      quantifiedBulletPercent: 0,
      numbers: 0,
      verbs: 1,
      wordCount: 6,
      bulletCount: 1,
      estimatedPages: 1,
      sections: [],
      hardSkills: [],
      softSkills: [],
      isOptimalLength: false,
      lengthRecommendation: '',
    },
  };

  it('opens, rescored under the current rubric, without the retired numbers', async () => {
    localStorage.setItem('resume-game-session-v2', JSON.stringify(oldSession));
    const { result } = renderHook(() => useResumeSession());
    await waitFor(() => expect(result.current.session.bullets).toHaveLength(1));
    const { session } = result.current;
    expect(session.bullets[0].baselineScore).toBe(scoreBullet('worked the register and made food'));
    expect(session.signalReport).not.toHaveProperty('benchmarkScore');
    expect(session.signalReport).not.toHaveProperty('visible');
  });

  it('shows the dashboard a count of strong lines, not an average', () => {
    localStorage.setItem(
      'resume-game-session-v2',
      JSON.stringify({
        ...oldSession,
        bullets: [
          { ...oldSession.bullets[0], improvedScore: 30 },
          { ...oldSession.bullets[0], id: 'b2', improvedScore: 100 },
        ],
      })
    );
    const resume = readCareerDashboard().resume;
    expect(resume?.strongCount).toBe(1);
    expect(resume).not.toHaveProperty('averageScore');
  });
});
