import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BackupControls from '../src/components/BackupControls';

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
