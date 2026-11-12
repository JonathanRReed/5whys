import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RehearsalRoom from '../src/components/rehearsal/RehearsalRoom';
import type { GlowUpData, Story } from '../src/lib/glowup-store';
import { decodePostingToBullets } from '../src/lib/posting';

const NORTHGATE = readFileSync(
  'tests/fixtures/postings/northgate-operations-coordinator.txt',
  'utf8'
);

const truckStory: Story = {
  id: 's1',
  primarySkillId: 'logistics',
  otherSkillIds: ['scheduling'],
  trigger: 'Truck schedule',
  hook: 'Trucks from the DC sat half unloaded at the end of every shift.',
  proofSnippet: 'Trucks worked within six hours',
  play: 'I set a dock schedule with the DC and moved breaks around it.',
  proof: 'Trucks were worked the same day.',
  confidence: 60,
  readiness: 'solid',
  questionPrompts: [],
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

function seed() {
  const { bullets, parsed } = decodePostingToBullets(NORTHGATE);
  const data: GlowUpData = {
    version: 1,
    roles: [
      {
        id: 'r1',
        jobTitle: 'Operations Coordinator',
        company: 'Northgate Logistics Partners',
        rawJdText: NORTHGATE,
        parsedJdText: parsed.text,
        bullets,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    stories: [truckStory],
    packets: [],
    currentRoleId: 'r1',
    currentPacketId: null,
  };
  localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
  localStorage.setItem(
    'career-tools-profile',
    JSON.stringify({ stage: 'transition', focus: 'interview', updatedAt: '2026-11-12' })
  );
}

beforeEach(() => {
  localStorage.clear();
  seed();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function answerAndMoveOn() {
  fireEvent.change(screen.getByLabelText('Your answer'), {
    target: { value: 'I would start with the schedule and call the carriers.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review my answer' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Next question' }));
}

it('offers the visitor their own story under a question it fits, and writes nothing', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  render(<RehearsalRoom />);
  expect(await screen.findByText(/You said you are changing careers/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: /In writing/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start with the first question' }));

  // Opener, the change, leaving, the gap: then the posting's questions.
  expect(screen.getByTestId('rehearsal-question')).toHaveTextContent('Tell me about yourself.');
  expect(screen.queryByTestId('rehearsal-story')).toBeNull();
  for (let i = 0; i < 5; i++) await answerAndMoveOn();

  expect(screen.getByTestId('rehearsal-question')).toHaveTextContent(
    /coordinate daily inbound and outbound shipment schedules/
  );
  const hint = screen.getByTestId('rehearsal-story');
  expect(hint).toHaveTextContent('You have a story that fits: Truck schedule');
  // Collapsed until asked.
  expect(screen.queryByText(truckStory.hook)).toBeNull();
  const show = screen.getByRole('button', { name: 'Show my story' });
  expect(show).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(show);
  expect(screen.getByText(truckStory.hook)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide my story' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );

  // Reading stories and the posting never writes to storage.
  const writes = setItem.mock.calls.map(([key]) => key);
  expect(writes).not.toContain('interview-glow-up-data');
});

it('shows what a strong answer shows and a common mistake after an answer', async () => {
  render(<RehearsalRoom />);
  fireEvent.click(await screen.findByRole('radio', { name: /In writing/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start with the first question' }));
  fireEvent.change(screen.getByLabelText('Your answer'), {
    target: { value: 'I ran a store for eight years.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review my answer' }));
  const notes = await screen.findByTestId('take-notes');
  expect(notes).toHaveTextContent('A strong answer shows');
  expect(notes).toHaveTextContent('A common mistake');
});
