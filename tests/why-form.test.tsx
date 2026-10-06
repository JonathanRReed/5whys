import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import WhyForm from '../src/components/career-5whys/WhyForm';

afterEach(() => {
  cleanup();
});

const mockExample = {
  persona: 'Alex, CS Student',
  topic: 'Software Engineering',
  answers: ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Answer 5'],
};

it('displays "Show a worked example" when collapsed and "Hide worked example" when expanded', () => {
  const onToggleExample = vi.fn();
  const onResponseChange = vi.fn();

  const { rerender } = render(
    <WhyForm
      responses={['', '', '', '', '']}
      sequentialCount={0}
      prompts={['Prompt 1', 'Prompt 2', 'Prompt 3', 'Prompt 4', 'Prompt 5']}
      example={mockExample}
      exampleOpen={{ 0: false }}
      onResponseChange={onResponseChange}
      onToggleExample={onToggleExample}
    />
  );

  const button = screen.getAllByRole('button', { name: /worked example/i })[0];
  expect(button).toHaveTextContent('Show a worked example');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveAttribute('aria-controls', 'example-depth-0');

  fireEvent.click(button);
  expect(onToggleExample).toHaveBeenCalledWith(0);

  // Rerender with exampleOpen[0] = true
  rerender(
    <WhyForm
      responses={['', '', '', '', '']}
      sequentialCount={0}
      prompts={['Prompt 1', 'Prompt 2', 'Prompt 3', 'Prompt 4', 'Prompt 5']}
      example={mockExample}
      exampleOpen={{ 0: true }}
      onResponseChange={onResponseChange}
      onToggleExample={onToggleExample}
    />
  );

  const expandedButton = screen.getAllByRole('button', { name: /worked example/i })[0];
  expect(expandedButton).toHaveTextContent('Hide worked example');
  expect(expandedButton).toHaveAttribute('aria-expanded', 'true');
  expect(expandedButton).toHaveAttribute('aria-controls', 'example-depth-0');
});
