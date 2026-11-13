import type { Guide, GuideStep } from '../guide';

const depth = (
  level: number,
  title: string,
  body: string | undefined,
  why: string | undefined
): GuideStep => ({
  id: `depth-${level}`,
  title,
  ...(body ? { body } : {}),
  ...(why ? { why } : {}),
  target: `[aria-label="Depth ${level} response"]`,
  // The same rule the tool uses: the box marks itself once the answer counts.
  done: { kind: 'exists', selector: `[aria-label="Depth ${level} response"][data-answered]` },
  example: { label: 'Show a worked example', click: `[data-guide="why-example-${level - 1}"]` },
});

export const careerGuide: Guide = {
  tool: 'career',
  invitation: 'New to this? The guide walks you through one chain of five whys.',
  steps: [
    {
      id: 'topic',
      title: 'Type the role or subject you are weighing',
      body: 'Pick "Career Path" or "Interest Path" first. A word or two is enough.',
      why: 'Every question quotes what you typed.',
      target: '[data-guide="why-track"]',
      done: { kind: 'filled', selector: '#career-topic', minLength: 2 },
    },
    depth(
      1,
      'Answer the first question',
      'Say it the way you would tell a friend.',
      'The first answer is usually the obvious one. The next questions dig under it.'
    ),
    depth(
      2,
      'Say why that matters to you',
      'Try not to repeat your first answer.',
      'An answer that restates the last one gets a note under its box.'
    ),
    depth(3, 'Go one layer deeper', 'What does that reason protect, cost, or prove?', undefined),
    depth(
      4,
      'Ask why again',
      undefined,
      'Answers this deep tend to be about you more than the job.'
    ),
    depth(
      5,
      'Name the reason underneath',
      undefined,
      'Your "Why Statement" and one way to test it are below the questions.'
    ),
    {
      id: 'save',
      title: 'Press "Save snapshot"',
      why: 'The chain is kept on this device and shows on your dashboard.',
      target: '[data-guide="why-save"]',
      done: { kind: 'exists', selector: '[aria-label^="Load snapshot:"]' },
    },
  ],
  challenge: {
    title: 'Pick which answer is the real reason',
    body: 'It is under "Which answer is the real reason?". It is not always the last one.',
    done: { kind: 'exists', selector: '[data-guide-root="chosen"]' },
  },
  finish: {
    title: 'You have the reason in your own words',
    body: 'Use it to choose which experiences belong on your resume.',
    link: { label: 'Open the Resume Game', href: '/resume-game/' },
  },
};
