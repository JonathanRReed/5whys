import { describe, expect, it } from 'vitest';
import type { Story } from '../src/lib/glowup-store';

function createMockStory(id: string, primarySkillId: string): Story {
  return {
    id,
    primarySkillId,
    otherSkillIds: [],
    trigger: `Trigger ${id}`,
    hook: `Hook ${id}`,
    proofSnippet: '',
    play: '',
    proof: '',
    confidence: 60,
    readiness: 'solid',
    questionPrompts: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Benchmark function mimicking original code
function filterStoriesBaseline(stories: Story[], topStoryIds: string[]) {
  const packetStories = stories.filter((s) => topStoryIds.includes(s.id));
  const otherStories = stories.filter((s) => !topStoryIds.includes(s.id));
  return { packetStories, otherStories };
}

// Benchmark function mimicking optimized code
function filterStoriesOptimized(stories: Story[], topStoryIds: string[]) {
  const topStoryIdsSet = new Set(topStoryIds);
  const packetStories = stories.filter((s) => topStoryIdsSet.has(s.id));
  const otherStories = stories.filter((s) => !topStoryIdsSet.has(s.id));
  return { packetStories, otherStories };
}

describe('PacketSection story filtering', () => {
  it('produces identical filtering results between baseline and optimized approaches', () => {
    const stories: Story[] = [
      createMockStory('1', 's1'),
      createMockStory('2', 's2'),
      createMockStory('3', 's1'),
    ];
    const topStoryIds = ['1', '3'];

    const baseline = filterStoriesBaseline(stories, topStoryIds);
    const optimized = filterStoriesOptimized(stories, topStoryIds);

    expect(optimized.packetStories).toEqual(baseline.packetStories);
    expect(optimized.otherStories).toEqual(baseline.otherStories);
    expect(optimized.packetStories.map((s) => s.id)).toEqual(['1', '3']);
    expect(optimized.otherStories.map((s) => s.id)).toEqual(['2']);
  });

  it('measures performance improvement with a large set of stories', () => {
    const storyCount = 2000;
    const topCount = 500;

    const stories: Story[] = Array.from({ length: storyCount }, (_, i) =>
      createMockStory(`story-${i}`, `skill-${i % 10}`)
    );

    const topStoryIds = Array.from({ length: topCount }, (_, i) => `story-${i * 2}`);

    // Measure Baseline
    const startBaseline = performance.now();
    for (let i = 0; i < 20; i++) {
      filterStoriesBaseline(stories, topStoryIds);
    }
    const durationBaseline = performance.now() - startBaseline;

    // Measure Optimized
    const startOptimized = performance.now();
    for (let i = 0; i < 20; i++) {
      filterStoriesOptimized(stories, topStoryIds);
    }
    const durationOptimized = performance.now() - startOptimized;

    console.log(`Baseline filtering duration (20 runs): ${durationBaseline.toFixed(2)}ms`);
    console.log(`Optimized filtering duration (20 runs): ${durationOptimized.toFixed(2)}ms`);

    expect(durationOptimized).toBeLessThan(durationBaseline);
  });
});
