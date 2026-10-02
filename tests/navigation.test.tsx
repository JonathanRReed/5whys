import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import Navigation from '../src/components/Navigation';

afterEach(() => {
  cleanup();
});

it('links compact tools trigger button to its dropdown container via aria-controls', () => {
  render(<Navigation currentPath="/" />);
  const [compactToolsBtn] = screen.getAllByRole('button', { name: /tools/i });
  expect(compactToolsBtn).toHaveAttribute('aria-controls', 'compact-tools-menu');
});

it('closes open compact tools menu when Escape key is pressed', () => {
  render(<Navigation currentPath="/" />);
  const [compactToolsBtn] = screen.getAllByRole('button', { name: /tools/i });

  // Open compact tools menu
  fireEvent.click(compactToolsBtn);
  expect(compactToolsBtn).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('link', { name: 'Resume Game' }).length).toBeGreaterThan(1);

  // Press Escape
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(compactToolsBtn).toHaveAttribute('aria-expanded', 'false');
});

it('closes mobile menu when Escape key is pressed', () => {
  render(<Navigation currentPath="/" />);
  const mobileToggle = screen.getByRole('button', { name: 'Toggle navigation' });

  // Open mobile navigation
  fireEvent.click(mobileToggle);
  expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');

  // Press Escape
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(mobileToggle).toHaveAttribute('aria-expanded', 'false');
});

it('includes title attribute on scroll to top button when visible', () => {
  render(<Navigation currentPath="/" />);

  // Simulate scroll
  Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
  fireEvent.scroll(window);

  const scrollTopBtn = screen.getByRole('button', { name: 'Scroll to top' });
  expect(scrollTopBtn).toHaveAttribute('title', 'Scroll to top');
});
