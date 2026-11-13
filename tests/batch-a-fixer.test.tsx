/**
 * Round 3, batch A: the machine view exposes its line and heading repairs,
 * each one can be undone, and a structured copy that could not be saved says
 * so instead of claiming it was kept.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MachineView from '../src/components/resume-game/MachineView';
import type { ResumeDoc } from '../src/lib/resume-doc';
import { fromText } from '../src/lib/resume-doc';

const db = vi.hoisted(() => ({
  saved: null as unknown,
  save: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../src/lib/local-db', () => ({
  getResumeDoc: async () => (db.saved ? { doc: db.saved, savedAt: 0 } : null),
  saveResumeDoc: db.save,
  deleteResumeDoc: db.remove,
}));

const TEXT = [
  'Avery Chen',
  'avery@example.edu | (555) 201-4477',
  'EXPERIENCE',
  'Library Assistant, Campus Library | Jan 2024 - Present',
  '- Rebuilt the room sign-up form, so more students could reserve rooms.',
  'Things I know',
  'P y t h o n, Excel',
].join('\n');

const docOf = (text: string): ResumeDoc => ({ ...fromText(text), sourceText: text });

/** MachineView with its own state, as the island holds it. */
function Harness({ initial }: { initial: ResumeDoc }) {
  const [doc, setDoc] = React.useState(initial);
  return <MachineView doc={doc} onChange={setDoc} text={doc.sourceText} />;
}

beforeEach(() => {
  localStorage.clear();
  db.saved = null;
  db.save.mockReset();
  db.remove.mockReset();
  db.remove.mockResolvedValue({ ok: true, value: undefined });
});
afterEach(cleanup);

it('retypes a damaged line in place, and undoes it', () => {
  render(<Harness initial={docOf(TEXT)} />);
  // The claim is pinned to the line and repeated on its finding card.
  const claim = 'We read spaced-out letters in "P y t h o n, Excel".';
  expect(screen.getAllByText(claim).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'Retype this line' }));
  const field = screen.getByLabelText('The line as it should read');
  expect(field).toHaveValue('P y t h o n, Excel');
  expect(field).toHaveFocus();
  fireEvent.change(field, { target: { value: 'Python, Excel' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this wording' }));

  expect(screen.getByRole('status')).toHaveTextContent('Line replaced.');
  expect(screen.queryByText(/spaced-out letters/)).toBeNull();
  expect(screen.getAllByText('Python, Excel').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'Undo the last repair' }));
  expect(screen.getByRole('status')).toHaveTextContent('Undone: Line replaced.');
  expect(screen.getAllByText(claim).length).toBeGreaterThan(0);
});

it('renames the line the visitor names as a missing heading', () => {
  render(<Harness initial={docOf(TEXT)} />);
  expect(screen.getByText('No heading we recognize for skills.')).toBeVisible();

  const picker = screen.getByLabelText('Is one of these your skills heading?');
  fireEvent.change(picker, { target: { value: 'text:5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rename it Skills' }));

  expect(screen.getByRole('status')).toHaveTextContent('"Things I know" now reads Skills.');
  expect(screen.queryByText('No heading we recognize for skills.')).toBeNull();
});

it('says a repair was not saved when the device refuses it, and can try again', async () => {
  const text = TEXT;
  db.saved = docOf(text);
  db.save.mockResolvedValue({
    ok: false,
    reason: 'quota',
    message: 'This device has no room left for saved files.',
  });
  localStorage.setItem(
    'resume-game-session-v2',
    JSON.stringify({ resumeText: text, bullets: [], selectedBulletId: null, lastAnalyzedAt: null })
  );
  const { default: ResumeGame } = await import('../src/components/ResumeGame');
  render(<ResumeGame />);

  fireEvent.click(await screen.findByRole('button', { name: 'Retype this line' }));
  fireEvent.change(screen.getByLabelText('The line as it should read'), {
    target: { value: 'Python, Excel' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Use this wording' }));

  const alert = await screen.findByTestId('machine-save-error');
  expect(alert).toHaveTextContent('This copy is not saved on this device.');
  expect(alert).toHaveTextContent('no room left');
  expect(db.save).toHaveBeenCalledTimes(1);

  db.save.mockResolvedValue({ ok: true, value: { doc: null, savedAt: 1 } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
  });
  await waitFor(() => expect(screen.queryByTestId('machine-save-error')).toBeNull());
  expect(db.save).toHaveBeenCalledTimes(2);
});
