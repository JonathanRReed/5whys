import type { Guide } from '../guide';
import { countWord, SEND_CHECK_IDS } from '../send-check-ids';

/**
 * One step per station, in the order the Desk numbers them, so "Step 4 of
 * 6" is always station 4, Resume.
 */
export const applicationGuide: Guide = {
  tool: 'application',
  invitation: 'New to this? The guide walks you through one application, station by station.',
  steps: [
    {
      id: 'posting',
      title: 'Posting: name the job and decode it',
      body: 'Start the application, paste the posting, decode it, and confirm what is real.',
      why: 'Every other station works from this, so you never paste it again.',
      target:
        '[data-guide="posting-requirements"], [data-guide="posting-editor"], [data-guide="desk-new"]',
      reveal: '[data-guide="station-posting"]',
      done: {
        kind: 'text',
        selector: '[data-testid="posting-count"]',
        pattern: '^[1-9]\\d* confirmed',
      },
      example: { label: 'Use a sample posting', click: '[data-guide="posting-sample"]' },
    },
    {
      id: 'stand',
      title: 'Qualifications: mark where you stand',
      body: 'Choose "Have it", "Maybe" or "Not yet" for a requirement.',
      why: 'You do not need every requirement to apply. Write how you will show the ones you have.',
      target: '[data-guide="station-qualifications"]',
      done: { kind: 'exists', selector: 'input[name^="status-"]:checked' },
    },
    {
      id: 'bullets',
      title: 'Bullets: write one from an experience',
      body: 'Describe one thing you did and what came of it, then write bullet 1.',
      why: 'A class project, a part-time job, or a club all count.',
      target: '[data-guide="station-bullets"]',
      done: { kind: 'filled', selector: '[data-guide="bullet-slot-0"]', minLength: 20 },
    },
    {
      id: 'resume',
      title: 'Resume: choose what goes in this copy',
      body: 'Open the Resume station.',
      why: 'With a resume in the Resume Game, you choose here which lines go in the copy for this job.',
      target: '[data-guide="station-resume"]',
      done: { kind: 'exists', selector: '[data-guide="station-resume"][data-state="active"]' },
    },
    {
      id: 'letter',
      title: 'Letter: write a hook, then the messages',
      body: 'Write something you did, then the role. Then press "Write the three messages".',
      why: 'The same hook now opens a LinkedIn message, a follow-up email and a call.',
      target: '[data-guide="station-letter"]',
      done: { kind: 'exists', selector: '[data-guide="message-linkedin"]' },
    },
    {
      id: 'check',
      title: 'Before you send: read the checks',
      body: 'Open "Before you send".',
      why: `${countWord(SEND_CHECK_IDS.length)} checks are computed from what you wrote; two only you can answer.`,
      target: '[data-guide="station-send"]',
      done: { kind: 'exists', selector: '[data-guide="send-checks"]' },
    },
  ],
  challenge: {
    title: 'Write the second bullet on your own',
    body: 'Back on Bullets, the same way as the first.',
    done: { kind: 'filled', selector: '[data-guide="bullet-slot-1"]', minLength: 20 },
  },
  finish: {
    title: 'You have seen every station',
    body: '"Before you send" lists what is still open for this application. When it is clear, see how your resume backs each requirement, then prepare stories for the interview.',
    link: { label: 'Match your resume to this posting', href: '/resume-game/' },
  },
};
