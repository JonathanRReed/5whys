import type { Guide } from '../guide';

export const careerGuide: Guide = {
  tool: 'career',
  invitation:
    'New to this? The guide walks you through one chain of five whys, from the first reason to the one underneath.',
  steps: [
    {
      id: 'topic',
      title: 'Name what you are weighing',
      body: 'Choose "Career Path" if you have a role in mind, or "Interest Path" if all you have is a subject you like. Then type the role or subject in the box under it.',
      why: 'Every question quotes what you type, so a word or two is enough.',
      target: '[data-guide="why-track"]',
      done: { kind: 'filled', selector: '#career-topic', minLength: 2 },
    },
    {
      id: 'depth-1',
      title: 'Give the first reason',
      body: 'Answer the "Depth 1" question. Say the most concrete thing pulling you toward it, the way you would tell a friend.',
      why: 'The first answer is usually the obvious one. That is fine. The questions after it dig underneath.',
      target: '[aria-label="Depth 1 response"]',
      done: { kind: 'filled', selector: '[aria-label="Depth 1 response"]', minLength: 12 },
      example: { label: 'Show a worked example', click: '[data-guide="why-example-0"]' },
    },
    {
      id: 'depth-2',
      title: 'Ask why about that reason',
      body: 'The "Depth 2" question quotes your first answer. Say why that matters to you, without repeating it.',
      why: 'If an answer mostly restates the one before, the page says so under the box.',
      target: '[aria-label="Depth 2 response"]',
      done: { kind: 'filled', selector: '[aria-label="Depth 2 response"]', minLength: 12 },
      example: { label: 'Show a worked example', click: '[data-guide="why-example-1"]' },
    },
    {
      id: 'depth-3',
      title: 'Go one layer deeper',
      body: 'Answer "Depth 3". Ask what your last reason protects, costs, or proves for you.',
      target: '[aria-label="Depth 3 response"]',
      done: { kind: 'filled', selector: '[aria-label="Depth 3 response"]', minLength: 12 },
      example: { label: 'Show a worked example', click: '[data-guide="why-example-2"]' },
    },
    {
      id: 'depth-4',
      title: 'Keep asking why',
      body: 'Answer "Depth 4". Answers this deep tend to be about you more than the job: a value, a need, or something you want to prove.',
      target: '[aria-label="Depth 4 response"]',
      done: { kind: 'filled', selector: '[aria-label="Depth 4 response"]', minLength: 12 },
      example: { label: 'Show a worked example', click: '[data-guide="why-example-3"]' },
    },
    {
      id: 'depth-5',
      title: 'Name the reason underneath',
      body: 'Answer "Depth 5". When all five are in, your "Why Statement" and one step under "Test this by" appear below.',
      why: 'The step comes from your own answers. Treat it as something to try, not a verdict.',
      target: '[aria-label="Depth 5 response"]',
      done: { kind: 'filled', selector: '[aria-label="Depth 5 response"]', minLength: 12 },
      example: { label: 'Show a worked example', click: '[data-guide="why-example-4"]' },
    },
    {
      id: 'save',
      title: 'Keep a snapshot',
      body: 'Press "Save snapshot". The chain is kept on this device and shows on your dashboard.',
      why: 'Come back when your plans change and see whether the reason underneath still holds.',
      target: '[data-guide="why-save"]',
      done: { kind: 'exists', selector: '[aria-label^="Load snapshot:"]' },
    },
  ],
  finish: {
    title: 'You have the reason in your own words',
    body: 'Use it to choose which experiences belong on your resume, then turn each one into a line that proves it.',
    link: { label: 'Open the Resume Game', href: '/resume-game/' },
  },
};
