/**
 * Batch I, item 9: with a role in view, the rehearsal room lists only the
 * recordings kept for its application. Without one, every recording.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedRecordings from '../src/components/shared/SavedRecordings';

const listRecordings = vi.fn();

vi.mock('../src/lib/local-db', () => ({
  listRecordings: (filter: unknown) => listRecordings(filter),
  getRecording: vi.fn(),
  deleteRecording: vi.fn(),
}));

const recording = (id: string, applicationId: string | null, question: string) => ({
  id,
  tool: 'interview-glow-up',
  applicationId,
  question,
  createdAt: 1,
  durationMs: 1000,
  mimeType: 'audio/webm',
  sizeBytes: 10,
});

const ALL = [
  recording('r1', 'a1', 'Why the library?'),
  recording('r2', 'a2', 'Why the bike shop?'),
  recording('r3', null, 'Tell me about yourself.'),
];

describe('item 9: recordings for one application', () => {
  beforeEach(() => {
    listRecordings.mockReset();
    listRecordings.mockImplementation(
      async (filter: { tool?: string; applicationId?: string | null }) =>
        ALL.filter(
          (r) =>
            (filter.tool === undefined || r.tool === filter.tool) &&
            (filter.applicationId === undefined || r.applicationId === filter.applicationId)
        )
    );
  });

  it('lists only the application named', async () => {
    render(<SavedRecordings tool="interview-glow-up" applicationId="a1" />);
    await waitFor(() => expect(screen.getByText('Why the library?')).toBeInTheDocument());
    expect(listRecordings).toHaveBeenCalledWith({ tool: 'interview-glow-up', applicationId: 'a1' });
    expect(screen.queryByText('Why the bike shop?')).toBeNull();
    expect(screen.queryByText('Tell me about yourself.')).toBeNull();
  });

  it('lists every recording when no application is named', async () => {
    render(<SavedRecordings tool="interview-glow-up" />);
    await waitFor(() => expect(screen.getByText('Why the bike shop?')).toBeInTheDocument());
    expect(listRecordings).toHaveBeenCalledWith({ tool: 'interview-glow-up' });
    expect(screen.getByText('Why the library?')).toBeInTheDocument();
    expect(screen.getByText('Tell me about yourself.')).toBeInTheDocument();
  });
});
