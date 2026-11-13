import type { Guide } from '../guide';
import { countWord, SEND_CHECK_IDS } from '../send-check-ids';

export const applicationGuide: Guide = {
  tool: 'application',
  invitation:
    'New to this? The guide walks you through one application, from the posting to a letter.',
  steps: [
    {
      id: 'start',
      title: 'Name the job',
      body: 'Type the role and the company, then press "Start this application". A deadline is optional.',
      target: '[data-guide="desk-new"]',
      done: { kind: 'exists', selector: '[data-guide="desk-current"]' },
    },
    {
      id: 'paste',
      title: 'Paste the posting once',
      body: 'Copy the whole job description, headings and all, into the box and press "Decode the posting".',
      why: 'Every other station works from this, so you never paste it again.',
      target: '[data-guide="posting-editor"]',
      done: { kind: 'exists', selector: '[data-testid="posting-specimen"]' },
      example: { label: 'Use a sample posting', click: '[data-guide="posting-sample"]' },
    },
    {
      id: 'confirm',
      title: 'Decide what really matters',
      body: 'Each highlighted sentence is something the posting asks for. Confirm the real requirements and dismiss the rest. The ones near the top, or said twice, usually matter most.',
      why: 'You do not need all of them to apply.',
      target: '[data-guide="posting-requirements"]',
      done: {
        kind: 'text',
        selector: '[data-testid="posting-count"]',
        pattern: '^[1-9]\\d* confirmed',
      },
    },
    {
      id: 'stand',
      title: 'Mark where you stand',
      body: 'Open the Qualifications station. For each requirement choose have it, maybe, or not yet, and write how you will show it or get it.',
      target: '[data-guide="station-qualifications"]',
      done: { kind: 'exists', selector: 'input[name^="status-"]:checked' },
    },
    {
      id: 'bullets',
      title: 'Turn one experience into two bullets',
      body: 'Open the Bullets station. Describe one experience, say what happened because of it, then write two bullets that answer the posting.',
      why: 'A class project, a part-time job, or a club all count.',
      target: '[data-guide="station-bullets"]',
      done: { kind: 'filled', selector: '[data-guide="bullet-slot-0"]', minLength: 20 },
    },
    {
      id: 'hook',
      title: 'Write an opening only you could write',
      body: 'Open the Letter station and write the hook: something you did, then the role. If it opens like every other letter, the page will say so.',
      target: '[data-guide="station-letter"]',
      done: { kind: 'filled', selector: '[data-guide="letter-hook"]', minLength: 40 },
    },
    {
      id: 'messages',
      title: 'Reuse it three ways',
      body: 'Press "Write the three messages" to turn the hook into a LinkedIn message, a follow-up email, and an opener for a call. Edit them until they sound like you.',
      target: '[data-guide="letter-messages"]',
      done: { kind: 'exists', selector: '[data-guide="message-linkedin"]' },
    },
    {
      id: 'check',
      title: 'Check before you send',
      body: `Open "Before you send". ${countWord(SEND_CHECK_IDS.length)} checks are computed from what you wrote; two only you can answer.`,
      target: '[data-guide="station-send"]',
      done: { kind: 'exists', selector: '[data-guide="send-checks"]' },
    },
  ],
  finish: {
    title: 'You have worked one application end to end',
    body: 'Next, see how your resume backs each requirement, then prepare stories for the interview.',
    link: { label: 'Match your resume to this posting', href: '/resume-game/' },
  },
};
