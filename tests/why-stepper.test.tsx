import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { computeSynthesis } from '../src/components/career-5whys/shared';
import WhyStepper from '../src/components/career-5whys/WhyStepper';

afterEach(cleanup);

it.each([
  [0, ['Current step', 'Pending', 'Pending', 'Pending', 'Pending']],
  [1, ['Completed', 'Current step', 'Pending', 'Pending', 'Pending']],
  [2, ['Completed', 'Completed', 'Current step', 'Pending', 'Pending']],
  [3, ['Completed', 'Completed', 'Completed', 'Current step', 'Pending']],
  [4, ['Completed', 'Completed', 'Completed', 'Completed', 'Current step']],
  [5, ['Completed', 'Completed', 'Completed', 'Completed', 'Completed']],
] as const)('exposes depth status after %i sequential answers', (sequentialCount, statuses) => {
  const responses = Array.from({ length: 5 }, (_, index) =>
    index < sequentialCount ? `Answer ${index + 1}` : ''
  );
  render(<WhyStepper responses={responses} sequentialCount={sequentialCount} />);

  expect(screen.getAllByRole('img')).toHaveLength(5);
  statuses.forEach((status, index) => {
    const indicator = screen.getByRole('img', { name: `Depth ${index + 1}: ${status}` });
    expect(indicator).toHaveTextContent(String(index + 1));
    expect(indicator).not.toHaveAttribute('tabindex');
    if (status === 'Current step') {
      expect(indicator).toHaveAttribute('aria-current', 'step');
    } else {
      expect(indicator).not.toHaveAttribute('aria-current');
    }
  });
});

it.each([
  { name: 'empty responses', responses: [], currentDepth: 1 },
  { name: 'whitespace-only first answer', responses: [' \t\n', 'Later answer'], currentDepth: 1 },
  {
    name: 'a gap before later answers',
    responses: ['First answer', '', 'Later answer'],
    currentDepth: 2,
  },
])('keeps later answers pending for $name', ({ responses, currentDepth }) => {
  const { sequentialCount } = computeSynthesis(responses, 'Teaching', 'career');
  render(<WhyStepper responses={responses} sequentialCount={sequentialCount} />);

  expect(screen.getByRole('img', { name: `Depth ${currentDepth}: Current step` })).toHaveAttribute(
    'aria-current',
    'step'
  );
  expect(screen.getByRole('img', { name: 'Depth 3: Pending' })).not.toHaveAttribute('aria-current');
  expect(screen.getAllByRole('img', { current: 'step' })).toHaveLength(1);
});

it('updates accessible progress when an earlier answer is cleared and then completed again', () => {
  const answers = Array(5).fill('A reason');
  const { rerender } = render(<WhyStepper responses={answers} sequentialCount={5} />);
  expect(screen.queryByRole('img', { current: 'step' })).not.toBeInTheDocument();

  const gappedAnswers = ['A reason', '', 'A reason', 'A reason', 'A reason'];
  rerender(
    <WhyStepper
      responses={gappedAnswers}
      sequentialCount={computeSynthesis(gappedAnswers, 'Teaching', 'career').sequentialCount}
    />
  );
  expect(screen.getByRole('img', { name: 'Depth 2: Current step' })).toHaveAttribute(
    'aria-current',
    'step'
  );
  expect(screen.getByRole('img', { name: 'Depth 5: Pending' })).toBeInTheDocument();

  rerender(<WhyStepper responses={answers} sequentialCount={5} />);
  expect(screen.getAllByRole('img', { name: /Completed$/ })).toHaveLength(5);
  expect(screen.queryByRole('img', { current: 'step' })).not.toBeInTheDocument();
});
