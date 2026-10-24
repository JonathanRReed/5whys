import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import WhyStepper from '../src/components/career-5whys/WhyStepper';

afterEach(cleanup);

it('renders descriptive aria-labels and aria-current state for depth tracker indicators', () => {
  render(<WhyStepper responses={['Answer 1', 'Answer 2', '']} sequentialCount={2} />);

  // Depth 1 and Depth 2 are filled (Completed)
  expect(screen.getByLabelText('Depth 1: Completed')).toBeInTheDocument();
  expect(screen.getByLabelText('Depth 2: Completed')).toBeInTheDocument();

  // Depth 3 is current step (sequentialCount = 2, so 0-indexed index 2 is current)
  const depth3 = screen.getByLabelText('Depth 3: Current step');
  expect(depth3).toBeInTheDocument();
  expect(depth3).toHaveAttribute('aria-current', 'step');

  // Depth 4 and Depth 5 are pending
  expect(screen.getByLabelText('Depth 4: Pending')).toBeInTheDocument();
  expect(screen.getByLabelText('Depth 5: Pending')).toBeInTheDocument();
});
