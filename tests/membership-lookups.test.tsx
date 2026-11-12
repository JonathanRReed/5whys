import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VaultSection from '../src/components/interview-glow-up/VaultSection';
import {
  createDefaultData,
  type GlowUpData,
  type InterviewPacket,
  type Story,
} from '../src/lib/glowup-store';
import { INVOLVEMENT_PHRASES, isVerbWord, leadingAction } from '../src/lib/resume-game/verbs';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function story(id: string, lastUsedAt?: number): Story {
  return {
    id,
    trigger: id,
    primarySkillId: 'communication',
    otherSkillIds: [],
    hook: '',
    proofSnippet: '',
    play: '',
    proof: '',
    confidence: 60,
    readiness: 'solid',
    questionPrompts: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt,
  };
}

it('batch-adds only new selections without changing existing or unselected stories', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const packet: InterviewPacket = {
    id: 'packet',
    roleId: 'role',
    mode: 'prep',
    topStoryIds: ['existing'],
    customQuestions: [],
    notes: '',
    createdAt: 1,
    updatedAt: 1,
  };
  const data: GlowUpData = {
    ...createDefaultData(),
    stories: [story('existing', 50), story('new'), story('untouched')],
    packets: [packet],
  };
  const setData = vi.fn();
  render(<VaultSection data={data} setData={setData} currentPacket={packet} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select story: existing' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select story: new' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to Packet' }));
  expect(setData).toHaveBeenCalledTimes(1);
  const result = setData.mock.calls[0][0] as GlowUpData;
  expect(result.packets[0].topStoryIds).toEqual(['existing', 'new']);
  expect(result.stories.map((item) => item.lastUsedAt)).toEqual([50, 1000, undefined]);
  expect(result.stories[0]).toBe(data.stories[0]);
  expect(result.stories[2]).toBe(data.stories[2]);
  expect(data.packets[0].topStoryIds).toEqual(['existing']);
  expect(screen.queryByText('2 selected')).toBeNull();
});

it('recognizes every involvement phrase regardless of case', () => {
  for (const phrase of INVOLVEMENT_PHRASES) {
    expect(leadingAction(`  ${phrase.toUpperCase()} the spring fundraiser`)?.involvement).toBe(
      true
    );
  }
  expect(isVerbWord('unlisted-word')).toBe(false);
});
