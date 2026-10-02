import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VaultSection from '../src/components/interview-glow-up/VaultSection';
import { createDefaultData, type GlowUpData, type InterviewPacket, type Story } from '../src/lib/glowup-store';
import { getVerbStrength, POWER_VERBS_STRONG, POWER_VERBS_WEAK, INVOLVEMENT_VERBS } from '../src/lib/resume-game/constants';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function story(id: string, lastUsedAt?: number): Story {
  return {
    id, trigger: id, primarySkillId: 'communication', otherSkillIds: [],
    hook: '', proofSnippet: '', play: '', proof: '', confidence: 60,
    readiness: 'solid', questionPrompts: [], tags: [], createdAt: 1,
    updatedAt: 1, lastUsedAt,
  };
}

it('batch-adds only new selections without changing existing or unselected stories', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const packet: InterviewPacket = {
    id: 'packet', roleId: 'role', mode: 'prep', topStoryIds: ['existing'],
    customQuestions: [], notes: '', createdAt: 1, updatedAt: 1,
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
  fireEvent.click(screen.getByRole('button', { name: 'Add to Packet', exact: true }));
  expect(setData).toHaveBeenCalledTimes(1);
  const result = setData.mock.calls[0][0] as GlowUpData;
  expect(result.packets[0].topStoryIds).toEqual(['existing', 'new']);
  expect(result.stories.map((item) => item.lastUsedAt)).toEqual([50, 1000, undefined]);
  expect(result.stories[0]).toBe(data.stories[0]);
  expect(result.stories[2]).toBe(data.stories[2]);
  expect(data.packets[0].topStoryIds).toEqual(['existing']);
  expect(screen.queryByText('2 selected')).toBeNull();
});

it('retains verb tier precedence and case normalization for every vocabulary entry', () => {
  for (const verb of [...POWER_VERBS_STRONG, ...POWER_VERBS_WEAK, ...INVOLVEMENT_VERBS]) {
    const expected = POWER_VERBS_STRONG.includes(verb) ? 'strong' : 'weak';
    expect(getVerbStrength('  ' + verb.toUpperCase() + '  ')).toBe(expected);
  }
  expect(getVerbStrength('unlisted-word')).toBe('medium');
});
