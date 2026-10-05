import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import IntroDraft from '../src/components/networking/IntroDraft';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders empty draft state without copy button', () => {
  render(<IntroDraft draft="" onDraftChange={vi.fn()} />);

  expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
});

it('renders draft word count, character count, and copy button when text is provided', () => {
  render(<IntroDraft draft="Hello, I am a software engineer." onDraftChange={vi.fn()} />);

  expect(screen.getByText(/6 words, about 5s aloud \(32\/1500\)/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy intro draft' })).toBeInTheDocument();
});

it('handles copying draft to clipboard and announces to screen readers', async () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });

  render(<IntroDraft draft="My custom intro draft" onDraftChange={vi.fn()} />);

  const copyButton = screen.getByRole('button', { name: 'Copy intro draft' });
  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeTextMock).toHaveBeenCalledWith('My custom intro draft');
    expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft to clipboard.');
    expect(
      screen.getByRole('button', { name: 'Copied intro draft to clipboard' })
    ).toBeInTheDocument();
  });
});
