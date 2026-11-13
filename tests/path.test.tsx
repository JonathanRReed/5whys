import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuideCoach from '../src/components/shared/GuideCoach';
import PathCard from '../src/components/shared/PathCard';
import {
  GUIDE_STORAGE_KEY,
  GUIDE_TOOLS,
  STEP_BODY_WORDS,
  STEP_TITLE_WORDS,
} from '../src/lib/guide';
import { GUIDES } from '../src/lib/guides';
import {
  loadPath,
  PATH_STORAGE_KEY,
  PATHS,
  pathProgress,
  startPath,
  stopAfter,
} from '../src/lib/path';

const finish = (...tools: string[]) =>
  localStorage.setItem(
    GUIDE_STORAGE_KEY,
    JSON.stringify(
      Object.fromEntries(
        tools.map((tool) => [
          tool,
          {
            mode: 'guided',
            done: GUIDES[tool as keyof typeof GUIDES]?.steps.map((step) => step.id) ?? [],
            finished: true,
          },
        ])
      )
    )
  );

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('every path', () => {
  it('is short, uses tools that have a guide, and opens each with the guide on', () => {
    for (const path of Object.values(PATHS)) {
      expect(path.stops.length, path.id).toBeGreaterThanOrEqual(2);
      expect(path.stops.length, path.id).toBeLessThanOrEqual(3);
      const tools = path.stops.map((item) => item.tool);
      expect(new Set(tools).size, path.id).toBe(tools.length);
      for (const item of path.stops) {
        expect(GUIDE_TOOLS).toContain(item.tool);
        expect(GUIDES[item.tool], item.tool).toBeDefined();
        expect(item.href).toMatch(/[?&]guide=1$/);
        expect(`${item.label} ${item.gain} ${path.title}`).not.toMatch(/—|!/);
      }
    }
  });
});

describe('path progress', () => {
  it('reads done stops from finished guides and names the next one', () => {
    const path = startPath('interview');
    expect(loadPath()?.id).toBe('interview');
    expect(pathProgress(path).done).toEqual([false, false, false]);
    finish('interview-glow-up');
    const progress = pathProgress(path);
    expect(progress.done).toEqual([true, false, false]);
    expect(progress.next?.tool).toBe('rehearsal');
    expect(stopAfter(path, 'rehearsal')?.tool).toBe('pay');
    expect(stopAfter(path, 'pay')).toBeNull();
  });

  it('ignores a saved path it does not know', () => {
    localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify({ id: 'nonsense' }));
    expect(loadPath()).toBeNull();
  });
});

describe('the path on screen', () => {
  it('shows the stops for an answer and marks finished ones', () => {
    startPath('offer');
    finish('pay');
    render(<PathCard offer="offer" />);
    const card = screen.getByTestId('path-card');
    expect(card).toHaveTextContent('Answer an offer');
    expect(card).toHaveTextContent('1 of 2 stops done');
    expect(screen.getByRole('link', { name: 'Continue the path' })).toHaveAttribute(
      'href',
      '/career/?guide=1'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Leave the path' }));
    expect(loadPath()).toBeNull();
  });

  it('shows nothing on the dashboard when no path was started', () => {
    const { container } = render(<PathCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a finished guide hands the visitor to the next stop of the path', () => {
    startPath('interview');
    window.history.replaceState(null, '', '/interview-glow-up/workspace/?guide=1');
    render(<GuideCoach tool="interview-glow-up" />);
    expect(document.querySelector('[data-guide-bar]')).toHaveTextContent(
      'Stop 1 of 3 on your path.'
    );
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    const total = GUIDES['interview-glow-up']?.steps.length ?? 0;
    for (let i = 0; i < total; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Skip this step|I did this/ }));
    }
    expect(coach).toHaveTextContent('Guide finished');
    // The link is in the folded bar and in the open card; both go the same way.
    for (const link of screen.getAllByRole('link', {
      name: 'Next stop: Answer the likely questions',
    })) {
      expect(link).toHaveAttribute('href', '/interview-glow-up/rehearse/?guide=1');
    }
  });

  it('a link can put the visitor on a path', () => {
    window.history.replaceState(null, '', '/pay/?guide=1&path=offer');
    render(<GuideCoach tool="pay" />);
    expect(loadPath()?.id).toBe('offer');
    expect(document.querySelector('[data-guide-bar]')).toHaveTextContent(
      'Stop 1 of 2 on your path.'
    );
  });
});

describe('every guide teaches by doing', () => {
  const words = (text: string | undefined) => (text ?? '').split(/\s+/).filter(Boolean).length;

  it('keeps each step to a short task, with the reason held for afterwards', () => {
    for (const guide of Object.values(GUIDES)) {
      for (const step of guide?.steps ?? []) {
        expect(words(step.title), `${guide?.tool} ${step.id} title`).toBeLessThanOrEqual(
          STEP_TITLE_WORDS
        );
        expect(words(step.body), `${guide?.tool} ${step.id} body`).toBeLessThanOrEqual(
          STEP_BODY_WORDS
        );
        // No step is finished by saying so: the page shows the visitor did it.
        expect(step.done.kind, `${guide?.tool} ${step.id}`).not.toBe('manual');
      }
    }
  });

  it('ends with one task to do alone, checked from the page', () => {
    for (const guide of Object.values(GUIDES)) {
      expect(guide?.challenge, guide?.tool).toBeDefined();
      expect(guide?.challenge?.done.kind).not.toBe('manual');
      expect(`${guide?.challenge?.title} ${guide?.challenge?.body ?? ''}`).not.toMatch(/—|!/);
    }
  });

  it('says why only after the step is done, and notices the closing task', () => {
    const page = document.createElement('div');
    page.innerHTML =
      '<input data-guide="offer-basePay" /><select data-guide="offer-period"><option value=""></option><option value="hour">hour</option></select><div data-guide="offer-results">Needs more detail</div>';
    document.body.append(page);
    localStorage.setItem(
      GUIDE_STORAGE_KEY,
      JSON.stringify({ pay: { mode: 'guided', done: [], finished: false } })
    );
    vi.useFakeTimers();
    render(<GuideCoach tool="pay" />);
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    const first = GUIDES.pay?.steps[0];
    expect(coach).toHaveTextContent(first?.title ?? '');
    expect(coach).not.toHaveTextContent(first?.why ?? 'missing');
    (page.querySelector('input') as HTMLInputElement).value = '18';
    act(() => void vi.advanceTimersByTime(600));
    expect(coach).toHaveTextContent(`Done. ${first?.why}`);

    (page.querySelector('select') as HTMLSelectElement).value = 'hour';
    act(() => void vi.advanceTimersByTime(600));
    (page.querySelector('[data-guide="offer-results"]') as HTMLElement).textContent = '$18 an hour';
    act(() => void vi.advanceTimersByTime(600));
    expect(coach).toHaveTextContent('Now try one on your own');
    act(() => void vi.advanceTimersByTime(600));
    page.insertAdjacentHTML('beforeend', '<table data-testid="offer-compare"></table>');
    act(() => void vi.advanceTimersByTime(600));
    expect(coach).toHaveTextContent('Done on your own');
    vi.useRealTimers();
    page.remove();
  });
});
