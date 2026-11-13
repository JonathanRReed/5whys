import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Career5Whys from '../src/components/Career5Whys';
import {
  buildPrompts,
  computeSynthesis,
  getAnswerNudge,
  HISTORY_KEY,
  HISTORY_LIMIT_KEY,
  normalizeSnapshot,
  quotableAnswer,
  SESSION_KEY,
  TRACKS,
  trackSamples,
  type WhySnapshot,
} from '../src/components/career-5whys/shared';
import WhyForm from '../src/components/career-5whys/WhyForm';
import { isNonAnswer, NON_ANSWER_FOLLOW_UP } from '../src/lib/non-answer';

const ANSWERS = [
  'I like helping people understand hard things.',
  'Explaining makes a scary thing feel smaller for someone.',
  'My aunt was a nurse and I watched her calm a whole room.',
  'I want work where being kind is part of the job.',
  'I need to see that my work changed how someone felt.',
];

function seedSession(extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: 'whySession_one',
      track: 'career',
      topic: 'Nursing',
      responses: ANSWERS,
      updatedAt: '2026-11-01T10:00:00.000Z',
      ...extra,
    })
  );
}

function storedHistory(): WhySnapshot[] {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
}

function snapshot(index: number, extra: Partial<WhySnapshot> = {}): WhySnapshot {
  return {
    id: `snap-${index}`,
    timestamp: new Date(Date.UTC(2026, 9, 1, 12, index)).toISOString(),
    whyStatement: `Statement ${index}`,
    rootReason: '',
    nextStep: '',
    track: 'career',
    topic: `Topic ${index}`,
    responses: ANSWERS,
    updatedAt: '2026-10-01T12:00:00.000Z',
    version: 3,
    ...extra,
  };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Five Whys snapshots', () => {
  it('deletes only the named snapshot when two came from the same session', async () => {
    seedSession();
    render(<Career5Whys />);
    await waitFor(() => expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    fireEvent.change(screen.getByLabelText('Depth 5 response'), {
      target: { value: 'I need to see my work change how a family feels.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    expect(storedHistory()).toHaveLength(2);
    const ids = storedHistory().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(2);

    const deletes = screen.getAllByRole('button', { name: /^Delete snapshot:/ });
    fireEvent.click(deletes[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Delete snapshot: .*\?$/ }));
    expect(storedHistory()).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Load snapshot:/ })).toHaveLength(1);
  });

  it('deletes one of two older snapshots that share an id without taking the other', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([snapshot(1, { id: 'shared' }), snapshot(2, { id: 'shared' })])
    );
    render(<Career5Whys />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Load snapshot:/ })).toHaveLength(2)
    );
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete snapshot:/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Delete snapshot: .*\?$/ }));
    expect(storedHistory()).toHaveLength(1);
  });

  it('keeps a history longer than 12 when the saved limit is 24', async () => {
    const entries = Array.from({ length: 16 }, (_, index) => snapshot(index));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    localStorage.setItem(HISTORY_LIMIT_KEY, '24');
    render(<Career5Whys />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Load snapshot:/ })).toHaveLength(16)
    );
    expect(storedHistory()).toHaveLength(16);
  });

  it('merges with snapshots another tab saved after this page loaded', async () => {
    seedSession();
    render(<Career5Whys />);
    await waitFor(() => expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument());

    // The other tab saves while this one is open.
    const other = snapshot(9, { id: 'from-other-tab', topic: 'Biology reflection A' });
    localStorage.setItem(HISTORY_KEY, JSON.stringify([other]));

    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    const saved = storedHistory();
    expect(saved).toHaveLength(2);
    expect(saved.map((entry) => entry.id)).toContain('from-other-tab');
  });

  it('shows a snapshot saved in another tab when the storage event arrives', async () => {
    render(<Career5Whys />);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([snapshot(3)]));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_KEY }));
    });
    expect(await screen.findByRole('button', { name: /^Load snapshot: Topic 3/ })).toBeVisible();
  });

  it('keeps the chosen real reason when a snapshot is loaded', async () => {
    seedSession({ rootIndex: 0 });
    render(<Career5Whys />);
    await waitFor(() => expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    expect(storedHistory()[0].rootIndex).toBe(0);

    // Choose a different answer, then load the snapshot back.
    fireEvent.click(screen.getAllByRole('radio', { name: /understand hard things|feel/ })[1]);
    fireEvent.click(screen.getByRole('button', { name: /^Load snapshot:/ }));
    const checked = screen
      .getAllByRole('radio')
      .find((radio) => (radio as HTMLInputElement).checked);
    expect(checked?.closest('label')).toHaveTextContent(ANSWERS[0]);
  });

  it('recovers the chosen reason of a snapshot saved before the choice was stored', () => {
    const legacy = normalizeSnapshot({
      ...snapshot(1),
      rootIndex: undefined,
      rootReason: 'I like helping people understand hard things.',
    });
    expect(legacy?.rootIndex).toBe(0);
  });
});

