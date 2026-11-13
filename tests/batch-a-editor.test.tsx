/**
 * Round 3, batch A: the line editor and its suggestions. A senior visitor
 * sees senior examples, grammar slips get a grammar-only note, typing into a
 * seeded field replaces it, the rewrite button keeps keyboard focus, and a
 * sample never replaces a visitor's resume without asking and an undo.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';
import BulletEditor from '../src/components/resume-game/BulletEditor';
import BulletList from '../src/components/resume-game/BulletList';
import RewriteHelp, { brokenWording } from '../src/components/resume-game/RewriteHelp';
import {
  applyFieldChange,
  createBulletRecord,
  exampleFor,
  generateBulletSuggestions,
  registerForStage,
  scoreLabel,
} from '../src/lib/resume-game';
import { findPassivePhrases } from '../src/lib/resume-game/readability';

afterEach(cleanup);

describe('examples for the visitor who answered Senior or lead', () => {
  it('uses the lead register for a senior stage only', () => {
    expect(registerForStage('senior')).toBe('lead');
    expect(registerForStage('mid')).toBe('work');
    expect(registerForStage('transition')).toBe('work');
    expect(registerForStage('student')).toBe('student');
  });

  it('gives every suggestion a lead example with no first-job wording', () => {
    const record = createBulletRecord('Responsible for safety program', 0);
    const suggestions = generateBulletSuggestions(record, 0);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      const example = exampleFor(suggestion, 'lead');
      if (!example) continue;
      expect(example).not.toMatch(/shelves|register|babysit|campus|club|dairy/i);
    }
    const weak = suggestions.find((s) => s.type === 'weak-verb');
    if (!weak) throw new Error('expected a weak-verb suggestion');
    expect(exampleFor(weak, 'lead')).toContain('safety program');
    expect(exampleFor(weak, 'student')).toContain('welcome week');
  });
});

describe('grammar-only notes', () => {
  const notes = (line: string) =>
    generateBulletSuggestions(createBulletRecord(line, 0)).filter((s) => s.type === 'grammar');

  it('offers the past form for a base-form opening', () => {
    expect(notes('Present the result to the manager team every week')[0]?.message).toContain(
      '"Presented"'
    );
  });

  it('names a bare verb after a comma', () => {
    expect(
      notes('Cleaned and merged 14 tables in SQL, reduce the report time')[0]?.message
    ).toContain('"reducing"');
  });

  it('names "Was" plus a past form', () => {
    expect(notes('Was cleaned and merged 14 tables in SQL')[0]?.message).toContain('"Cleaned"');
  });

  it('says nothing about a line already in the past', () => {
    expect(notes('Presented the result to the managers every week')).toEqual([]);
  });
});

describe('suggestions about joined text', () => {
  it('flags a doubled first word', () => {
    const record = createBulletRecord('Watch my cousin after school.', 0);
    const joined = { ...record, improved: 'Watched Watch my cousin after school.', edited: true };
    expect(generateBulletSuggestions(joined)[0]).toMatchObject({ type: 'double-verb' });
  });

  it('names the old line still inside the new one', () => {
    const record = createBulletRecord('In charge of club money', 0);
    const typed = applyFieldChange(
      record,
      'task',
      'the Business Club budget in a shared sheetIn charge of club money'
    );
    const old = generateBulletSuggestions(typed).find((s) => s.type === 'old-wording');
    expect(old?.message).toContain('"In charge of club money"');
  });

  it('does not call a promotion of other people hidden agency', () => {
    expect(
      findPassivePhrases('Coached 5 supervisors, 3 of whom were promoted to managers', true)
    ).toEqual([]);
    expect(findPassivePhrases('Was cleaned and merged 14 tables', false)).toEqual(['Was cleaned']);
  });
});

describe('the rewrite help', () => {
  it('never offers a wording with a stray comma or a doubled word', () => {
    expect(brokenWording('Scheduled , payroll entry, and shrink reports')).toBe(true);
    expect(brokenWording('Watched watched my cousin')).toBe(true);
    expect(brokenWording('Scheduled shifts and entered payroll each week.')).toBe(false);
  });

  it('stays focusable while it writes', async () => {
    render(<RewriteHelp line="Responsible for social media" />);
    const button = screen.getByRole('button', { name: 'Suggest a rewrite' });
    button.focus();
    fireEvent.click(button);
    const busy = screen.getByRole('button', { name: 'Writing' });
    expect(busy).not.toBeDisabled();
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveFocus();
    await screen.findByRole('button', { name: 'Suggest another' });
  });
});

describe('the line editor', () => {
  it('selects the old words when a field that still holds them takes focus', () => {
    const record = createBulletRecord('In charge of club money', 0);
    render(<BulletEditor bullet={record} onFieldChange={() => {}} />);
    const task = screen.getByLabelText('What the work was') as HTMLTextAreaElement;
    expect(task.value).toBe('club money');
    task.focus();
    fireEvent.focus(task);
    expect(task.selectionStart).toBe(0);
    expect(task.selectionEnd).toBe('club money'.length);
    expect(screen.getByTestId('line-as-written')).toHaveTextContent('In charge of club money');
  });

  it('shows the new wording on a rewritten card, with both scores', () => {
    const record = applyFieldChange(
      createBulletRecord('Watch my cousin after school.', 0),
      'impact',
      'so my aunt can go to work'
    );
    render(<BulletList bullets={[record]} selectedBulletId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent(
      'Watch my cousin after school, so my aunt can go to work.'
    );
    expect(screen.getByRole('button')).toHaveTextContent(`${record.improvedScore}/100, from 30`);
  });

  it('shows Strong in the color for done, not the warning color', () => {
    expect(scoreLabel(85).color).toBe('text-foam');
  });
});

describe('sample resumes', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/resume-game/');
  });

  it('asks before replacing the visitor resume, and can put it back', () => {
    render(<ResumeGame />);
    const box = () => screen.getByLabelText('Paste resume text') as HTMLTextAreaElement;
    fireEvent.change(box(), { target: { value: 'Dani Reyes\n- Watched my cousin after school.' } });

    fireEvent.click(screen.getByRole('button', { name: 'First job' }));
    expect(box().value).toContain('Dani Reyes');
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace your resume with the first job sample?' })
    );
    expect(box().value).toContain('Ava Morales');

    fireEvent.click(screen.getByRole('button', { name: 'Put my resume back' }));
    expect(box().value).toBe('Dani Reyes\n- Watched my cousin after school.');
    expect(screen.queryByRole('button', { name: 'Put my resume back' })).toBeNull();
  });

  it('loads a sample at once into an empty box', () => {
    render(<ResumeGame />);
    fireEvent.click(screen.getByRole('button', { name: 'First job' }));
    expect((screen.getByLabelText('Paste resume text') as HTMLTextAreaElement).value).toContain(
      'Ava Morales'
    );
    expect(screen.queryByRole('button', { name: 'Put my resume back' })).toBeNull();
  });
});

describe('a line picked from the dashboard link', () => {
  it('drops the link from the address once used, so a reload keeps the visitor choice', async () => {
    vi.useFakeTimers();
    localStorage.clear();
    const text = '- Watched my cousin after school.\n- Ran the bake sale table.';
    localStorage.setItem(
      'resume-game-session-v2',
      JSON.stringify({
        resumeText: text,
        bullets: [
          createBulletRecord('Watched my cousin after school.', 0),
          { ...createBulletRecord('Ran the bake sale table.', 1), id: 'second' },
        ],
        selectedBulletId: null,
        lastAnalyzedAt: '2026-11-13T00:00:00.000Z',
        needsRescan: false,
      })
    );
    window.history.replaceState(null, '', '/resume-game/?bullet=second');
    render(<ResumeGame />);
    vi.useRealTimers();
    await screen.findByRole('heading', { name: 'Structured rewrite' });
    expect(window.location.search).toBe('');
    expect(
      JSON.parse(localStorage.getItem('resume-game-session-v2') ?? '{}').selectedBulletId
    ).toBe('second');
  });
});

describe('small wording', () => {
  it('reads "0 of 1 line has", and does not flag a result clause as passive', async () => {
    const { summarySentences } = await import('../src/lib/resume-game');
    expect(
      summarySentences({ total: 1, action: 0, work: 1, result: 1, measure: 0, strong: 1 })[0]
    ).toBe('0 of 1 line starts with what you did.');
    expect(
      findPassivePhrases(
        'Rebuilt the weekly schedule, so every shift was covered without overtime.',
        true
      )
    ).toEqual([]);
  });
});
