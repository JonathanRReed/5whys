import type { Guide } from '../guide';

export const resumeGameGuide: Guide = {
  tool: 'resume-game',
  invitation: 'New to this? The guide walks you through scoring a resume and rewriting one line.',
  steps: [
    {
      id: 'add-resume',
      title: 'Put a resume in the box',
      body: 'Paste it or upload it. No resume? Press "I do not have a resume yet".',
      why: 'Everything here works on the lines you gave it, and they stay on this device.',
      target: '[aria-label="Paste resume text"]',
      done: { kind: 'filled', selector: '[aria-label="Paste resume text"]', minLength: 10 },
      // A scored line means a resume is in, however short it was.
      passed: { kind: 'exists', selector: '[data-bullet-list] button' },
      example: { label: 'Use a sample resume', click: '[data-guide="resume-sample"]' },
    },
    {
      id: 'analyze',
      title: 'Press "Analyze resume"',
      why: 'The score only shows which line to work on next. It does not predict a hire.',
      target: '[data-guide="resume-analyze"]',
      done: { kind: 'exists', selector: '[data-bullet-list] button' },
    },
    {
      id: 'rewrite',
      title: 'Rewrite your weakest line',
      body: 'Press the lowest score in the list, then start the line with what you did.',
      why: 'No number to add? Say what changed because of your work. Never invent one.',
      target: '#bullet-editor',
      done: { kind: 'text', selector: '#bullet-editor', pattern: 'Started at \\d+/100' },
    },
    {
      id: 'second-wording',
      title: 'Press "Suggest a rewrite"',
      why: 'It uses only what you wrote. Anything it adds is struck through.',
      target: '#bullet-editor',
      done: {
        kind: 'exists',
        selector: '[data-testid="rewrite-text"], [data-guide="rewrite-none"]',
      },
    },
  ],
  challenge: {
    title: 'Raise the score of a second line',
    body: 'Pick another line and rewrite it the same way.',
    done: { kind: 'count', selector: '[data-bullet-list] [data-guide-improved]', atLeast: 2 },
  },
  finish: {
    title: 'That is the whole loop',
    body: 'When you have a job in mind, fit this resume to its posting.',
    link: { label: 'Open the Application Desk', href: '/application/' },
  },
};
