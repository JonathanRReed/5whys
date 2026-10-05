import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

// Preserve browser globals so clipboard mocks do not leak between tests.
let originalClipboard: PropertyDescriptor | undefined;
let originalExecCommand: PropertyDescriptor | undefined;

beforeEach(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
});

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else Reflect.deleteProperty(document, 'execCommand');
  vi.useRealTimers();
});

function useDeniedClipboard(fallback: () => boolean) {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn(fallback),
  });
}

it('reports a failed copy instead of claiming success when fallback returns false', async () => {
  useDeniedClipboard(() => false);
  render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy intro draft' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy intro draft')
  );
  expect(screen.getByRole('button', { name: 'Copy intro draft' })).toBeInTheDocument();
  expect(screen.queryByText('Copied!')).toBeNull();
});

it('restores keyboard focus after fallback copying succeeds', async () => {
  useDeniedClipboard(() => true);
  render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  const button = screen.getByRole('button', { name: 'Copy intro draft' });
  button.focus();
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft to clipboard.')
  );
  expect(document.activeElement).toBe(button);
  expect(document.querySelectorAll('textarea')).toHaveLength(1);
});

it('cleans up and reports an error when fallback copying throws', async () => {
  useDeniedClipboard(() => {
    throw new Error('Denied');
  });
  render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  const button = screen.getByRole('button', { name: 'Copy intro draft' });
  button.focus();
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy intro draft')
  );
  expect(document.activeElement).toBe(button);
  expect(document.querySelectorAll('textarea')).toHaveLength(1);
});

it('clears copied feedback as soon as the draft changes', async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  const view = render(<IntroDraft draft="First intro" onDraftChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy intro draft' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Copied intro draft to clipboard' })
    ).toBeInTheDocument()
  );
  view.rerender(<IntroDraft draft="Revised intro" onDraftChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Copy intro draft' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('repeated successful copies create a fresh live announcement', async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy intro draft' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft'));
  const previous = screen.getByRole('status').firstChild;
  fireEvent.click(screen.getByRole('button', { name: 'Copied intro draft to clipboard' }));
  await waitFor(() => expect(screen.getByRole('status').firstChild).not.toBe(previous));
  expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft to clipboard.');
});

it('does not run a late fallback after leaving the draft', async () => {
  let reject!: (reason: Error) => void;
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          })
      ),
    },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn().mockReturnValue(true),
  });
  const view = render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy intro draft' }));
  view.unmount();
  await act(async () => {
    reject(new Error('Denied'));
  });
  expect(document.execCommand).not.toHaveBeenCalled();
});

it('a late rejection cannot overwrite a newer successful copy', async () => {
  let reject!: (reason: Error) => void;
  Object.assign(navigator, {
    clipboard: {
      writeText: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((_, fail) => {
              reject = fail;
            })
        )
        .mockResolvedValue(undefined),
    },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn().mockReturnValue(false),
  });
  render(<IntroDraft draft="My intro" onDraftChange={vi.fn()} />);
  const button = screen.getByRole('button', { name: 'Copy intro draft' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft'));
  await act(async () => {
    reject(new Error('Denied'));
  });
  expect(document.execCommand).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Copied intro draft to clipboard.');
});
