import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDeskExamples } from '../src/components/application-desk/examples';
import { PROFILE_STORAGE_KEY } from '../src/lib/profile';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const save = (stage: string) =>
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({ stage, focus: 'applying', updatedAt: new Date().toISOString() })
  );

describe('desk examples', () => {
  it('shows student examples when no profile is saved', () => {
    const { result } = renderHook(() => useDeskExamples());
    expect(result.current.experiencePlaceholder).toContain('campus radio');
  });

  it('keeps student examples for a student or an early-career visitor', () => {
    save('early');
    const { result } = renderHook(() => useDeskExamples());
    expect(result.current.letter[1]).toContain('campus food pantry');
  });

  it('shows working examples to someone changing fields', async () => {
    save('transition');
    const { result } = renderHook(() => useDeskExamples());
    await waitFor(() => expect(result.current.experiencePlaceholder).toContain('warehouse'));
    expect(result.current.experienceHelp).not.toContain('class project');
    expect(result.current.letter).toHaveLength(6);
  });
});
