import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConversationIngredients from '../src/components/networking/ConversationIngredients';
import QuestionPrompts from '../src/components/networking/QuestionPrompts';
import RapportWarmups from '../src/components/networking/RapportWarmups';
import { useNetworkingPractice } from '../src/components/networking/useNetworkingPractice';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('uses the saved audience, setting, and goal in the active practice guidance', () => {
  const { result, unmount } = renderHook(() => useNetworkingPractice());
  act(() => result.current.handleFieldChange('who', 'A robotics engineer'));
  act(() => result.current.handleFieldChange('where', 'A campus meetup'));
  act(() =>
    result.current.handleFieldChange('what', 'Ask about first-year work\nAsk how to prepare')
  );
  expect(result.current.currentScenario?.who).toBe('A robotics engineer');
  expect(result.current.currentScenario?.where).toBe('A campus meetup');
  expect(result.current.scenarioSteps).toEqual(['Ask about first-year work', 'Ask how to prepare']);
  expect(
    result.current.questionTemplates.some((item) =>
      item.prompt.includes('Ask about first-year work')
    )
  ).toBe(true);
  expect(result.current.rapportSamples.some((item) => item.includes('A robotics engineer'))).toBe(
    true
  );
  unmount();
  const restored = renderHook(() => useNetworkingPractice());
  expect(restored.result.current.currentScenario?.who).toBe('A robotics engineer');
  expect(restored.result.current.scenarioSteps).toEqual([
    'Ask about first-year work',
    'Ask how to prepare',
  ]);
});

it('keeps preset guidance intact and falls back when custom fields are blank', () => {
  const { result } = renderHook(() => useNetworkingPractice());
  const preset = result.current.scenarios.find(
    (item) => item.id === result.current.currentScenario?.id
  );
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

it('renders descriptive aria-labels for copy buttons in helper components', () => {
  const dummyScenario = {
    id: 'test-scenario',
    title: 'Test Title',
    mode: 'fictional',
    audience: 'student',
    focus: 'Focus',
    who: 'Recruiter',
    where: 'Career Fair',
    what: ['Step 1'],
    ingredients: [{ id: 'ing-1', label: 'Opener', line: 'Hi there' }],
    rapportSamples: ['Warmup 1'],
    questionTemplates: [{ id: 'qt-1', label: 'Goal', prompt: 'What roles are open?' }],
  };

  const onCopy = vi.fn();

  const { rerender } = render(
    <ConversationIngredients currentScenario={dummyScenario} onCopy={onCopy} copiedKey={null} />
  );
  expect(screen.getByRole('button', { name: 'Copy Opener line' })).toBeInTheDocument();

  rerender(
    <ConversationIngredients
      currentScenario={dummyScenario}
      onCopy={onCopy}
      copiedKey="ingredient-ing-1-test-scenario"
    />
  );
  expect(screen.getByRole('button', { name: 'Copied Opener line' })).toBeInTheDocument();

  rerender(
    <RapportWarmups
      rapportSamples={['Warmup 1']}
      scenarioId="test-scenario"
      onCopy={onCopy}
      copiedKey={null}
    />
  );
  expect(screen.getByRole('button', { name: 'Copy warm-up line 1' })).toBeInTheDocument();

  rerender(
    <RapportWarmups
      rapportSamples={['Warmup 1']}
      scenarioId="test-scenario"
      onCopy={onCopy}
      copiedKey="rapport-test-scenario-0"
    />
  );
  expect(screen.getByRole('button', { name: 'Copied warm-up line 1' })).toBeInTheDocument();

  rerender(
    <QuestionPrompts
      questionTemplates={[{ id: 'qt-1', label: 'Goal', prompt: 'What roles are open?' }]}
      scenarioId="test-scenario"
      onCopy={onCopy}
      copiedKey={null}
    />
  );
  expect(screen.getByRole('button', { name: 'Copy Goal question prompt' })).toBeInTheDocument();

  rerender(
    <QuestionPrompts
      questionTemplates={[{ id: 'qt-1', label: 'Goal', prompt: 'What roles are open?' }]}
      scenarioId="test-scenario"
      onCopy={onCopy}
      copiedKey="question-qt-1-test-scenario"
    />
  );
  expect(screen.getByRole('button', { name: 'Copied Goal question prompt' })).toBeInTheDocument();
});
