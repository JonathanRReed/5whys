import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ShareScoreCard from '../src/components/resume-game/ShareScoreCard';
import type { SignalReport } from '../src/lib/resume-game';

// Mock html-to-image
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    expect(screen.getByRole('status')).toHaveTextContent('Score card image downloaded.');
  });
});
