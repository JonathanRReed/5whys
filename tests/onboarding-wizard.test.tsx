import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import OnboardingWizard from '../src/components/OnboardingWizard';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

it('manages focus and updates screen reader status when navigating wizard steps', () => {
  render(<OnboardingWizard />);

  // Step 1 initial state
  const step1Heading = screen.getByRole('heading', {
    name: 'Where are you in your career?',
  });
  expect(step1Heading).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Step 1 of 2: Where are you in your career?'
  );

  // Select "Student" to advance to Step 2
  fireEvent.click(screen.getByRole('button', { name: 'Student' }));

  const step2Heading = screen.getByRole('heading', {
    name: 'What is your biggest challenge right now?',
  });
  expect(step2Heading).toBeInTheDocument();
  expect(step2Heading).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Step 2 of 2: What is your biggest challenge right now?'
  );

  // Select "Unclear direction" to reach recommendation
  fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }));

  const resultHeading = screen.getByRole('heading', {
    name: 'Here is your starting point',
  });
  expect(resultHeading).toBeInTheDocument();
  expect(resultHeading).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Career review result: Start with the 5 Whys Interest Path'
  );
});

it('moves focus back to Step 2 when clicking Change the last answer', () => {
  render(<OnboardingWizard />);

  // Complete step 1 & 2
  fireEvent.click(screen.getByRole('button', { name: 'Student' }));
  fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }));

  expect(screen.getByRole('heading', { name: 'Here is your starting point' })).toBeInTheDocument();

  // Click "Change the last answer"
  fireEvent.click(screen.getByRole('button', { name: 'Change the last answer' }));

  const step2Heading = screen.getByRole('heading', {
    name: 'What is your biggest challenge right now?',
  });
  expect(step2Heading).toBeInTheDocument();
  expect(step2Heading).toHaveFocus();
});
