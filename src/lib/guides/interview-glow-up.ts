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
      done: { kind: 'filled', selector: '#jd-text', minLength: 80 },
      example: { label: 'Use a sample posting', click: '[data-guide="decode-sample"]' },
    },
    {
      id: 'parse',
      title: 'Pull out the requirements',
      body: 'Press "Parse the requirements". Each requirement gets a suggested skill, and headings and benefits are skipped.',
      why: 'Change a tag if it is wrong, and press "Ignore" on any line that is not a real requirement.',
      target: '[data-guide="decode-parse"]',
      done: { kind: 'exists', selector: '[data-guide="decode-requirements"]' },
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
      why: 'Class projects, part-time jobs, clubs, and volunteering all count as stories.',
      target: '[data-guide="stories-start"]',
      done: { kind: 'exists', selector: '#story-play' },
    },
    {
      id: 'play',
      title: 'Write what you did',
      body: 'In "Play (What You Did)", say what you did and decided, with "I", not "we". Make sure "Primary Skill" is the skill this story proves.',
      why: 'Put a result under "Proof" only if it is true. Never invent a number.',
      target: '#story-play',
      done: { kind: 'filled', selector: '#story-play', minLength: 40 },
    },
    {
      id: 'save-story',
      title: 'Save it into the packet',
      body: 'Press "Save and add to packet". The story goes into the packet for this job.',
      why: '"How ready is it?" can stay at "Rough" for now. Change it as you rehearse.',
      target: '[data-guide="story-save"]',
      done: { kind: 'exists', selector: '[data-guide="story-card"]' },
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
      title: 'Open the HUD',
      body: 'Press "Open the HUD" at the bottom of the packet. It shows your stories, keywords, and panic answer on one screen for the call.',
      why: 'Press Escape to close it and come back to the packet.',
      target: '[data-guide="packet-hud"]',
      done: { kind: 'exists', selector: '[aria-label="Close HUD"]' },
    },
  ],
  finish: {
    title: 'Your first story is packed',
    body: 'Write a story for each remaining gap, then rehearse from the HUD before the call. When an offer comes, put it into plain terms.',
    link: { label: 'Open the offer worksheet', href: '/pay/' },
  },
};
