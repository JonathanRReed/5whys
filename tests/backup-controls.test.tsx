import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BackupControls from '../src/components/BackupControls';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

it('shows temporary "Exported!" feedback and status role when exporting', () => {
  vi.useFakeTimers();
  try {
    render(<BackupControls />);

    const exportBtn = screen.getByRole('button', { name: 'Export my work' });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    // Button text changes to "Exported!"
    expect(
      screen.getByRole('button', { name: 'Exported my work to downloads' })
    ).toHaveTextContent('Exported!');

    // Status message has role="status"
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveTextContent(/Exported .* Check your downloads/);

    // Fast-forward timer by 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Button text reverts to "Export my work"
    expect(screen.getByRole('button', { name: 'Export my work' })).toHaveTextContent(
      'Export my work'
    );
  } finally {
    vi.useRealTimers();
  }
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
});
