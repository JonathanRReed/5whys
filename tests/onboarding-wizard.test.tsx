import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OnboardingWizard from '../src/components/OnboardingWizard';
import { writeProfile } from '../src/lib/profile';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it('manages focus and updates screen reader status when navigating wizard steps', () => {
  render(<OnboardingWizard />);

  // Step 1 initial state
  const step1Heading = screen.getByRole('heading', {
    name: 'Where are you in your career?',
  });
  expect(step1Heading).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();

  // Select "Student" to advance to Step 2
  fireEvent.click(screen.getByRole('button', { name: 'Student' }));

  const step2Heading = screen.getByRole('heading', {
    name: 'What is your biggest challenge right now?',
  });
  expect(step2Heading).toBeInTheDocument();
  expect(step2Heading).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Step 2 of 2.');

  // Select "Unclear direction" to reach recommendation
  fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }));

  const resultHeading = screen.getByRole('heading', {
    name: 'Here is your starting point',
  });
  expect(resultHeading).toBeInTheDocument();
  expect(resultHeading).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Career review complete.');
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

it.each([false, true])('does not steal initial focus with StrictMode=%s', (strict) => {
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  render(
    strict ? (
      <StrictMode>
        <OnboardingWizard />
      </StrictMode>
    ) : (
      <OnboardingWizard />
    )
  );
  expect(outside).toHaveFocus();
  expect(focus).not.toHaveBeenCalled();
});

it.each([false, true])(
  'restores saved answers without stealing focus with StrictMode=%s',
  (strict) => {
    writeProfile('student', 'direction');
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(
      strict ? (
        <StrictMode>
          <OnboardingWizard />
        </StrictMode>
      ) : (
        <OnboardingWizard />
      )
    );
    expect(
      screen.getByRole('heading', { name: 'Welcome back. Your starting point' })
    ).toBeInTheDocument();
    expect(outside).toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
  }
);

it('hydrates empty server markup before restoring the profile without moving focus', () => {
  const html = renderToString(<OnboardingWizard />);
  expect(html).toContain('Where are you in your career?');
  expect(html).not.toContain('Welcome back');
  writeProfile('student', 'direction');
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const errors = vi.spyOn(console, 'error');
  render(<OnboardingWizard />, { container, hydrate: true });
  expect(
    screen.getByRole('heading', { name: 'Welcome back. Your starting point' })
  ).toBeInTheDocument();
  expect(outside).toHaveFocus();
  expect(errors).not.toHaveBeenCalled();
});

it.each([false, true])(
  'keeps one live region and focuses user navigation with StrictMode=%s',
  (strict) => {
    render(
      strict ? (
        <StrictMode>
          <OnboardingWizard />
        </StrictMode>
      ) : (
        <OnboardingWizard />
      )
    );
    const status = screen.getByRole('status');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    fireEvent.click(screen.getByRole('button', { name: 'Student' }));
    expect(
      screen.getByRole('heading', { name: 'What is your biggest challenge right now?' })
    ).toHaveFocus();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBe(status);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Where are you in your career?' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Student' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }));
    expect(screen.getByRole('heading', { name: 'Here is your starting point' })).toHaveFocus();
    expect(screen.getByRole('status')).toBe(status);
    fireEvent.click(screen.getByRole('button', { name: 'Change the last answer' }));
    expect(
      screen.getByRole('heading', { name: 'What is your biggest challenge right now?' })
    ).toHaveFocus();
    expect(screen.getByRole('status')).toBe(status);
    fireEvent.click(screen.getByRole('button', { name: 'Unclear direction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('heading', { name: 'Where are you in your career?' })).toHaveFocus();
    expect(screen.getByRole('status')).toBe(status);
  }
);
