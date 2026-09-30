import { describe, expect, it } from 'vitest';
import {
  type GlowUpData,
  type InterviewPacket,
  type Story,
  updatePacket,
} from '../src/lib/glowup-store';

// Function simulating handleBatchAddToPacket logic (unoptimized vs optimized)
function originalBatchAdd(
  data: GlowUpData,
  currentPacket: InterviewPacket,
  selectedIds: Set<string>
) {
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

function optimizedBatchAdd(
  data: GlowUpData,
  currentPacket: InterviewPacket,
  selectedIds: Set<string>
) {
  if (!currentPacket || selectedIds.size === 0) return data;

  // Optimization: use Sets for O(1) lookups
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

describe('VaultSection handleBatchAddToPacket Benchmark', () => {
  it('compares original vs optimized performance', () => {
    // Generate dataset: 5,000 existing topStoryIds, 5,000 selectedIds, 10,000 stories total
    const numTopStoryIds = 5000;
    const numSelected = 5000;
    const numStories = 10000;

    const topStoryIds = Array.from({ length: numTopStoryIds }, (_, i) => `story-${i}`);
    const selectedIds = new Set(Array.from({ length: numSelected }, (_, i) => `story-${i + 2500}`)); // 2500 overlap, 2500 new

    const stories: Story[] = Array.from({ length: numStories }, (_, i) => ({
      id: `story-${i}`,
      primarySkillId: 'skill-1',
      otherSkillIds: [],
      trigger: `Trigger ${i}`,
      hook: `Hook ${i}`,
      proofSnippet: `Proof ${i}`,
      play: `Play ${i}`,
      proof: `Proof ${i}`,
      confidence: 80,
      readiness: 'solid',
      questionPrompts: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const packet: InterviewPacket = {
      id: 'packet-1',
      roleId: 'role-1',
      mode: 'prep',
      topStoryIds,
      customQuestions: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockData: GlowUpData = {
      version: 1,
      roles: [],
      stories,
      packets: [packet],
      currentRoleId: 'role-1',
      currentPacketId: 'packet-1',
    };

    // Warmup
    originalBatchAdd(mockData, packet, selectedIds);
    optimizedBatchAdd(mockData, packet, selectedIds);

    // Measure Original
    const startOrig = performance.now();
    const origResult = originalBatchAdd(mockData, packet, selectedIds);
    const endOrig = performance.now();
    const origDuration = endOrig - startOrig;

    // Measure Optimized
    const startOpt = performance.now();
    const optResult = optimizedBatchAdd(mockData, packet, selectedIds);
    const endOpt = performance.now();
    const optDuration = endOpt - startOpt;

    console.log(`Original duration: ${origDuration.toFixed(3)}ms`);
    console.log(`Optimized duration: ${optDuration.toFixed(3)}ms`);
    console.log(`Speedup: ${(origDuration / optDuration).toFixed(2)}x`);

    expect(origResult.packets[0].topStoryIds.length).toBe(optResult.packets[0].topStoryIds.length);
    expect(origResult.packets[0].topStoryIds.length).toBe(7500);
  });
});
