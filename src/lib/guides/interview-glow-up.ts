import type { Guide } from '../guide';

export const interviewGlowUpGuide: Guide = {
  tool: 'interview-glow-up',
  invitation:
    'New to this? The guide walks you through one posting, to a story ready for the call.',
  steps: [
    {
      id: 'paste',
      title: 'Paste a job posting',
      body: 'The whole thing, headings and all.',
      why: 'Leave the job title blank and the first line of the posting is used.',
      target: '#jd-text',
      reveal: '[data-guide="tab-decode"]',
      done: { kind: 'filled', selector: '#jd-text', minLength: 80 },
      passed: {
        kind: 'exists',
        selector: '[data-guide-posting="pasted"], [data-guide-posting="decoded"]',
      },
      example: { label: 'Use a sample posting', click: '[data-guide="decode-sample"]' },
    },
    {
      id: 'parse',
      title: 'Press "Parse the requirements"',
      why: 'Each line is now sorted into required, nice to have, or a duty. Change any tag that is wrong.',
      target: '[data-guide="decode-parse"]',
      reveal: '[data-guide="tab-decode"]',
      done: { kind: 'exists', selector: '[data-guide="decode-requirements"]' },
      passed: { kind: 'exists', selector: '[data-guide-posting="decoded"]' },
    },
    {
      id: 'start-story',
      title: 'Start a story from a gap',
      body: 'In "Build stories", press a skill that has no story yet.',
      why: 'Class projects, part-time jobs, clubs and any past job all count as stories.',
      target: '[data-guide="stories-start"]',
      reveal: '[data-guide="tab-stories"]',
      done: { kind: 'exists', selector: '#story-play' },
    },
    {
      id: 'play',
      title: 'Write what you did',
      body: 'Say "I", not "we". A few sentences is enough.',
      why: 'Add a result under "What came of it" only if it is true. Never invent a number.',
      target: '#story-play',
      reveal: '[data-guide="tab-stories"]',
      done: { kind: 'filled', selector: '#story-play', minLength: 10 },
    },
    {
      id: 'save-story',
      title: 'Press "Save and add to packet"',
      why: '"How ready is it?" can stay at "Rough" for now. Change it as you rehearse.',
      target: '[data-guide="story-save"]',
      done: { kind: 'exists', selector: '[data-guide="story-card"]' },
      // A story in the packet means every step up to here is behind the visitor.
      passed: { kind: 'exists', selector: '[data-guide-packet="stories"]' },
    },
    {
      id: 'hud',
      title: 'Open the cheat sheet',
      body: 'In "Pack the proof", press "Open the cheat sheet (HUD)".',
      why: 'It is one screen for the call. Escape closes it.',
      target: '[data-guide="packet-hud"]',
      reveal: '[data-guide="tab-packet"]',
      done: { kind: 'exists', selector: '[aria-label="Close HUD"]' },
    },
  ],
  challenge: {
    title: 'Write a story for another gap',
    body: 'Same steps, no pointers: pick a gap, write what you did, save it.',
    done: { kind: 'count', selector: '[data-guide="story-card"]', atLeast: 2 },
  },
  finish: {
    title: 'Your first story is packed',
    body: 'Next, answer the questions this posting is likely to raise.',
    link: { label: 'Rehearse the questions', href: '/interview-glow-up/rehearse/' },
  },
};
