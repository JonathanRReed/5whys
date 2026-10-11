import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BackupControls from '../src/components/BackupControls';
import { BACKUP_FORMAT } from '../src/lib/studio-backup';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('shows temporary export check feedback until the latest export timer expires', () => {
  vi.useFakeTimers();
  try {
    render(<BackupControls />);

    const exportBtn = screen.getByRole('button', { name: 'Export my work' });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    expect(exportBtn).toHaveTextContent(/^Export my work$/);
    const check = exportBtn.querySelector('svg');
    expect(check).toHaveAttribute('aria-hidden', 'true');
    expect(check).not.toHaveClass('invisible');

    // Status message has role="status"
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveTextContent(/Exported .* Check your downloads/);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(exportBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(check).not.toHaveClass('invisible');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Button text reverts to "Export my work"
    expect(screen.getByRole('button', { name: 'Export my work' })).toHaveTextContent(
      'Export my work'
    );
    expect(check).toHaveClass('invisible');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps the focused export button accessible name stable during feedback and reset', () => {
  vi.useFakeTimers();
  render(<BackupControls />);
  const exportBtn = screen.getByRole('button', { name: 'Export my work' });
  exportBtn.focus();

  fireEvent.click(exportBtn);
  expect(exportBtn).toHaveTextContent(/^Export my work$/);
  expect(exportBtn).toHaveAccessibleName('Export my work');
  expect(exportBtn).toHaveFocus();

  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(exportBtn).toHaveTextContent(/^Export my work$/);
  expect(exportBtn).toHaveAccessibleName('Export my work');
  expect(exportBtn).toHaveFocus();
});

it('updates one pre-existing status region without a nested live-region ancestor', () => {
  render(<BackupControls />);
  const status = screen.getByRole('status');
  expect(status).toBeEmptyDOMElement();

  fireEvent.click(screen.getByRole('button', { name: 'Export my work' }));

  expect(screen.getAllByRole('status')).toEqual([status]);
  expect(status).toHaveAttribute('aria-atomic', 'true');
  expect(status).toHaveTextContent('Exported nothing yet. Check your downloads.');
  expect(status.parentElement?.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
});

it('displays error role when invalid file is imported', async () => {
  render(<BackupControls />);

  const fileInput = screen.getByLabelText(
    'Import a 5 Whys Career Studio export file'
  ) as HTMLInputElement;

  const invalidFile = new File(['invalid json content'], 'invalid.json', {
    type: 'application/json',
  });

  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
  });

  // Error message has role="alert"
  const alertEl = await screen.findByRole('alert');
  expect(alertEl).toBeInTheDocument();
  expect(alertEl.parentElement?.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
});

it('keeps a failed import available to retry and reports success only after saving', async () => {
  localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
  const onRestored = vi.fn();
  render(<BackupControls onRestored={onRestored} />);
  const file = new File([], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        stores: { 'career-why-history': [{ id: 'imported-reflection' }] },
      }),
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Import a 5 Whys Career Studio export file'), {
      target: { files: [file] },
    });
  });
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replace everything here' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/could not|couldn't/i);
  expect(screen.getByRole('status')).not.toHaveTextContent('Brought in');
  expect(onRestored).not.toHaveBeenCalled();
  expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');

  failure.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Replace everything here' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Brought in');
  expect(onRestored).toHaveBeenCalledOnce();
  expect(localStorage.getItem('career-why-history')).toContain('imported-reflection');
});

it('leaves saved work alone when replacing with an empty export', async () => {
  localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
  const onRestored = vi.fn();
  render(<BackupControls onRestored={onRestored} />);
  const file = new File([], 'empty.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        stores: {},
      }),
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Import a 5 Whys Career Studio export file'), {
      target: { files: [file] },
    });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replace everything here' }));

  expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
  expect(screen.getByRole('status')).toHaveTextContent('That file had nothing to bring in.');
  expect(screen.queryByRole('button', { name: 'Replace everything here' })).toBeNull();
  expect(onRestored).not.toHaveBeenCalled();
});

it('keeps the previous selected backup available when another file cannot be read', async () => {
  render(<BackupControls />);
  const input = screen.getByLabelText('Import a 5 Whys Career Studio export file');
  const valid = new File([], 'backup.json', { type: 'application/json' });
  Object.defineProperty(valid, 'text', {
    value: async () =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        stores: { 'career-why-history': [{ id: 'selected-reflection' }] },
      }),
  });
  await act(async () => {
    fireEvent.change(input, { target: { files: [valid] } });
  });
  const invalid = new File([], 'invalid.json', { type: 'application/json' });
  Object.defineProperty(invalid, 'text', { value: async () => 'not JSON' });
  await act(async () => {
    fireEvent.change(input, { target: { files: [invalid] } });
  });

  expect(screen.getByRole('alert')).toHaveTextContent('That file is not JSON.');
  expect(screen.getByText(/This file holds 1 reflection/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add to what is here' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(localStorage.getItem('career-why-history')).toContain('selected-reflection');
});

it('shows the recovery warning when restoring previous work also fails', async () => {
  localStorage.setItem('career-tools-profile', '{"name":"Original profile"}');
  const onRestored = vi.fn();
  render(<BackupControls onRestored={onRestored} />);
  const file = new File([], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        stores: {
          'career-tools-profile': { name: 'Imported profile' },
          'career-why-history': [{ id: 'imported-reflection' }],
        },
      }),
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Import a 5 Whys Career Studio export file'), {
      target: { files: [file] },
    });
  });
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'career-why-history' || value.includes('Original profile')) {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    }
    setItem.call(this, key, value);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add to what is here' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Some saved work may have changed.');
  expect(screen.getByRole('alert')).toHaveTextContent('Keep your backup file');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByRole('button', { name: 'Add to what is here' })).toBeInTheDocument();
  expect(onRestored).not.toHaveBeenCalled();
});

it('can cancel a failed import without changing preserved work', async () => {
  localStorage.setItem('career-why-history', '[{"id":"saved-reflection"}]');
  render(<BackupControls />);
  const file = new File([], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        stores: { 'career-why-history': [{ id: 'imported-reflection' }] },
      }),
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Import a 5 Whys Career Studio export file'), {
      target: { files: [file] },
    });
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replace everything here' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('button', { name: 'Replace everything here' })).toBeNull();
  expect(localStorage.getItem('career-why-history')).toBe('[{"id":"saved-reflection"}]');
});
