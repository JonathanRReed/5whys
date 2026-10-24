import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WorkspaceHeader from '../src/components/interview-glow-up/WorkspaceHeader';
import type { GlowUpData } from '../src/lib/glowup-store';

const syntheticData: GlowUpData = {
  version: 1,
  roles: [
    {
      id: 'synthetic-role',
      jobTitle: 'Student project assistant',
      company: 'Example lab',
      rawJdText: 'Help organize a student research project.',
      bullets: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  stories: [],
  packets: [],
  currentRoleId: 'synthetic-role',
  currentPacketId: null,
};

const createObjectURL = vi.fn<(blob: Blob | MediaSource) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
let clickedAnchors: HTMLAnchorElement[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  localStorage.clear();
  localStorage.setItem('interview-glow-up-data', JSON.stringify(syntheticData));
  createObjectURL.mockReset().mockReturnValue('blob:synthetic-export');
  revokeObjectURL.mockReset();
  // jsdom has no native download or object URL lifecycle. Keep exportJSON real.
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
  );
  clickedAnchors = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clickedAnchors.push(this);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('starts a real JSON download and reports that start without relabeling the action', async () => {
  const onClearData = vi.fn();
  render(<WorkspaceHeader onClearData={onClearData} />);
  const button = screen.getByRole('button', { name: 'Export JSON' });
  const status = screen.getByRole('status');
  expect(status).toBeEmptyDOMElement();
  expect(status).toHaveAttribute('aria-live', 'polite');
  expect(status).toHaveAttribute('aria-atomic', 'true');
  button.focus();

  fireEvent.click(button);

  expect(screen.getByText('Download started.')).toBeVisible();
  expect(status).toHaveTextContent('Download started.');
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBe(button);
  expect(button).toBeEnabled();
  expect(button).toHaveFocus();
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = createObjectURL.mock.calls[0][0] as Blob;
  expect(blob.type).toBe('application/json');
  expect(JSON.parse(await blob.text())).toEqual(syntheticData);
  expect(clickedAnchors).toHaveLength(1);
  expect(clickedAnchors[0].href).toBe('blob:synthetic-export');
  expect(clickedAnchors[0].download).toBe('interview-glow-up-backup-2026-10-24.json');
  expect(clickedAnchors[0]).not.toBeInTheDocument();
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-export');
  expect(onClearData).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('interview-glow-up-data') ?? 'null')).toEqual(
    syntheticData
  );

  act(() => vi.advanceTimersByTime(2000));
  expect(status).toBeEmptyDOMElement();
  expect(button).toBeEnabled();
  expect(button).toHaveAccessibleName('Export JSON');
});

it('changes the announcement for every repeated export and restarts the feedback interval', () => {
  render(<WorkspaceHeader onClearData={vi.fn()} />);
  const button = screen.getByRole('button', { name: 'Export JSON' });
  const status = screen.getByRole('status');
  button.focus();
  fireEvent.click(button);
  const firstAnnouncement = status.textContent;

  act(() => vi.advanceTimersByTime(1000));
  fireEvent.click(button);
  const secondAnnouncement = status.textContent;
  expect(secondAnnouncement).not.toBe(firstAnnouncement);
  expect(status).toHaveTextContent('Download started.');
  expect(button).toHaveFocus();
  expect(button).toHaveAccessibleName('Export JSON');
  expect(button).toBeEnabled();

  act(() => vi.advanceTimersByTime(1000));
  expect(status).toHaveTextContent('Download started.');
  act(() => vi.advanceTimersByTime(1000));
  expect(status).toBeEmptyDOMElement();

  fireEvent.click(button);
  expect(status).toHaveTextContent('Download started.');
  expect(status.textContent).not.toBe(secondAnnouncement);
  expect(createObjectURL).toHaveBeenCalledTimes(3);
  expect(clickedAnchors).toHaveLength(3);
  expect(revokeObjectURL).toHaveBeenCalledTimes(3);
});

it('clears pending feedback when the header unmounts', () => {
  const { unmount } = render(<WorkspaceHeader onClearData={vi.fn()} />);
  const initialTimers = vi.getTimerCount();
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
  expect(vi.getTimerCount()).toBe(initialTimers + 1);

  unmount();

  expect(vi.getTimerCount()).toBe(initialTimers);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it.each([false, true])(
  'does not announce a new download when export throws (previous feedback: %s)',
  (hasPreviousFeedback) => {
    render(<WorkspaceHeader onClearData={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Export JSON' });
    const status = screen.getByRole('status');
    if (hasPreviousFeedback) {
      fireEvent.click(button);
      act(() => vi.advanceTimersByTime(1000));
    }
    const previousAnnouncement = status.textContent;
    const previousDownloadCount = clickedAnchors.length;
    const error = new Error('Synthetic download could not start');
    createObjectURL.mockImplementationOnce(() => {
      throw error;
    });
    const reportedErrors: unknown[] = [];
    const captureError = (event: ErrorEvent) => {
      reportedErrors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', captureError);
    try {
      fireEvent.click(button);
    } finally {
      window.removeEventListener('error', captureError);
    }

    expect(reportedErrors).toEqual([error]);
    expect(status.textContent).toBe(previousAnnouncement);
    expect(clickedAnchors).toHaveLength(previousDownloadCount);
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleName('Export JSON');
    // A failed retry must not restart the earlier success feedback interval.
    act(() => vi.advanceTimersByTime(1000));
    expect(status).toBeEmptyDOMElement();
  }
);
