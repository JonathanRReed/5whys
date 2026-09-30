import { describe, expect, test } from 'vitest';
import type { Story } from '../src/lib/glowup-store';

function originalFilter(stories: Story[], topStoryIds: string[]) {
  const packetStories = stories.filter((s) => topStoryIds.includes(s.id));
  const otherStories = stories.filter((s) => !topStoryIds.includes(s.id));
  return { packetStories, otherStories };
}

function optimizedFilter(stories: Story[], topStoryIds: string[]) {
  const topSet = new Set(topStoryIds);
  const packetStories: Story[] = [];
  const otherStories: Story[] = [];

  for (const story of stories) {
    if (topSet.has(story.id)) {
      packetStories.push(story);
    } else {
      otherStories.push(story);
    }
  }

  return { packetStories, otherStories };
}

describe('PacketSection story filtering benchmark', () => {
  test('correctness check', () => {
    const stories = Array.from({ length: 100 }, (_, i) => ({
      id: `story-${i}`,
      primarySkillId: 'skill-1',
      otherSkillIds: [],
      trigger: 'Trigger',
      hook: 'Hook',
      proofSnippet: 'Proof',
      play: 'Play',
      proof: 'Proof',
      confidence: 80,
      questionPrompts: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    }));
    const topStoryIds = ['story-5', 'story-10', 'story-50', 'story-99'];

    const resOriginal = originalFilter(stories, topStoryIds);
    const resOptimized = optimizedFilter(stories, topStoryIds);

    expect(resOptimized.packetStories).toEqual(resOriginal.packetStories);
    expect(resOptimized.otherStories).toEqual(resOriginal.otherStories);
  });

  test('benchmark original vs optimized', { timeout: 30000 }, () => {
    // Generate N stories and M topStoryIds
    const numStories = 1000;
    const numTop = 250;

    const stories = Array.from({ length: numStories }, (_, i) => ({
      id: `story-${i}`,
      primarySkillId: 'skill-1',
      otherSkillIds: [],
      trigger: 'Trigger',
      hook: 'Hook',
      proofSnippet: 'Proof',
      play: 'Play',
      proof: 'Proof',
      confidence: 80,
      questionPrompts: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    }));

    const topStoryIds = Array.from({ length: numTop }, (_, i) => `story-${i * 2}`);

    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 50; i++) {
      originalFilter(stories, topStoryIds);
      optimizedFilter(stories, topStoryIds);
    }

    // Benchmark original
    const startOriginal = performance.now();
    for (let i = 0; i < iterations; i++) {
      originalFilter(stories, topStoryIds);
    }
    const durationOriginal = performance.now() - startOriginal;

    // Benchmark optimized
    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimizedFilter(stories, topStoryIds);
    }
    const durationOptimized = performance.now() - startOptimized;

    console.log(`Original duration (${iterations} iterations): ${durationOriginal.toFixed(2)}ms`);
    console.log(`Optimized duration (${iterations} iterations): ${durationOptimized.toFixed(2)}ms`);
    console.log(`Speedup factor: ${(durationOriginal / durationOptimized).toFixed(2)}x`);

    expect(durationOptimized).toBeLessThan(durationOriginal);
  });
});
