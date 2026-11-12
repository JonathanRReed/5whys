import type { Guide } from '../guide';

export const payGuide: Guide = {
  tool: 'pay',
  invitation:
    'New to this? The guide walks you through finding the occupation behind a job title and putting an offer into plain terms.',
  steps: [
    {
      id: 'title',
      title: 'Type a job title',
      body: 'Type the title from the posting into "Job title". Matching occupations appear under it as you type.',
      why: 'The search runs on this device. What you type is not sent anywhere.',
      target: '[data-guide="pay-title"]',
      done: { kind: 'exists', selector: '[data-guide="pay-candidates"]' },
    },
    {
      id: 'occupation',
      title: 'Pick the occupation that fits',
      body: 'Titles mean different things at different employers. Choose the occupation in the list that matches the work.',
      why: 'If nothing fits, try a plainer version of the title.',
      target: '[data-guide="pay-candidates"]',
      done: { kind: 'exists', selector: '[data-testid="pay-occupation"]' },
    },
    {
      id: 'base',
      title: 'Enter the base pay',
      body: 'In the "Offer worksheet", type the base pay from an offer or a posting into "Base pay".',
      why: 'Use the figure you were given. Never guess one.',
      target: '[data-guide="offer-basePay"]',
      done: { kind: 'filled', selector: '[data-guide="offer-basePay"]' },
    },
    {
      id: 'period',
      title: 'Say how it is paid',
      body: 'Under "Paid", choose whether that figure is per hour, per week, per month, or per year.',
      target: '[data-guide="offer-period"]',
      done: { kind: 'filled', selector: '[data-guide="offer-period"]' },
    },
    {
      id: 'time',
      title: 'Add the hours and weeks',
      body: 'Fill in "Hours a week" and "Weeks a year". Each figure on the right that says "Needs more detail" fills in once both are there.',
      why: 'Nothing is assumed, so a summer internship is never counted as a full year.',
      target: '[data-guide="offer-hoursPerWeek"]',
      done: {
        kind: 'text',
        selector: '[data-guide="offer-results"]',
        pattern: '^(?![\\s\\S]*Needs more detail)',
      },
    },
  ],
  finish: {
    title: 'The offer is in plain terms',
    body: 'The worksheet is kept only when it belongs to an application. Start one on the Application Desk to save it with the job.',
    link: { label: 'Open the Application Desk', href: '/application/' },
  },
};
