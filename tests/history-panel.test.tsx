import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HistoryPanel from '../src/components/career-5whys/HistoryPanel';
import type { WhySnapshot } from '../src/components/career-5whys/shared';

afterEach(() => {
  cleanup();
});

const sampleHistory: WhySnapshot[] = [
  {
    id: 'snap-1',
    timestamp: '2025-05-18T10:00:00.000Z',
    track: 'career',
    topic: 'Software Engineer',
    whyStatement: 'I want to build software to solve real problems.',
    rootReason: 'Agency over outcomes.',
    nextStep: 'Talk to a senior engineer.',
    updatedAt: '2025-05-18T10:00:00.000Z',
    version: 1,
    responses: ['A1', 'A2', 'A3', 'A4', 'A5'],
  },
  {
    id: 'snap-2',
    timestamp: '2025-05-19T14:30:00.000Z',
    track: 'interest',
    topic: 'Graduate School',
    whyStatement: 'Deepen technical knowledge in ML.',
    rootReason: 'Curiosity driven research.',
    nextStep: 'Read a paper.',
    updatedAt: '2025-05-19T14:30:00.000Z',
    version: 1,
    responses: ['B1', 'B2', 'B3', 'B4', 'B5'],
  },
];

it('renders descriptive aria-labels for load, export, and delete action buttons for each snapshot', () => {
  render(
    <HistoryPanel
      history={sampleHistory}
      historyLimit={10}
      historyIsFull={false}
      onLimitChange={vi.fn()}
      onExportHistory={vi.fn()}
      onClearHistory={vi.fn()}
      onRestoreSnapshot={vi.fn()}
      onExportSnapshot={vi.fn()}
      onDeleteSnapshot={vi.fn()}
    />
  );

  const loadButtons = screen.getAllByRole('button', { name: /^Load snapshot:/ });
  expect(loadButtons).toHaveLength(2);
  expect(loadButtons[0]).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Software Engineer')
  );
  expect(loadButtons[1]).toHaveAttribute('aria-label', expect.stringContaining('Graduate School'));

  const exportButtons = screen.getAllByRole('button', { name: /^Export snapshot:/ });
  expect(exportButtons).toHaveLength(2);
  expect(exportButtons[0]).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Software Engineer')
  );
  expect(exportButtons[1]).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Graduate School')
  );

  const deleteButtons = screen.getAllByRole('button', { name: /^Delete snapshot:/ });
  expect(deleteButtons).toHaveLength(2);
  expect(deleteButtons[0]).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Software Engineer')
  );
  expect(deleteButtons[1]).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Graduate School')
  );
});
