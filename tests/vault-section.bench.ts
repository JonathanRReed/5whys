import { describe, expect, test } from 'vitest';
import type { GlowUpData, InterviewPacket, Story } from '../src/lib/glowup-store';
import { updatePacket } from '../src/lib/glowup-store';

function handleBatchAddToPacketLegacy(
  data: GlowUpData,
  currentPacket: InterviewPacket,
  selectedIds: Set<string>
): GlowUpData {
  if (!currentPacket || selectedIds.size === 0) return data;

  const newIds = Array.from(selectedIds).filter((id) => !currentPacket.topStoryIds.includes(id));
  const updatedData = updatePacket(data, currentPacket.id, {
    topStoryIds: [...currentPacket.topStoryIds, ...newIds],
  });
  const finalData = {
    ...updatedData,
    stories: updatedData.stories.map((s) =>
      newIds.includes(s.id) ? { ...s, lastUsedAt: Date.now() } : s
    ),
  };
  return finalData;
}

function handleBatchAddToPacketOptimized(
  data: GlowUpData,
  currentPacket: InterviewPacket,
  selectedIds: Set<string>
): GlowUpData {
  if (!currentPacket || selectedIds.size === 0) return data;

  const topStoryIdsSet = new Set(currentPacket.topStoryIds);
  const newIds = Array.from(selectedIds).filter((id) => !topStoryIdsSet.has(id));
  const newIdsSet = new Set(newIds);
  const updatedData = updatePacket(data, currentPacket.id, {
    topStoryIds: [...currentPacket.topStoryIds, ...newIds],
  });
  const finalData = {
    ...updatedData,
    stories: updatedData.stories.map((s) =>
      newIdsSet.has(s.id) ? { ...s, lastUsedAt: Date.now() } : s
    ),
  };
  return finalData;
}

describe('VaultSection handleBatchAddToPacket logic', () => {
  const numItems = 2000;
  const stories: Story[] = Array.from({ length: numItems }, (_, i) => ({
    id: `story-${i}`,
    trigger: `Trigger ${i}`,
    play: `Play ${i}`,
    proof: `Proof ${i}`,
    hook: `Hook ${i}`,
    primarySkillId: 'communication',
    otherSkillIds: [],
    questionPrompts: [],
    proofSnippet: '',
    confidence: 60,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: 0,
  }));

  const topStoryIds = Array.from({ length: 1000 }, (_, i) => `story-${i + 500}`);
  const packet: InterviewPacket = {
    id: 'packet-1',
    roleId: 'role-1',
    mode: 'prep',
    notes: '',
    customQuestions: [],
    topStoryIds,
    createdAt: 0,
    updatedAt: 0,
  };

  const data: GlowUpData = {
    version: 1,
    roles: [],
    stories,
    packets: [packet],
    currentRoleId: 'role-1',
    currentPacketId: 'packet-1',
  };

  const selectedIds = new Set(Array.from({ length: 1000 }, (_, i) => `story-${i}`));

  test('both functions return identical topStoryIds and updated stories count', () => {
    const legacyResult = handleBatchAddToPacketLegacy(data, packet, selectedIds);
    const optimizedResult = handleBatchAddToPacketOptimized(data, packet, selectedIds);

    const legacyUpdatedPacket = legacyResult.packets.find((p) => p.id === packet.id);
    const optimizedUpdatedPacket = optimizedResult.packets.find((p) => p.id === packet.id);

    expect(legacyUpdatedPacket).toBeDefined();
    expect(optimizedUpdatedPacket).toBeDefined();

    if (legacyUpdatedPacket && optimizedUpdatedPacket) {
      expect(optimizedUpdatedPacket.topStoryIds).toEqual(legacyUpdatedPacket.topStoryIds);
    }

    const legacyTouchedCount = legacyResult.stories.filter((s) => (s.lastUsedAt ?? 0) > 0).length;
    const optimizedTouchedCount = optimizedResult.stories.filter(
      (s) => (s.lastUsedAt ?? 0) > 0
    ).length;

    expect(optimizedTouchedCount).toBe(legacyTouchedCount);
  });

  test('compare performance of legacy vs optimized', async ({ bench }) => {
    await bench.compare(
      bench('legacy O(N*M)', () => {
        handleBatchAddToPacketLegacy(data, packet, selectedIds);
      }),
      bench('optimized O(N)', () => {
        handleBatchAddToPacketOptimized(data, packet, selectedIds);
      }),
      { iterations: 200 }
    );
  });
});
