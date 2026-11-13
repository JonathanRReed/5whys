import 'fake-indexeddb/auto';
import { act, cleanup, render } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ApplicationDesk from '../src/components/application-desk/ApplicationDesk';
import Career5Whys from '../src/components/Career5Whys';
import InterviewGlowUpWorkspace from '../src/components/interview-glow-up/InterviewGlowUpWorkspace';
import NetworkingPractice from '../src/components/NetworkingPractice';
import PayTool from '../src/components/pay/PayTool';
import ResumeGame from '../src/components/ResumeGame';
import RehearsalRoom from '../src/components/rehearsal/RehearsalRoom';

// A score out of 5 or a percentage, the shapes an unearned number takes.
const OUT_OF_FIVE = /\d(\.\d)?\s*\/\s*5\b/;
const PERCENT = /\d+\s*%/;
// Figures that are not scores: the 5 Whys progress line counts answered
// questions (0% with none answered), and the pay worksheet shows the format a
// bonus can be typed in.
const NOT_SCORES = [/(?<!\d)0% complete/g, /a percentage of base pay such as 5%/g];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TOOLS: [string, () => React.ReactElement][] = [
  ['Career 5 Whys', () => <Career5Whys />],
  ['Resume Game', () => <ResumeGame />],
  ['Networking Practice', () => <NetworkingPractice />],
  ['Interview workspace', () => <InterviewGlowUpWorkspace />],
  ['Rehearsal room', () => <RehearsalRoom />],
  ['Application desk', () => <ApplicationDesk />],
  ['Pay', () => <PayTool />],
];

it.each(TOOLS)('%s shows no score the visitor has not earned', async (_name, tool) => {
  const { container } = render(tool());
  // Let mount effects read storage and settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const text = NOT_SCORES.reduce(
    (remaining, allowed) => remaining.replace(allowed, ''),
    container.textContent ?? ''
  );
  expect(text).not.toMatch(OUT_OF_FIVE);
  expect(text).not.toMatch(PERCENT);
  // Rendering from empty storage writes nothing either.
  expect(Object.keys(localStorage)).toEqual([]);
});
