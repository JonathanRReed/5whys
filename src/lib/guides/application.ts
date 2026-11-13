import type { Guide } from '../guide';
import { countWord, SEND_CHECK_IDS } from '../send-check-ids';

/**
 * One step per station, in the order the Desk numbers them, so "Step 4 of
 * 6" is always station 4, Resume.
 */
export const applicationGuide: Guide = {
  tool: 'application',
  invitation:
    'New to this? The guide walks you through one application, station by station, from the posting to the last check.',
  steps: [
    {
      id: 'posting',
      title: 'Posting: name the job and decode it',
      body: 'Type the role and the company and press "Start this application". Then paste the whole posting, press "Decode the posting", and confirm the requirements that are real.',
      why: 'Every other station works from this, so you never paste it again. You do not need every requirement to apply.',
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
      body: 'Open the Qualifications station. For each requirement choose have it, maybe, or not yet, and write how you will show it or get it.',
      target: '[data-guide="station-qualifications"]',
      done: { kind: 'exists', selector: 'input[name^="status-"]:checked' },
    },
    {
      id: 'bullets',
      title: 'Bullets: turn one experience into two',
      body: 'Open the Bullets station. Describe one experience, say what happened because of it, then write two bullets that answer the posting.',
      why: 'A class project, a part-time job, or a club all count.',
      target: '[data-guide="station-bullets"]',
      done: { kind: 'filled', selector: '[data-guide="bullet-slot-0"]', minLength: 20 },
    },
    {
      id: 'resume',
      title: 'Resume: choose what goes in this copy',
      body: 'Open the Resume station. If your resume is in the Resume Game, choose which bullets go in the copy for this role and download it. No resume yet? The station links to the Resume Game, or skip this step for now.',
      target: '[data-guide="station-resume"]',
      done: { kind: 'exists', selector: '[data-guide="station-resume"][data-state="active"]' },
    },
    {
      id: 'letter',
      title: 'Letter: an opening only you could write',
      body: 'Open the Letter station and write the hook: something you did, then the role. Then press "Write the three messages" to reuse it as a LinkedIn message, a follow-up email, and an opener for a call.',
      why: 'If the hook opens like every other letter, the page will say so.',
      target: '[data-guide="station-letter"]',
      done: { kind: 'exists', selector: '[data-guide="message-linkedin"]' },
    },
    {
      id: 'check',
      title: 'Before you send: the last check',
      body: `Open "Before you send". ${countWord(SEND_CHECK_IDS.length)} checks are computed from what you wrote; two only you can answer.`,
      target: '[data-guide="station-send"]',
      done: { kind: 'exists', selector: '[data-guide="send-checks"]' },
    },
  ],
  finish: {
    title: 'You have seen every station',
    body: '"Before you send" lists what is still open for this application. When it is clear, see how your resume backs each requirement, then prepare stories for the interview.',
    link: { label: 'Match your resume to this posting', href: '/resume-game/' },
  },
};
