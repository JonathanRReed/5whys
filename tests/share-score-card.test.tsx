import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toPng } from 'html-to-image';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ShareScoreCard from '../src/components/resume-game/ShareScoreCard';
import { createBulletRecord, STRONG_SCORE } from '../src/lib/resume-game';

// Mock html-to-image
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// The real report lines that score strong: each says what was done and
// what happened because of it.
const STRONG_LINES = [
  'Owned the weekly labor schedule in Kronos and kept payroll within 2% of plan for 11 straight quarters.',
  'Cut shrink from 2.9% to 1.6% of sales by fixing receiving checks and retraining the back-of-house crew.',
];
const strongBullets = STRONG_LINES.map((line, index) => createBulletRecord(line, index));

it('does not appear when any scored line is below the strong label', () => {
  const weak = createBulletRecord('worked the register and made food', 2);
  expect(weak.improvedScore).toBeLessThan(STRONG_SCORE);
  const { container } = render(<ShareScoreCard bullets={[...strongBullets, weak]} />);
  expect(container).toBeEmptyDOMElement();
  render(<ShareScoreCard bullets={[]} />);
  expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
});

it('shows a count, not a composite score, when every line is strong', () => {
  render(<ShareScoreCard bullets={strongBullets} />);
  expect(screen.getByText('2 of 2')).toBeInTheDocument();
  expect(screen.queryByText(/Visible Value|Verb Coverage|out of 100/)).toBeNull();
});

it('renders score card details and handles copy text with live status announcement', async () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });

  render(<ShareScoreCard bullets={strongBullets} />);

  expect(screen.getByText('2 of 2')).toBeInTheDocument();
  const copyButton = screen.getByRole('button', { name: 'Copy text' });
  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Copied to the clipboard.');
  });
});

it('announces status when downloading image', async () => {
  render(<ShareScoreCard bullets={strongBullets} />);

  const downloadButton = screen.getByRole('button', { name: 'Download image' });
  fireEvent.click(downloadButton);

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('Image download started.');
  });
});

function renderCard() {
  return render(<ShareScoreCard bullets={strongBullets} />);
}
it('restores keyboard focus after fallback copying succeeds', async () => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(true),
  });
  renderCard();
  const button = screen.getByRole('button', { name: 'Copy text' });
  button.focus();
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Copied to the clipboard')
  );
  expect(document.activeElement).toBe(button);
  expect(document.querySelector('textarea')).toBeNull();
});
it('cleans up the fallback textarea and restores focus when copy throws', async () => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      throw new Error('Denied');
    }),
  });
  renderCard();
  const button = screen.getByRole('button', { name: 'Copy text' });
  button.focus();
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not copy'));
  expect(document.querySelector('textarea')).toBeNull();
  expect(document.activeElement).toBe(button);
});
it('an old copy timeout cannot erase a newer image-generation status', async () => {
  vi.useFakeTimers();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  let finish!: (value: string) => void;
  vi.mocked(toPng).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      })
  );
  renderCard();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
  await act(async () => {
    vi.advanceTimersByTime(2500);
  });
  expect(screen.getByRole('status')).toHaveTextContent('Making the image');
  await act(async () => {
    finish('data:image/png;base64,fake');
  });
});

it('repeated copy failures create a fresh live announcement', async () => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(false),
  });
  renderCard();
  const copy = screen.getByRole('button', { name: 'Copy text' });
  fireEvent.click(copy);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not copy'));
  const previous = screen.getByRole('status').firstChild;
  fireEvent.click(copy);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not copy'));
  expect(screen.getByRole('status').firstChild).not.toBe(previous);
});
it('leaving the card while generating does not trigger a late download', async () => {
  let finish!: (value: string) => void;
  vi.mocked(toPng).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      })
  );
  const view = renderCard();
  fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
  view.unmount();
  await act(async () => {
    finish('data:image/png;base64,fake');
  });
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});
