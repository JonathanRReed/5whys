import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HistoryPanel from '../src/components/career-5whys/HistoryPanel';
import type { WhySnapshot } from '../src/components/career-5whys/shared';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const snapshot = (id: string, timestamp = '2026-10-24T12:30:15.000Z'): WhySnapshot => ({
  id,
  timestamp,
  track: 'career',
  topic: 'Engineering',
  whyStatement: 'Build useful tools.',
  rootReason: 'Private root reason',
  nextStep: 'Private next step',
  responses: ['Private answer', '', '', '', ''],
  updatedAt: timestamp,
  version: 3,
});

function panelProps(history: WhySnapshot[]) {
  return {
    history,
    historyLimit: 12,
    historyIsFull: false,
    onLimitChange: vi.fn(),
    onExportHistory: vi.fn(),
    onClearHistory: vi.fn(),
    onRestoreSnapshot: vi.fn(),
    onExportSnapshot: vi.fn(),
    onDeleteSnapshot: vi.fn(),
  };
}

it('names each action with visible snapshot context without exposing hidden fields', () => {
  render(<HistoryPanel {...panelProps([snapshot('private-id')])} />);

  expect(screen.getByText(/Snapshot 1 of 1/)).toBeVisible();
  for (const action of ['Load', 'Export', 'Delete']) {
    const button = screen.getByRole('button', {
      name: new RegExp(`^${action} snapshot: Engineering \\(.+, snapshot 1 of 1\\)$`),
    });
    expect(button.getAttribute('aria-label')).not.toMatch(/private/i);
  }
});

it('distinguishes actual visible records even when topics and saved minutes or timestamps match', () => {
  const history = [
    snapshot('private-one'),
    snapshot('private-two', '2026-10-24T12:30:45.000Z'),
    snapshot('private-three', '2026-10-24T12:30:45.000Z'),
  ];
  const props = panelProps(history);
  render(<HistoryPanel {...props} />);

  for (const action of ['Load', 'Export', 'Delete']) {
    const buttons = screen.getAllByRole('button', { name: new RegExp(`^${action} snapshot:`) });
    expect(buttons).toHaveLength(3);
    expect(new Set(buttons.map((button) => button.getAttribute('aria-label'))).size).toBe(3);
    for (const [index, button] of buttons.entries()) {
      expect(button).toHaveAccessibleName(new RegExp(`snapshot ${index + 1} of 3`));
      expect(screen.getByText(new RegExp(`Snapshot ${index + 1} of 3`))).toBeVisible();
    }
  }

  fireEvent.click(screen.getByRole('button', { name: /^Load snapshot: .*snapshot 2 of 3/ }));
  expect(props.onRestoreSnapshot).toHaveBeenCalledExactlyOnceWith(history[1]);
  fireEvent.click(screen.getByRole('button', { name: /^Export snapshot: .*snapshot 3 of 3/ }));
  expect(props.onExportSnapshot).toHaveBeenCalledExactlyOnceWith(history[2]);
  const target = screen.getByRole('button', { name: /^Delete snapshot: .*snapshot 2 of 3/ });
  const restingName = target.getAttribute('aria-label');
  fireEvent.click(target);
  expect(target).toHaveAccessibleName(`${restingName}?`);
  expect(target).toHaveTextContent(`${restingName}?`);
  expect(props.onDeleteSnapshot).not.toHaveBeenCalled();
  fireEvent.click(target);
  expect(props.onDeleteSnapshot).toHaveBeenCalledExactlyOnceWith('private-two');
});

it('keeps the selected snapshot topic in the second-press confirmation', () => {
  const props = panelProps([snapshot('private-id')]);
  render(<HistoryPanel {...props} />);
  const button = screen.getByText('Delete');
  fireEvent.click(button);
  expect(button).toHaveAccessibleName(/^Delete snapshot: Engineering \(.+, snapshot 1 of 1\)\?$/);
  expect(button).toHaveTextContent('Engineering');
  expect(props.onDeleteSnapshot).not.toHaveBeenCalled();
});

it('keeps untitled and legacy timestamp fallbacks in resting and armed names', () => {
  const props = panelProps([{ ...snapshot('private-id', 'legacy time'), topic: '' }]);
  render(<HistoryPanel {...props} />);
  const name = 'Delete snapshot: Untitled session (legacy time, snapshot 1 of 1)';
  const button = screen.getByRole('button', { name });
  fireEvent.click(button);
  expect(button).toHaveAccessibleName(`${name}?`);
  expect(props.onDeleteSnapshot).not.toHaveBeenCalled();
});

it.each(['Escape', 'blur', 'timeout'])(
  'retains the target context after %s cancels deletion',
  (cancel) => {
    vi.useFakeTimers();
    const props = panelProps([snapshot('private-one'), snapshot('private-two')]);
    render(<HistoryPanel {...props} />);
    const button = screen.getByRole('button', { name: /^Delete snapshot: .*snapshot 2 of 2/ });
    const name = button.getAttribute('aria-label');
    fireEvent.click(button);
    expect(button).toHaveAccessibleName(`${name}?`);
    if (cancel === 'Escape') fireEvent.keyDown(button, { key: 'Escape' });
    else if (cancel === 'blur') fireEvent.blur(button);
    else act(() => vi.advanceTimersByTime(4001));
    expect(button).toHaveAccessibleName(name);
    expect(props.onDeleteSnapshot).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(props.onDeleteSnapshot).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(props.onDeleteSnapshot).toHaveBeenCalledExactlyOnceWith('private-two');
  }
);

it('keeps an armed target bound to its record when another visible snapshot is removed', () => {
  const first = snapshot('private-one');
  const second = snapshot('private-two');
  const props = panelProps([first, second]);
  const { rerender } = render(<HistoryPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /^Delete snapshot: .*snapshot 2 of 2/ }));
  rerender(<HistoryPanel {...props} history={[second]} />);
  const target = screen.getByRole('button', {
    name: /^Delete snapshot: Engineering \(.+, snapshot 1 of 1\)\?$/,
  });
  expect(screen.getByText(/Snapshot 1 of 1/)).toBeVisible();
  fireEvent.click(target);
  expect(props.onDeleteSnapshot).toHaveBeenCalledExactlyOnceWith('private-two');
});

it('leaves empty history without snapshot actions and disables exporting all', () => {
  render(<HistoryPanel {...panelProps([])} />);
  expect(screen.queryByRole('button', { name: /^(Load|Export|Delete) snapshot:/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Export all snapshots' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Clear history' })).toBeNull();
});
