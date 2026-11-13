import type { Guide } from '../guide';

export const resumeGameGuide: Guide = {
  tool: 'resume-game',
  invitation:
    'New to this? The guide walks you through scoring a resume and rewriting one weak line.',
  steps: [
    {
      id: 'add-resume',
      title: 'Put a resume in',
      body: 'Paste your resume into the box, or upload a PDF or Word file. Bullets only is fine. No resume yet? Press "I do not have a resume yet" and answer a few short questions.',
      why: 'Everything here works on the lines you give it, and it stays on this device.',
      target: '[aria-label="Paste resume text"]',
      done: { kind: 'filled', selector: '[aria-label="Paste resume text"]', minLength: 10 },
      // A scored line means a resume is in, however short it was.
      passed: { kind: 'exists', selector: '[data-bullet-list] button' },
      example: { label: 'Use a sample resume', click: '[data-guide="resume-sample"]' },
    },
    {
      id: 'analyze',
      title: 'Score it',
      body: 'Press "Analyze resume". Each achievement line gets a score for action, result, and measure.',
      why: 'The score only tells you which line to work on next. It does not predict whether you get the job.',
      target: '[data-guide="resume-analyze"]',
      done: { kind: 'exists', selector: '[data-bullet-list] button' },
    },
    {
      id: 'pick-line',
      title: 'Pick a weak line',
      body: 'The first bullet is already open in the editor. Look down the list and choose the one with the lowest score instead.',
      why: 'The biggest gains are in the lines that say the least.',
      target: '[data-bullet-list]',
      done: { kind: 'manual' },
    },
    {
      id: 'rewrite',
      title: 'Rewrite it, one part at a time',
      body: 'Start with the first word: a strong action verb. Then add the result, and a number if you have a true one. Watch the score move.',
      why: 'If you have no number, say what changed because of your work. Never invent one.',
      target: '#bullet-editor',
      done: { kind: 'text', selector: '#bullet-editor', pattern: 'Started at \\d+/100' },
    },
    {
      id: 'second-wording',
      title: 'Ask for a second wording',
      body: 'Press "Suggest a rewrite". It uses only what you wrote and runs on this device. Anything it adds that you did not write is struck through.',
      target: '#bullet-editor',
      done: {
        kind: 'exists',
        selector: '[data-testid="rewrite-text"], [data-guide="rewrite-none"]',
      },
    },
  ],
  finish: {
    title: 'That is the whole loop',
    body: 'Pick the next weakest line and do it again. When you have a job in mind, match your resume to its posting.',
    link: { label: 'Open the Application Desk', href: '/application/' },
  },
};
