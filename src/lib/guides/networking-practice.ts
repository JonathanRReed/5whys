import type { Guide } from '../guide';

export const networkingPracticeGuide: Guide = {
  tool: 'networking-practice',
  invitation:
    'New to this? The guide walks you through one practice rep, from picking the situation to a saved intro.',
  steps: [
    {
      id: 'scenario',
      title: 'Pick the situation',
      body: 'Open "Scenario" and choose the conversation closest to your next one. Its focus, who, and where show beside it.',
      why: 'The timer length and the sample lines follow the situation you pick.',
      target: '#scenario',
      done: { kind: 'manual' },
      // Writing a draft means the situation is picked.
      passed: { kind: 'filled', selector: '#intro-draft', minLength: 1 },
    },
    {
      id: 'draft',
      title: 'Write the intro you would say',
      body: 'In "Draft", write an opener, who you are, one honest line about what you bring, and one question. "Help me write it" has lines that work with no experience.',
      why: "Use your own words. If a line only works with someone else's achievements in it, cut it.",
      target: '#intro-draft',
      done: { kind: 'filled', selector: '#intro-draft', minLength: 40 },
      passed: { kind: 'filled', selector: '#intro-draft', minLength: 40 },
    },
    {
      id: 'timer',
      title: 'Say it out loud against the clock',
      body: 'Press "Start" on the "Rep timer" and say your intro out loud, the way you would in the room.',
      why: 'Saying it shows where it runs long or where you trip. Reading it silently does not.',
      target: '[data-guide="rep-timer"]',
      done: { kind: 'exists', selector: '[data-guide="timer-elapsed"]' },
    },
    {
      id: 'rate',
      title: 'Rate the rep honestly',
      body: 'Under "Rate this rep", move each slider to say how it went.',
      why: 'The "Next step" under the sliders follows your lowest score.',
      target: '[data-guide="rep-ratings"]',
      done: {
        kind: 'exists',
        selector: '[data-guide="rep-actions"]:not(:has([data-guide="rep-not-ready"]))',
      },
    },
    {
      id: 'next-fix',
      title: 'Choose one fix',
      body: 'Write the one thing you will change next time in "One fix for next rep".',
      why: 'Pick the change that would help most. The rest can wait for later reps.',
      target: '#reflection-nextFocus',
      done: { kind: 'filled', selector: '#reflection-nextFocus', minLength: 5 },
    },
    {
      id: 'save',
      title: 'Save the rep',
      body: 'Press "Save this rep". The history below keeps your exact words, the time you practiced, and your ratings.',
      why: 'After a few reps, the history shows how your intro changed.',
      target: '[data-guide="rep-save"]',
      done: { kind: 'exists', selector: '[data-guide="saved-rep"]' },
    },
  ],
  finish: {
    title: 'That is one full rep',
    body: 'Do another with your fix in mind. When an interview is coming, build the stories behind your intro.',
    link: { label: 'Open the interview workspace', href: '/interview-glow-up/workspace/' },
  },
};
