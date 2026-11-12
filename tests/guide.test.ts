import { afterEach, describe, expect, it } from 'vitest';
import {
  currentStep,
  evaluateCheck,
  GUIDE_STORAGE_KEY,
  GUIDE_TOOLS,
  type Guide,
  loadGuideProgress,
  markStepDone,
  restartGuide,
  saveGuideProgress,
} from '../src/lib/guide';
import { GUIDES } from '../src/lib/guides';

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
});

const guide: Guide = {
  tool: 'resume-game',
  invitation: 'Try it.',
  steps: [
    { id: 'a', title: 'A', body: 'Do a.', done: { kind: 'exists', selector: '#a' } },
    { id: 'b', title: 'B', body: 'Do b.', done: { kind: 'manual' } },
  ],
  finish: { title: 'Done', body: 'Finished.' },
};

describe('checks look at the page', () => {
  it('exists, count, filled and text', () => {
    document.body.innerHTML =
      '<p id="a">Scores 40/100</p><li class="x"></li><li class="x"></li><textarea id="t"></textarea>';
    expect(evaluateCheck({ kind: 'exists', selector: '#a' }, document)).toBe(true);
    expect(evaluateCheck({ kind: 'exists', selector: '#missing' }, document)).toBe(false);
    expect(evaluateCheck({ kind: 'count', selector: '.x', atLeast: 2 }, document)).toBe(true);
    expect(evaluateCheck({ kind: 'count', selector: '.x', atLeast: 3 }, document)).toBe(false);
    expect(evaluateCheck({ kind: 'filled', selector: '#t', minLength: 5 }, document)).toBe(false);
    (document.querySelector('#t') as HTMLTextAreaElement).value = 'hello there';
    expect(evaluateCheck({ kind: 'filled', selector: '#t', minLength: 5 }, document)).toBe(true);
    expect(evaluateCheck({ kind: 'text', selector: '#a', pattern: '\\d+/100' }, document)).toBe(
      true
    );
  });

  it('never throws on a bad selector or pattern, and manual is never automatic', () => {
    expect(evaluateCheck({ kind: 'exists', selector: '[[' }, document)).toBe(false);
    document.body.innerHTML = '<p id="a">x</p>';
    expect(evaluateCheck({ kind: 'text', selector: '#a', pattern: '(' }, document)).toBe(false);
    expect(evaluateCheck({ kind: 'manual' }, document)).toBe(false);
  });
});

describe('progress', () => {
  it('walks the steps in order and finishes', () => {
    let progress = restartGuide();
    expect(currentStep(guide, progress)?.id).toBe('a');
    progress = markStepDone(guide, progress, 'a');
    expect(currentStep(guide, progress)?.id).toBe('b');
    expect(progress.finished).toBe(false);
    progress = markStepDone(guide, progress, 'b');
    expect(currentStep(guide, progress)).toBeNull();
    expect(progress.finished).toBe(true);
  });

  it('is null until the visitor chooses, then is remembered per tool', () => {
    expect(loadGuideProgress('resume-game')).toBeNull();
    saveGuideProgress('resume-game', markStepDone(guide, restartGuide(), 'a'));
    expect(loadGuideProgress('resume-game')).toEqual({
      mode: 'guided',
      done: ['a'],
      finished: false,
    });
    expect(loadGuideProgress('application')).toBeNull();
  });

  it('survives a hand-edited or broken store', () => {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, '{"resume-game":{"mode":"weird","done":"no"}}');
    expect(loadGuideProgress('resume-game')).toEqual({ mode: 'free', done: [], finished: false });
    window.localStorage.setItem(GUIDE_STORAGE_KEY, 'not json');
    expect(loadGuideProgress('resume-game')).toBeNull();
  });
});

describe('every guide is well formed', () => {
  for (const tool of GUIDE_TOOLS) {
    const entry = GUIDES[tool];
    if (!entry) continue;
    it(`${tool}: unique step ids, usable selectors, plain copy`, () => {
      expect(entry.tool).toBe(tool);
      const ids = entry.steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const step of entry.steps) {
        const selectors = [
          step.target,
          step.example?.click,
          'selector' in step.done ? step.done.selector : undefined,
        ].filter((s): s is string => Boolean(s));
        for (const selector of selectors) {
          expect(() => document.querySelector(selector)).not.toThrow();
        }
        const done = step.done;
        if (done.kind === 'text') expect(() => new RegExp(done.pattern)).not.toThrow();
        const copy = `${step.title} ${step.body} ${step.why ?? ''}`;
        expect(copy).not.toMatch(/—|!/);
      }
      expect(`${entry.invitation} ${entry.finish.title} ${entry.finish.body}`).not.toMatch(/—|!/);
    });
  }
});
