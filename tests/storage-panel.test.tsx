import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import StoragePanel, { formatBytes } from '../src/components/StoragePanel';
import { closeLocalDb, saveRecording } from '../src/lib/local-db';

afterEach(async () => {
  window.localStorage.clear();
  await closeLocalDb();
});

it('formats sizes the way a person would say them', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(2048)).toBe('2 KB');
  expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  expect(formatBytes(86 * 1024 * 1024)).toBe('86 MB');
});

it('measures nothing until it is opened', () => {
  render(<StoragePanel />);
  expect(screen.queryByTestId('storage-total')).toBeNull();
});

it('lists what is stored and offers to delete recordings', async () => {
  window.localStorage.setItem('career-tools-profile', '{"stage":"student"}');
  await saveRecording({
    tool: 'networking-practice',
    applicationId: null,
    question: 'Tell me about yourself',
    audio: new Blob([new Uint8Array(2048)], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    durationMs: 1000,
    transcript: '',
  });
  render(<StoragePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Measure it' }));
  expect(await screen.findByTestId('storage-total')).toHaveTextContent(
    'None of it has left this device.'
  );
  expect(screen.getByText('1 saved. Not in your backup')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
});
