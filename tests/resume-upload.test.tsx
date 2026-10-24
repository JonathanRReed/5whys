import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';

const { extract } = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock('../src/lib/resume-game/extractors', () => ({ extractTextFromFile: extract }));

beforeEach(() => {
  localStorage.clear();
  extract.mockReset();
});
afterEach(cleanup);

it('does not overwrite newer typed work when an earlier upload finishes', async () => {
  let finish: (text: string) => void = () => {};
  extract.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    })
  );
  render(<ResumeGame />);
  fireEvent.change(screen.getByLabelText('Upload resume file (PDF, DOCX, TXT, or Markdown)'), {
    target: { files: [new File(['old'], 'resume.pdf', { type: 'application/pdf' })] },
  });
  await waitFor(() => expect(extract).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText('Paste resume text'), {
    target: { value: 'Newer work that must stay' },
  });
  await act(async () => finish('Older uploaded text'));
  expect(screen.getByLabelText('Paste resume text')).toHaveValue('Newer work that must stay');
});

it('keeps the previous resume on import failure and provides a persistent error', async () => {
  extract.mockRejectedValue(new Error('This PDF has no selectable text.'));
  render(<ResumeGame />);
  fireEvent.change(screen.getByLabelText('Paste resume text'), {
    target: { value: 'Keep this resume' },
  });
  fireEvent.change(screen.getByLabelText('Upload resume file (PDF, DOCX, TXT, or Markdown)'), {
    target: { files: [new File(['bad'], 'resume.pdf', { type: 'application/pdf' })] },
  });
  await expect(screen.findByRole('alert')).resolves.toHaveTextContent('no selectable text');
  expect(screen.getByLabelText('Paste resume text')).toHaveValue('Keep this resume');
});

it.each(['resolve', 'reject'])(
  'keeps a pending upload canceled after confirmed Clear when it later %ss',
  async (outcome) => {
    let finish!: (text: string) => void;
    let fail!: (error: Error) => void;
    extract.mockReturnValue(
      new Promise<string>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      })
    );
    render(<ResumeGame />);
    fireEvent.change(screen.getByLabelText('Upload resume file (PDF, DOCX, TXT, or Markdown)'), {
      target: { files: [new File(['synthetic'], 'resume.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() => expect(extract).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Paste resume text')).toHaveValue('');
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);
    expect(screen.getByText('Reading file...')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear resume and scores?' }));
    expect(screen.queryByText('Reading file...')).toBeNull();
    await act(async () => {
      if (outcome === 'resolve') finish('Older uploaded text');
      else fail(new Error('Older upload failed'));
    });
    expect(screen.getByLabelText('Paste resume text')).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Workspace cleared.');
    const stored = JSON.parse(localStorage.getItem('resume-game-session-v2') ?? 'null');
    expect(stored.resumeText).toBe('');
    expect(stored.bullets).toEqual([]);
  }
);
