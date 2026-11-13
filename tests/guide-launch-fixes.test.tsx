import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GuideCoach from '../src/components/shared/GuideCoach';
import {
  advanceTo,
  furthestNewlyPassed,
  GUIDE_STORAGE_KEY,
  type GuideProgress,
  loadGuideProgress,
  reopenFrom,
  stepBackIndex,
} from '../src/lib/guide';
import { GUIDES } from '../src/lib/guides';
import { applicationGuide } from '../src/lib/guides/application';
import { rehearsalGuide } from '../src/lib/guides/rehearsal';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  document.body.innerHTML = '';
});

function saveProgress(tool: string, progress: GuideProgress) {
  window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ [tool]: progress }));
}

function look(times = 1) {
  act(() => {
    vi.advanceTimersByTime(500 * times + 10);
  });
}

function addToPage(html: string) {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.appendChild(holder);
  return holder;
}

describe('guide state helpers', () => {
  it('marks every step up to one done', () => {
    const start: GuideProgress = { mode: 'guided', done: [], finished: false };
    const next = advanceTo(rehearsalGuide, start, 1);
    expect(next.done).toEqual(['start', 'answer']);
    expect(advanceTo(rehearsalGuide, next, 0)).toBe(next);
  });

  it('counts only steps that newly passed', () => {
    const guide = GUIDES['interview-glow-up'];
    if (!guide) throw new Error('no guide');
    expect(furthestNewlyPassed(guide, new Set(['paste', 'save-story']), new Set())).toBe(5);
    expect(furthestNewlyPassed(guide, new Set(['save-story']), new Set(['save-story']))).toBe(-1);
  });

  it('steps back to the last step that still makes sense', () => {
    const at3: GuideProgress = { mode: 'guided', done: ['start', 'answer'], finished: false };
    expect(stepBackIndex(rehearsalGuide, at3, document)).toBe(0);
    expect(reopenFrom(rehearsalGuide, at3, 0).done).toEqual([]);
  });
});

describe('the coach follows the page', () => {
  it('starts the workspace guide past a decoded posting and a saved story', () => {
    addToPage(
      '<div data-guide="workspace" data-guide-posting="decoded" data-guide-packet="stories"></div>'
    );
    window.history.replaceState(null, '', '/interview-glow-up/workspace/?guide=1');
    render(<GuideCoach tool="interview-glow-up" />);
    look();
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    expect(coach).toHaveTextContent('Step 7 of 8');
    window.history.replaceState(null, '', '/');
  });

  it('moves the networking guide on when a scenario is picked and a draft written', () => {
    const page = addToPage('<textarea id="intro-draft"></textarea>');
    saveProgress('networking-practice', { mode: 'guided', done: [], finished: false });
    render(<GuideCoach tool="networking-practice" />);
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    expect(coach).toHaveTextContent('Step 1 of 6');
    const draft = page.querySelector('textarea') as HTMLTextAreaElement;
    draft.value = 'Hi, I am Sam, a second-year student. I ran our lab study group last year.';
    look();
    expect(coach).toHaveTextContent('Step 3 of 6');
  });

  it('sends the rehearsal guide back to the start when a reload lost the answer', () => {
    addToPage('<div data-guide="rehearsal-setup"></div>');
    saveProgress('rehearsal', { mode: 'guided', done: ['start', 'answer'], finished: false });
    render(<GuideCoach tool="rehearsal" />);
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    look(3);
    expect(coach).toHaveTextContent('Step 1 of 6');
    expect(loadGuideProgress('rehearsal')?.done).toEqual([]);
  });

  it('keeps the rehearsal guide on the review step while the review is on the page', () => {
    addToPage('<h3 id="facts-title">What can be counted</h3><p data-testid="take-words">3</p>');
    saveProgress('rehearsal', { mode: 'guided', done: ['start', 'answer'], finished: false });
    render(<GuideCoach tool="rehearsal" />);
    look(3);
    expect(screen.getByRole('complementary', { name: 'Guide' })).toHaveTextContent('Step 3 of 6');
  });

  it('starts again at step 1 even when the page already holds the work', () => {
    addToPage(
      '<div data-guide="workspace" data-guide-posting="decoded" data-guide-packet="stories"></div>'
    );
    saveProgress('interview-glow-up', {
      mode: 'guided',
      done: GUIDES['interview-glow-up']?.steps.map((step) => step.id) ?? [],
      finished: true,
    });
    render(<GuideCoach tool="interview-glow-up" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the guide again' }));
    look(2);
    expect(screen.getByRole('complementary', { name: 'Guide' })).toHaveTextContent('Step 1 of 8');
  });

  it('goes back a step and stays there', () => {
    const page = addToPage('<textarea id="intro-draft"></textarea>');
    (page.querySelector('textarea') as HTMLTextAreaElement).value = 'A draft that is long enough.';
    saveProgress('networking-practice', {
      mode: 'guided',
      done: ['scenario', 'draft'],
      finished: false,
    });
    render(<GuideCoach tool="networking-practice" />);
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    expect(coach).toHaveTextContent('Step 3 of 6');
    fireEvent.click(screen.getByRole('button', { name: 'Back a step' }));
    look(2);
    expect(coach).toHaveTextContent('Step 2 of 6');
  });

  it('opens the tab that holds the target before showing it', () => {
    const page = addToPage('<button data-guide="tab-decode">Decode the job</button>');
    const tab = page.querySelector('button') as HTMLButtonElement;
    const opened = vi.fn(() => {
      page.insertAdjacentHTML('beforeend', '<button data-guide="decode-parse">Parse</button>');
    });
    tab.addEventListener('click', opened);
    saveProgress('interview-glow-up', { mode: 'guided', done: ['paste'], finished: false });
    render(<GuideCoach tool="interview-glow-up" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show me where' }));
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('tells a lab computer user how to leave nothing behind when the guide finishes', () => {
    saveProgress('career', {
      mode: 'guided',
      done: GUIDES.career?.steps.map((step) => step.id) ?? [],
      finished: true,
    });
    render(<GuideCoach tool="career" />);
    const coach = screen.getByRole('complementary', { name: 'Guide' });
    expect(coach).toHaveTextContent(
      'On a shared or lab computer, export your work from the dashboard and then clear this device.'
    );
    expect(screen.getByRole('link', { name: 'Open the dashboard' })).toHaveAttribute(
      'href',
      '/dashboard/#storage-title'
    );
  });

  it('leaves room at the end of the page for the coach bar', () => {
    saveProgress('career', { mode: 'guided', done: [], finished: false });
    render(<GuideCoach tool="career" />);
    expect(document.querySelector('[data-guide-spacer]')).toBeInTheDocument();
  });
});

describe('Application Desk guide', () => {
  it('has one step per station, in station order, Resume fourth', () => {
    expect(applicationGuide.steps).toHaveLength(6);
    expect(applicationGuide.steps.map((step) => step.title.split(':')[0])).toEqual([
      'Posting',
      'Qualifications',
      'Bullets',
      'Resume',
      'Letter',
      'Before you send',
    ]);
    expect(applicationGuide.steps[3].target).toBe('[data-guide="station-resume"]');
  });
});

describe('every guide', () => {
  it('uses data-guide attributes or ids, not visible text, to find things', () => {
    for (const guide of Object.values(GUIDES)) {
      for (const step of guide?.steps ?? []) {
        for (const selector of [step.target, step.reveal, step.example?.click]) {
          if (selector) expect(selector, step.id).not.toMatch(/:contains|text=/);
        }
      }
    }
  });
});
