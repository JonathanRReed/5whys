import type { Guide } from '../guide';

export const networkingPracticeGuide: Guide = {
  tool: 'networking-practice',
  invitation: 'New to this? The guide walks you through one practice rep, start to saved.',
  steps: [
    {
      id: 'scenario',
      title: 'Pick the situation closest to yours',
      body: 'Open "Scenario" and choose one.',
      why: 'The timer length and the sample lines follow the situation you picked.',
      target: '#scenario',
      // The picker marks itself once the visitor has chosen, even the same one.
      done: { kind: 'exists', selector: '[data-guide-scenario="picked"]' },
      // Writing a draft means the situation is picked.
      passed: { kind: 'filled', selector: '#intro-draft', minLength: 1 },
    },
    {
      id: 'draft',
      title: 'Write the intro you would say',
      body: 'Who you are, one thing you bring, one question. "Help me write it" has lines.',
      why: 'Your own words hold up better than a script when you are nervous.',
      target: '#intro-draft',
      done: { kind: 'filled', selector: '#intro-draft', minLength: 10 },
      passed: { kind: 'filled', selector: '#intro-draft', minLength: 10 },
    },
    {
      id: 'timer',
      title: 'Press "Start" and say it out loud',
      why: 'Saying it shows where it runs long or where you trip. Reading it does not.',
      target: '[data-guide="rep-timer"]',
      done: { kind: 'exists', selector: '[data-guide="timer-elapsed"]' },
    },
    {
      id: 'rate',
      title: 'Rate the rep, 1 to 5',
      body: 'All four ratings, honestly.',
      why: 'The "Next step" under the ratings follows your lowest one.',
      target: '[data-guide="rep-ratings"]',
      done: {
        kind: 'exists',
        selector: '[data-guide="rep-actions"]:not(:has([data-guide="rep-not-ready"]))',
      },
    },
    {
      id: 'next-fix',
      title: 'Write one fix for next time',
      why: 'One change is enough. The rest can wait for later reps.',
      target: '#reflection-nextFocus',
      done: { kind: 'filled', selector: '#reflection-nextFocus', minLength: 2 },
    },
    {
      id: 'save',
      title: 'Press "Save this rep"',
      why: 'The history keeps your words, your time and your ratings.',
      target: '[data-guide="rep-save"]',
      done: { kind: 'exists', selector: '[data-guide="saved-rep"]' },
    },
  ],
  challenge: {
    title: 'Do a second rep with your fix',
    body: 'Same steps, no pointers. Save it when you are done.',
    done: { kind: 'count', selector: '[data-guide="saved-rep"]', atLeast: 2 },
  },
  finish: {
    title: 'That is one full rep',
    body: 'When an interview is coming, build the stories behind your intro.',
    link: { label: 'Open the interview workspace', href: '/interview-glow-up/workspace/' },
  },
};
