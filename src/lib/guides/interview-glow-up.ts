import type { Guide } from '../guide';

export const interviewGlowUpGuide: Guide = {
  tool: 'interview-glow-up',
  invitation:
    'New to this? The guide walks you through one job posting, from its requirements to a story in your packet.',
  steps: [
    {
      id: 'paste',
      title: 'Paste a job posting',
      body: 'Copy the whole posting, headings and all, into "Paste the job posting".',
      why: 'The job title is optional. Leave it blank and the first line of the posting is used.',
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
      title: 'Pull out the requirements',
      body: 'Press "Parse the requirements". Each line is sorted into required, nice to have, or a duty, and gets a suggested skill. Pay and legal text are set aside.',
      why: 'Change a tag if it is wrong, and press "Ignore" on any line that is not a real requirement.',
      target: '[data-guide="decode-parse"]',
      reveal: '[data-guide="tab-decode"]',
      done: { kind: 'exists', selector: '[data-guide="decode-requirements"]' },
      passed: { kind: 'exists', selector: '[data-guide-posting="decoded"]' },
    },
    {
      id: 'open-stories',
      title: 'Go to Build stories',
      body: 'Press the "Build stories" tab. Skills the posting tests that have no story yet are listed as gaps.',
      target: '[data-guide="tab-stories"]',
      done: { kind: 'exists', selector: '[data-guide="tab-stories"][data-state="active"]' },
    },
    {
      id: 'start-story',
      title: 'Start a story from a gap',
      body: 'Press one of the skills after "Start with a gap", or "+ New story". The story editor opens.',
      why: 'Class projects, part-time jobs, clubs, volunteering, and any past job all count as stories.',
      target: '[data-guide="stories-start"]',
      reveal: '[data-guide="tab-stories"]',
      done: { kind: 'exists', selector: '#story-play' },
    },
    {
      id: 'play',
      title: 'Write what you did',
      body: 'In "What you did (play)", say what you did and decided, with "I", not "we". Make sure "Primary skill" is the skill this story proves.',
      why: 'Put a result under "What came of it" only if it is true. Never invent a number.',
      target: '#story-play',
      reveal: '[data-guide="tab-stories"]',
      done: { kind: 'filled', selector: '#story-play', minLength: 10 },
    },
    {
      id: 'save-story',
      title: 'Save it into the packet',
      body: 'Press "Save and add to packet". The story goes into the packet for this job.',
      why: '"How ready is it?" can stay at "Rough" for now. Change it as you rehearse.',
      target: '[data-guide="story-save"]',
      done: { kind: 'exists', selector: '[data-guide="story-card"]' },
      // A story in the packet means every step up to here is behind the visitor.
      passed: { kind: 'exists', selector: '[data-guide-packet="stories"]' },
    },
    {
      id: 'open-packet',
      title: 'Go to Pack the proof',
      body: 'Press the "Pack the proof" tab. Your story is listed under "Stories in this packet".',
      target: '[data-guide="tab-packet"]',
      done: { kind: 'exists', selector: '[data-guide="tab-packet"][data-state="active"]' },
    },
    {
      id: 'hud',
      title: 'Open the cheat sheet',
      body: 'Press "Open the cheat sheet (HUD)" at the bottom of the packet. It is one screen for the call: your stories, keywords, and fallback story.',
      why: 'Press Escape to close it and come back to the packet.',
      target: '[data-guide="packet-hud"]',
      reveal: '[data-guide="tab-packet"]',
      done: { kind: 'exists', selector: '[aria-label="Close HUD"]' },
    },
  ],
  finish: {
    title: 'Your first story is packed',
    body: 'Write a story for each remaining gap, then rehearse from the HUD before the call. When an offer comes, put it into plain terms.',
    link: { label: 'Open the offer worksheet', href: '/pay/' },
  },
};
