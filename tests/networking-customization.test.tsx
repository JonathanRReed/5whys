import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useNetworkingPractice } from '../src/components/networking/useNetworkingPractice';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('uses the saved audience, setting, and goal in the active practice guidance', () => {
  const { result, unmount } = renderHook(() => useNetworkingPractice());
  act(() => result.current.handleFieldChange('who', 'A robotics engineer'));
  act(() => result.current.handleFieldChange('where', 'A campus meetup'));
  act(() => result.current.handleFieldChange('what', 'Ask about first-year work\nAsk how to prepare'));
  expect(result.current.currentScenario?.who).toBe('A robotics engineer');
  expect(result.current.currentScenario?.where).toBe('A campus meetup');
  expect(result.current.scenarioSteps).toEqual(['Ask about first-year work', 'Ask how to prepare']);
  expect(result.current.questionTemplates.some((item) => item.prompt.includes('Ask about first-year work'))).toBe(true);
  expect(result.current.rapportSamples.some((item) => item.includes('A robotics engineer'))).toBe(true);
  unmount();
  const restored = renderHook(() => useNetworkingPractice());
  expect(restored.result.current.currentScenario?.who).toBe('A robotics engineer');
  expect(restored.result.current.scenarioSteps).toEqual(['Ask about first-year work', 'Ask how to prepare']);
});

it('keeps preset guidance intact and falls back when custom fields are blank', () => {
  const { result } = renderHook(() => useNetworkingPractice());
  const preset = result.current.scenarios.find((item) => item.id === result.current.currentScenario?.id);
  expect(result.current.currentScenario).toEqual(preset);
  act(() => result.current.handleFieldChange('who', '  '));
  act(() => result.current.handleFieldChange('where', ''));
  act(() => result.current.handleFieldChange('what', '\n  '));
  expect(result.current.currentScenario?.who).toBe(preset?.who);
  expect(result.current.currentScenario?.where).toBe(preset?.where);
  expect(result.current.scenarioSteps).toEqual(preset?.what);
  expect(result.current.questionTemplates).toEqual(preset?.questionTemplates);
});

it('keeps custom guidance isolated between intro versions', () => {
  const { result } = renderHook(() => useNetworkingPractice());
  const originalId = result.current.currentVersionId;
  act(() => result.current.handleFieldChange('who', 'A research mentor'));
  act(() => result.current.createNewVersion());
  expect(result.current.currentScenario?.who).not.toBe('A research mentor');
  act(() => result.current.setCurrentVersionId(originalId));
  expect(result.current.currentScenario?.who).toBe('A research mentor');
});
