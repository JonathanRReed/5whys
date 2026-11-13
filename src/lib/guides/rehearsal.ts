import type { Guide } from '../guide';

export const rehearsalGuide: Guide = {
  tool: 'rehearsal',
  invitation: 'New to this? The guide walks you through answering one question and reviewing it.',
  steps: [
    {
      id: 'start',
      title: 'Choose how to answer, then start',
      body: 'Pick "Out loud" or "In writing".',
      why: 'Out loud records on this device so you can listen back. Nothing is sent anywhere.',
      target: '[data-guide="rehearsal-setup"]',
      done: { kind: 'exists', selector: '[data-testid="rehearsal-question"]' },
      // A quick visitor can be past the question before the coach next looks:
      // being anywhere beyond the setup screen means this step is done.
      passed: {
        kind: 'exists',
        selector: '[data-testid="rehearsal-question"], #facts-title, #rehearsal-done-heading',
      },
    },
    {
      id: 'answer',
      title: 'Answer the question',
      body: 'Record it or type it, the way you would say it in the room. Then review.',
      why: 'These are counts, not grades. There is no proven right pace.',
      target: '[data-testid="rehearsal-question"]',
      done: { kind: 'exists', selector: '[data-testid="take-words"]' },
      // After a reload the room is back at the start: so is the guide.
      needs: {
        kind: 'exists',
        selector: '[data-testid="rehearsal-question"], #facts-title, #rehearsal-done-heading',
      },
      // Skipping every question still reaches the end of the run.
      passed: {
        kind: 'exists',
        selector: '[data-testid="take-words"], #rehearsal-done-heading',
      },
    },
    {
      id: 'self-check',
      title: 'Tick what is true of your answer',
      body: 'Under "Check it yourself", below the counts.',
      why: 'Only you can judge these. Filler words are counted only when you answer out loud.',
      target: '[data-guide="self-check"]',
      done: { kind: 'exists', selector: '[data-guide="self-check"] input:checked' },
      needs: {
        kind: 'exists',
        selector: '[data-guide="self-check"], #facts-title, #rehearsal-done-heading',
      },
      // Asking for the follow-up, or reaching the end of the run, is past this step.
      passed: {
        kind: 'exists',
        selector:
          '[data-guide="self-check"] input:checked, [data-guide="follow-up"], #rehearsal-done-heading',
      },
    },
    {
      id: 'follow-up',
      title: 'Press "What might they ask next?"',
      why: 'Interviewers often dig into the part you skipped past.',
      target: '[data-guide="self-check"]',
      done: { kind: 'exists', selector: '[data-guide="follow-up"]' },
      needs: { kind: 'exists', selector: '[data-guide="self-check"], #rehearsal-done-heading' },
      // The end of the run finishes the guide, however the visitor got there.
      passed: { kind: 'exists', selector: '[data-guide="follow-up"], #rehearsal-done-heading' },
    },
    {
      id: 'again',
      title: 'Try it again, or go to the next',
      why: 'A second attempt at the same question is often where it gets better.',
      done: { kind: 'exists', selector: '[data-testid="rehearsal-question"]' },
      // The end of the run finishes the guide, however the visitor got there.
      passed: { kind: 'exists', selector: '#rehearsal-done-heading' },
      needs: {
        kind: 'exists',
        selector: '#facts-title, [data-testid="rehearsal-question"], #rehearsal-done-heading',
      },
    },
  ],
  challenge: {
    title: 'Answer the next question on your own',
    body: 'No pointers this time. Answer it and review it.',
    done: { kind: 'exists', selector: '[data-guide-review]:not([data-guide-review="0"])' },
  },
  finish: {
    title: 'That is one full rep',
    body: 'Turn your best answers into stories you can reuse.',
    link: { label: 'Build interview stories', href: '/interview-glow-up/workspace/?tab=stories' },
  },
};
