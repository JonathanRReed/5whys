import type { Guide } from '../guide';

export const rehearsalGuide: Guide = {
  tool: 'rehearsal',
  invitation:
    'New to this? The guide walks you through answering one interview question and reviewing it.',
  steps: [
    {
      id: 'start',
      title: 'Choose how to answer and start',
      body: 'Pick "Out loud" or "In writing", then press "Start with the first question".',
      why: 'Out loud records on this device so you can listen back. Nothing is sent anywhere.',
      target: '[data-guide="rehearsal-setup"]',
      done: { kind: 'exists', selector: '[data-testid="rehearsal-question"]' },
    },
    {
      id: 'answer',
      title: 'Answer the question',
      body: 'Press "Record my answer" and speak, then "Stop and review". Or type your answer and press "Review my answer".',
      why: 'Answer the way you would in the room. A structured answer commonly runs one to two minutes.',
      target: '[data-testid="rehearsal-question"]',
      done: { kind: 'exists', selector: '[data-testid="take-words"]' },
      // After a reload the room is back at the start: so is the guide.
      needs: { kind: 'exists', selector: '[data-testid="rehearsal-question"], #facts-title' },
    },
    {
      id: 'counts',
      title: 'Read what can be counted',
      body: 'Look at the length, the words, and any filler words. If you recorded, play it back.',
      why: 'These are counts, not grades. There is no proven right pace.',
      target: '#facts-title',
      done: { kind: 'manual' },
      needs: { kind: 'exists', selector: '#facts-title' },
    },
    {
      id: 'self-check',
      title: 'Check it yourself',
      body: 'Tick what is true of this answer. Did you answer the question, say what you did, and say what happened because of it?',
      target: '[data-guide="self-check"]',
      done: { kind: 'exists', selector: '[data-guide="self-check"] input:checked' },
      needs: { kind: 'exists', selector: '[data-guide="self-check"]' },
    },
    {
      id: 'follow-up',
      title: 'See what they might ask next',
      body: 'Press "What might they ask next?". Interviewers often dig into the part you skipped past.',
      target: '[data-guide="self-check"]',
      done: { kind: 'exists', selector: '[data-guide="follow-up"]' },
      needs: { kind: 'exists', selector: '[data-guide="self-check"]' },
    },
    {
      id: 'again',
      title: 'Go again or move on',
      body: 'Press "Try this one again" to improve the same answer, or "Next question" to keep going.',
      why: 'The second attempt at the same question is usually where it gets better.',
      done: { kind: 'exists', selector: '[data-testid="rehearsal-question"]' },
      needs: {
        kind: 'exists',
        selector: '#facts-title, [data-testid="rehearsal-question"], #rehearsal-done-heading',
      },
    },
  ],
  finish: {
    title: 'That is one full rep',
    body: 'Work through the rest of the questions, then turn your best answers into stories you can reuse.',
    link: { label: 'Build interview stories', href: '/interview-glow-up/workspace/?tab=stories' },
  },
};
