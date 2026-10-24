import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Navigation from '../src/components/Navigation';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
});

it.each([undefined, -1, 0])(
  'keeps focus on main after scroll-to-top disappears, preserving tabindex %s',
  (tabIndex) => {
    render(
      <>
        <Navigation currentPath="/" />
        <main id="main-content" tabIndex={tabIndex}>
          Main content
        </main>
      </>
    );
    const main = screen.getByRole('main');
    const focus = vi.spyOn(main, 'focus');
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      fireEvent.scroll(window);
    });
    expect(main).not.toHaveFocus();
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    fireEvent.scroll(window);
    const trigger = screen.getByRole('button', { name: 'Scroll to top' });
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);

    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'smooth' });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', String(tabIndex ?? -1));
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  }
);

it('still scrolls when no main landmark is present', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<Navigation currentPath="/" />);
  Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
  fireEvent.scroll(window);
  fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'smooth' });
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

it('returns focus to the compact trigger after Escape from a menu link', () => {
  const { container } = render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  fireEvent.click(trigger);
  const link = container.querySelector<HTMLAnchorElement>('#compact-tools-menu a');
  if (!link) throw new Error('Expected an open compact menu link');
  link.focus();
  expect(link).toHaveFocus();
  fireEvent.keyDown(link, { key: 'Escape' });
  expect(trigger).toHaveFocus();
});

it('returns focus to the mobile trigger after Escape from the panel', () => {
  render(<Navigation currentPath="/" />);
  const trigger = screen.getByRole('button', { name: 'Toggle navigation' });
  fireEvent.click(trigger);
  const close = screen.getByRole('button', { name: 'Close navigation' });
  close.focus();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(trigger).toHaveFocus();
});

it('hides mobile nav panel with aria-hidden and inert when collapsed', () => {
  const { container } = render(<Navigation currentPath="/" />);
  const navPanel = container.querySelector('#primary-navigation');
  expect(navPanel).not.toBeNull();
  expect(navPanel).toHaveAttribute('aria-hidden', 'true');
  expect(navPanel).toHaveAttribute('inert');

  const mobileToggle = screen.getByRole('button', { name: 'Toggle navigation' });
  fireEvent.click(mobileToggle);

  expect(navPanel).toHaveAttribute('aria-hidden', 'false');
  expect(navPanel).not.toHaveAttribute('inert');
});
