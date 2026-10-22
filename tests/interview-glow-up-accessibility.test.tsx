import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PacketSection from '../src/components/interview-glow-up/PacketSection';
import StoriesSection from '../src/components/interview-glow-up/StoriesSection';
import VaultSection from '../src/components/interview-glow-up/VaultSection';
import type { DecodedRole, GlowUpData, InterviewPacket } from '../src/lib/glowup-store';

afterEach(() => {
  cleanup();
});

const mockRole: DecodedRole = {
  id: 'role-1',
  jobTitle: 'Frontend Developer',
  company: 'Acme Corp',
  rawJdText: 'Posting text',
  bullets: [],
  createdAt: 1000,
  updatedAt: 1000,
};

const mockPacket: InterviewPacket = {
  id: 'packet-1',
  roleId: 'role-1',
  mode: 'prep',
  topStoryIds: [],
  customQuestions: [],
  notes: '',
  panicAnswer: '',
  createdAt: 1000,
  updatedAt: 1000,
};

const mockData: GlowUpData = {
  version: 1,
  roles: [mockRole],
  packets: [mockPacket],
  stories: [],
  currentRoleId: 'role-1',
  currentPacketId: 'packet-1',
};

describe('Interview Glow Up accessibility controls', () => {
  it('updates aria-pressed on mode toggle buttons in PacketSection', () => {
    render(
      <PacketSection
        data={mockData}
        setData={vi.fn()}
        currentRole={mockRole}
        currentPacket={mockPacket}
        onLaunchHUD={vi.fn()}
        onGoToStories={vi.fn()}
        onGoToDecode={vi.fn()}
      />
    );

    const prepButton = screen.getByRole('button', { name: 'Prep' });
    const reviewButton = screen.getByRole('button', { name: 'Review' });

    expect(prepButton).toHaveAttribute('aria-pressed', 'true');
    expect(reviewButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(reviewButton);

    expect(prepButton).toHaveAttribute('aria-pressed', 'false');
    expect(reviewButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates aria-pressed on filter toggle button in VaultSection', () => {
    render(<VaultSection data={mockData} setData={vi.fn()} currentPacket={mockPacket} />);

    const filterButton = screen.getByRole('button', { name: 'Unused only' });
    expect(filterButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates aria-expanded on general questions toggle in StoriesSection', () => {
    render(
      <StoriesSection
        data={mockData}
        setData={vi.fn()}
        currentRole={mockRole}
        currentPacket={mockPacket}
        onGoToDecode={vi.fn()}
      />
    );

    // Open new story editor
    const newStoryButton = screen.getByRole('button', { name: '+ New story' });
    fireEvent.click(newStoryButton);

    const toggleButton = screen.getByRole('button', { name: /Show general questions/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);

    const expandedButton = screen.getByRole('button', { name: /Hide general questions/i });
    expect(expandedButton).toHaveAttribute('aria-expanded', 'true');
  });
});
