import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WorkspaceHeader from '../src/components/interview-glow-up/WorkspaceHeader';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('shows temporary export feedback and announces status to screen readers', () => {
  vi.useFakeTimers();
  try {
    const onClearData = vi.fn();
    render(<WorkspaceHeader onClearData={onClearData} />);

    const exportBtn = screen.getByRole('button', { name: 'Export JSON' });
    expect(exportBtn).toBeInTheDocument();

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeEmptyDOMElement();

    fireEvent.click(exportBtn);

    expect(screen.getByRole('button', { name: 'Exported JSON' })).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('Exported JSON! Check your downloads.');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
    expect(statusEl).toBeEmptyDOMElement();
  } finally {
    vi.useRealTimers();
  }
});
