import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PacketSection from '../src/components/interview-glow-up/PacketSection';
import StoriesSection from '../src/components/interview-glow-up/StoriesSection';
import VaultSection from '../src/components/interview-glow-up/VaultSection';
import type { DecodedRole, GlowUpData, InterviewPacket, Story } from '../src/lib/glowup-store';

afterEach(cleanup);

const role: DecodedRole = {
  id: 'role',
  jobTitle: 'Frontend Developer',
  company: 'Acme',
  rawJdText: 'Posting text',
  bullets: [],
  createdAt: 1000,
  updatedAt: 1000,
};
const packet: InterviewPacket = {
  id: 'packet',
  roleId: 'role',
  mode: 'prep',
  topStoryIds: [],
  customQuestions: [],
  notes: '',
  createdAt: 1000,
  updatedAt: 1000,
};
const data: GlowUpData = {
  version: 1,
  roles: [role],
  packets: [packet],
  stories: [],
  currentRoleId: role.id,
  currentPacketId: packet.id,
};

it('keeps both mode buttons in sync with the visible packet view across repeated switches', () => {
  render(
    <PacketSection
      data={data}
      setData={vi.fn()}
      currentRole={role}
      currentPacket={packet}
      onLaunchHUD={vi.fn()}
      onGoToStories={vi.fn()}
      onGoToDecode={vi.fn()}
    />
  );
  const prep = screen.getByRole('button', { name: 'Prep' });
  const review = screen.getByRole('button', { name: 'Review' });
  expect(prep).toHaveAttribute('aria-pressed', 'true');
  expect(review).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('heading', { name: 'Stories in this packet' })).toBeInTheDocument();

  for (let cycle = 0; cycle < 2; cycle++) {
    fireEvent.click(review);
    expect(prep).toHaveAttribute('aria-pressed', 'false');
    expect(review).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('No stories in the packet yet')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stories in this packet' })).toBeNull();
    fireEvent.click(prep);
    expect(prep).toHaveAttribute('aria-pressed', 'true');
    expect(review).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'Stories in this packet' })).toBeInTheDocument();
  }
});

it('reports whether the unused filter is active and filters the matching stories', () => {
  const story = (id: string): Story => ({
    id,
    trigger: id,
    primarySkillId: 'communication',
    otherSkillIds: [],
    hook: '',
    proofSnippet: '',
    play: 'Explained the project.',
    proof: '',
    confidence: 60,
    readiness: 'solid',
    questionPrompts: [],
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
  });
  render(
    <VaultSection
      data={{ ...data, stories: [story('Packed story'), story('Unused story')] }}
      setData={vi.fn()}
      currentPacket={{ ...packet, topStoryIds: ['Packed story'] }}
    />
  );
  const filter = screen.getByRole('button', { name: 'Unused only' });
  expect(filter).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('checkbox', { name: 'Select story: Packed story' })).toBeInTheDocument();
  fireEvent.click(filter);
  expect(filter).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('checkbox', { name: 'Select story: Packed story' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Select story: Unused story' })).toBeInTheDocument();
  fireEvent.click(filter);
  expect(filter).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('checkbox', { name: 'Select story: Packed story' })).toBeInTheDocument();
});

it('reports general question disclosure state across collapse, cancel and reopening', () => {
  render(
    <StoriesSection
      data={data}
      setData={vi.fn()}
      currentRole={role}
      currentPacket={packet}
      onGoToDecode={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '+ New story' }));
  const toggle = screen.getByRole('button', { name: /Show general questions/ });
  const questionName = '+ Walk me through your resume.';
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: questionName })).toBeNull();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveAccessibleName('Hide general questions');
  expect(screen.getByRole('button', { name: questionName })).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: questionName })).toBeNull();
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('button', { name: questionName })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+ New story' }));
  expect(screen.getByRole('button', { name: /Show general questions/ })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  expect(screen.queryByRole('button', { name: questionName })).toBeNull();
});
