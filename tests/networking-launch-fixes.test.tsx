import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveRecording = vi.fn();
const stopTake = vi.fn();
vi.mock('../src/lib/local-db', () => ({
  saveRecording: (input: unknown) => saveRecording(input),
  listRecordings: async () => [],
  deleteRecording: async () => ({ ok: true }),
}));
vi.mock('../src/lib/speech', () => ({
  createRecorder: () => ({
    start: async () => {},
    stop: () => stopTake(),
    cancel: () => {},
  }),
}));

import RepRecorder from '../src/components/networking/RepRecorder';
import SessionHistory from '../src/components/networking/SessionHistory';
import { useNetworkingPractice } from '../src/components/networking/useNetworkingPractice';
import { type TimerState, timerAt, useTimer } from '../src/components/networking/useTimer';

beforeEach(() => {
  localStorage.clear();
  saveRecording.mockReset();
  stopTake.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('networking timer', () => {
  it('derives the time from the clock, so a stalled page catches up', () => {
    const running: TimerState = {
      remaining: 30,
      elapsed: 0,
      isRunning: true,
      startedAt: 1_000,
      elapsedAtStart: 0,
      total: 30,
    };
    const after = timerAt(running, 1_000 + 4_200);
    expect(after.elapsed).toBe(4);
    expect(after.remaining).toBe(26);
  });

  it('counts a stall that ends right before pause', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const { result } = renderHook(() => useTimer(30));
    act(() => result.current.startTimer());
    // No interval fires while the main thread is blocked; only the clock moves.
    vi.setSystemTime(new Date('2026-11-12T10:00:04.200Z'));
    act(() => result.current.pauseTimer());
    expect(result.current.timer.remaining).toBe(26);
    expect(result.current.timer.elapsed).toBe(4);
  });

  it('continues from where it paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const { result } = renderHook(() => useTimer(30));
    act(() => result.current.startTimer());
    act(() => vi.advanceTimersByTime(3_000));
    act(() => result.current.pauseTimer());
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.timer.elapsed).toBe(3);
    act(() => result.current.startTimer());
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.timer.elapsed).toBe(5);
    expect(result.current.timer.remaining).toBe(25);
  });
});

describe('saved intros', () => {
  it('keeps each intro its own words', () => {
    const { result } = renderHook(() => useNetworkingPractice());
    act(() => result.current.setDraft('First intro for a campus career fair.'));
    const firstId = result.current.currentVersionId;

    act(() => result.current.createNewVersion());
    expect(result.current.draft).toBe('');
    const secondId = result.current.currentVersionId;
    expect(secondId).not.toBe(firstId);
    act(() => result.current.setDraft('Second intro for a different audience.'));

    act(() => result.current.setCurrentVersionId(firstId));
    expect(result.current.draft).toBe('First intro for a campus career fair.');
    act(() => result.current.setCurrentVersionId(secondId));
    expect(result.current.draft).toBe('Second intro for a different audience.');
  });

  it('keeps the words of an intro that was left after a reload', () => {
    const first = renderHook(() => useNetworkingPractice());
    act(() => first.result.current.setDraft('First intro words.'));
    const firstId = first.result.current.currentVersionId;
    act(() => first.result.current.createNewVersion());
    act(() => first.result.current.setDraft('Second intro words.'));
    first.unmount();

    const second = renderHook(() => useNetworkingPractice());
    act(() => second.result.current.setCurrentVersionId(firstId));
    expect(second.result.current.draft).toBe('First intro words.');
  });
});

describe('rep recorder', () => {
  function installMedia() {
    vi.stubGlobal('MediaRecorder', function MediaRecorder() {});
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({}) },
    });
    if (!URL.createObjectURL) {
      Object.assign(URL, { createObjectURL: () => 'blob:take', revokeObjectURL: () => {} });
    }
  }

  async function recordTake(rerenderLabel?: (label: string) => void) {
    fireEvent.click(await screen.findByRole('button', { name: 'Record this rep' }));
    await screen.findByRole('button', { name: 'Stop' });
    rerenderLabel?.('CHANGED AFTER RECORDING. THIS WAS NEVER SPOKEN.');
    stopTake.mockResolvedValue({
      blob: new Blob(['x'], { type: 'audio/webm' }),
      durationMs: 4000,
      mimeType: 'audio/webm',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByRole('button', { name: 'Keep this recording' });
  }

  it('saves the label the take was recorded under', async () => {
    installMedia();
    saveRecording.mockResolvedValue({ ok: true });
    const { rerender } = render(<RepRecorder label="My real intro" />);
    await recordTake((label) => rerender(<RepRecorder label={label} />));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep this recording' }));
    });
    expect(saveRecording).toHaveBeenCalledTimes(1);
    expect(saveRecording.mock.calls[0][0]).toMatchObject({ question: 'My real intro' });
  });

  it('keeps one take once when Keep is pressed twice quickly', async () => {
    installMedia();
    let finish: (value: { ok: true }) => void = () => {};
    saveRecording.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(<RepRecorder label="My intro" />);
    await recordTake();
    const keep = screen.getByRole('button', { name: 'Keep this recording' });
    await act(async () => {
      fireEvent.click(keep);
      fireEvent.click(keep);
    });
    await act(async () => {
      finish({ ok: true });
    });
    expect(saveRecording).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Kept on this device' })).toBeDisabled();
  });
});

describe('networking copy matches the controls', () => {
  it('names the real save button and uses sentence case', () => {
    render(
      <SessionHistory
        sessions={[]}
        onExport={() => {}}
        onClearHistory={() => {}}
        onRemoveSession={() => {}}
      />
    );
    expect(screen.getByRole('heading', { name: 'Recent sessions' })).toBeInTheDocument();
    expect(screen.getByText('Save this rep')).toBeInTheDocument();
    expect(screen.queryByText('Save Session')).not.toBeInTheDocument();
  });
});
