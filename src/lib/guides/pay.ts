// Read with an import attribute, not through src/config/pay.ts, so the guide
// list also loads outside the bundler (the Playwright guided-mode flows).
import provenance from '../../../public/data/pay/provenance.json' with { type: 'json' };
import type { Guide, GuideStep } from '../guide';

/** Mirrors `hasWages` in src/config/pay.ts. */
const hasWages = (provenance as { status?: string }).status !== 'titles-only';

/** Finding the occupation behind a title. Shown only once wage figures are built in. */
const TITLE_STEPS: GuideStep[] = [
  {
    id: 'title',
    title: 'Type a job title',
    body: 'Use the title from the posting.',
    why: 'The search runs on this device. What you type is not sent anywhere.',
    target: '[data-guide="pay-title"]',
    done: { kind: 'exists', selector: '[data-guide="pay-candidates"]' },
  },
  {
    id: 'occupation',
    title: 'Pick the occupation that fits',
    body: 'Choose the one that matches the work, not the title.',
    why: 'Titles mean different things at different employers.',
    target: '[data-guide="pay-candidates"]',
    done: { kind: 'exists', selector: '[data-testid="pay-occupation"]' },
  },
];

/** Putting one offer into plain terms. */
const WORKSHEET_STEPS: GuideStep[] = [
  {
    id: 'base',
    title: 'Enter the base pay',
    body: 'Use the figure from the offer or the posting.',
    why: 'A figure you were given keeps every number below honest. Never guess one.',
    target: '[data-guide="offer-basePay"]',
    done: { kind: 'filled', selector: '[data-guide="offer-basePay"]' },
  },
  {
    id: 'period',
    title: 'Say how often it is paid',
    body: 'Under "Paid": an hour, a week, a month or a year.',
    target: '[data-guide="offer-period"]',
    done: { kind: 'filled', selector: '[data-guide="offer-period"]' },
  },
  {
    id: 'time',
    title: 'Add hours a week and weeks a year',
    why: 'Nothing is assumed, so a summer job is never counted as a full year.',
    target: '[data-guide="offer-hoursPerWeek"]',
    done: {
      kind: 'text',
      selector: '[data-guide="offer-results"]',
      pattern: '^(?![\\s\\S]*Needs more detail)',
    },
  },
];

export const payGuide: Guide = {
  tool: 'pay',
  invitation: hasWages
    ? 'New to this? The guide walks you through finding an occupation and putting an offer into plain terms.'
    : 'New to this? The guide walks you through putting an offer into plain terms.',
  steps: hasWages ? [...TITLE_STEPS, ...WORKSHEET_STEPS] : WORKSHEET_STEPS,
  challenge: {
    title: 'Add a second offer and compare them',
    body: 'Save this one as an offer, add another, and fill it in.',
    done: { kind: 'exists', selector: '[data-testid="offer-compare"]' },
  },
  finish: {
    title: 'The offer is in plain terms',
    body: 'Press "Save it as an offer" to keep it. Then hold it against what you want.',
    link: { label: 'Check it against your reason', href: '/career/' },
  },
};