describe('Five Whys track buttons', () => {
  it('does nothing when the track already chosen is pressed again', async () => {
    seedSession();
    render(<Career5Whys />);
    await waitFor(() => expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Career Path/ }));
    expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth 1 response')).toHaveValue(ANSWERS[0]);
  });

  it('keeps the work when switching to the other track', async () => {
    seedSession();
    render(<Career5Whys />);
    await waitFor(() => expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Interest Path/ }));
    expect(screen.getByRole('button', { name: /Interest Path/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByDisplayValue('Nursing')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth 3 response')).toHaveValue(ANSWERS[2]);
  });
});

describe('Five Whys non-answers', () => {
  it.each(['idk', 'n/a', 'nothing', 'none really', '?', 'Idk none really, nothing.', 'not sure'])(
    'treats "%s" as not an answer yet',
    (text) => {
      expect(isNonAnswer(text)).toBe(true);
    }
  );

  it('accepts a short real answer of three words', () => {
    expect(isNonAnswer('I like teaching')).toBe(false);
    expect(isNonAnswer('')).toBe(false);
  });

  it('does not count, quote, or complete a chain with a placeholder', () => {
    const responses = [...ANSWERS.slice(0, 4), 'idk'];
    const synthesis = computeSynthesis(responses, 'Nursing', 'career');
    expect(synthesis.isComplete).toBe(false);
    expect(synthesis.sequentialCount).toBe(4);
    expect(synthesis.whyStatement).not.toContain('idk');

    const early = ['idk', '', '', '', ''];
    expect(computeSynthesis(early, 'Nursing', 'career').sequentialCount).toBe(0);
    expect(buildPrompts('career', 'Nursing', early)[1]).not.toContain('idk');
  });

  it('marks a placeholder "Not yet" and asks one gentle follow-up', () => {
    render(
      <WhyForm
        responses={['n/a', '', '', '', '']}
        sequentialCount={0}
        prompts={buildPrompts('career', 'Nursing', ['n/a'])}
        example={TRACKS.career.example}
        exampleOpen={{}}
        onResponseChange={() => {}}
        onToggleExample={() => {}}
      />
    );
    expect(screen.queryByText('Captured')).not.toBeInTheDocument();
    expect(screen.getByText('Not yet')).toBeInTheDocument();
    expect(screen.getByText(NON_ANSWER_FOLLOW_UP)).toBeInTheDocument();
    expect(screen.getByLabelText('Depth 2 response')).toBeDisabled();
    expect(getAnswerNudge('nothing', '')).toBe(NON_ANSWER_FOLLOW_UP);
  });
});

describe('Five Whys prompts', () => {
  it('quotes a short answer whole and never quotes a clipped one', () => {
    expect(quotableAnswer("I don't know what I want, I just need a job.")).toBe(
      "I don't know what I want, I just need a job"
    );
    const long =
      "I don't know what I want, I just need a job that pays enough for rent and lets me keep taking classes at night.";
    expect(quotableAnswer(long)).toBe('');
    const prompt = buildPrompts('career', 'Nursing', [long])[1];
    expect(prompt).not.toMatch(/\.\.\.|…/);
    expect(prompt).toBe('Why does your first answer matter to you?');
  });

  it('asks about the interest without assuming the visitor would work for free', () => {
    const first = buildPrompts('interest', 'Biology', [])[0];
    expect(first).not.toMatch(/for free/);
  });
});

describe('Five Whys student register', () => {
  it('uses a student Career Path example and placeholder by default', () => {
    const samples = trackSamples('career', 'student');
    expect(samples.example.persona).toMatch(/student/i);
    expect(samples.example.persona).not.toMatch(/career changer/i);
    expect(samples.topicPlaceholder).not.toMatch(/Product manager/);
    expect(trackSamples('career', 'professional').example.persona).toMatch(/Career changer/);
  });

  it('shows the student placeholder when no profile is saved', async () => {
    render(<Career5Whys />);
    expect(await screen.findByPlaceholderText(/Nursing, teaching/)).toBeInTheDocument();
  });

  it('keeps the career-changer sample for a saved non-student profile', async () => {
    localStorage.setItem(
      'career-tools-profile',
      JSON.stringify({ stage: 'mid', focus: 'direction', updatedAt: '2026-11-01T00:00:00Z' })
    );
    render(<Career5Whys />);
    expect(await screen.findByPlaceholderText(/Product manager/)).toBeInTheDocument();
  });
});
