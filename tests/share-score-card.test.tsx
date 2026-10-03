import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toPng } from 'html-to-image';
import ShareScoreCard from '../src/components/resume-game/ShareScoreCard';
import type { SignalReport } from '../src/lib/resume-game';

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

const mockSignalReport: SignalReport = {
  bulletCount: 2,
  wordCount: 150,
  estimatedPages: 1,
  isOptimalLength: true,
  lengthRecommendation: 'Good length',
  structureNote: undefined,
  verbs: 2,
  numbers: 2,
  softSkills: [],
  hardSkills: [],
  sections: ['experience'],
  visible: 80,
  hidden: 20,
};

it('renders score card details and handles copy text with live status announcement', async () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });

  render(
    <ShareScoreCard
      bullets={[]}
      averageScore={85}
      signalReport={mockSignalReport}
      verbCoverage={90}
    />
  );

  expect(screen.getByText('85')).toBeInTheDocument();
  const copyButton = screen.getByRole('button', { name: 'Copy text' });
  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Copied score card summary to clipboard.');
  });
});

it('announces status when downloading image', async () => {
  render(
    <ShareScoreCard
      bullets={[]}
      averageScore={85}
      signalReport={mockSignalReport}
      verbCoverage={90}
    />
  );

  const downloadButton = screen.getByRole('button', { name: 'Download image' });
  fireEvent.click(downloadButton);

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('Score card image download started.');
  });
});

function renderCard() {
  return render(
    <ShareScoreCard
      bullets={[]}
      averageScore={85}
      signalReport={mockSignalReport}
      verbCoverage={90}
    />
  );
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
    expect(screen.getByRole('status')).toHaveTextContent('Copied score card summary')
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
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Failed to copy'));
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
  expect(screen.getByRole('status')).toHaveTextContent('Generating score card image');
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
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Failed to copy'));
  const previous = screen.getByRole('status').firstChild;
  fireEvent.click(copy);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Failed to copy'));
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
