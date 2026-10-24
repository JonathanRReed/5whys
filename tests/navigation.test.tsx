import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Navigation from '../src/components/Navigation';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
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

it('dismisses compact tools on an outside pointer press without moving focus', () => {
  const { container } = render(
    <>
      <Navigation currentPath="/" />
      <main tabIndex={-1}>Main content</main>
    </>
  );
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  const main = screen.getByRole('main');
  main.focus();
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  fireEvent.pointerDown(main);

  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(container.querySelector('#compact-tools-menu')).not.toBeInTheDocument();
  expect(main).toHaveFocus();
});

it('dismisses compact tools when focus moves backward to its neighboring Dashboard link', () => {
  render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  const compactNav = trigger.parentElement;
  if (!compactNav) throw new Error('Expected compact navigation');
  const dashboard = within(compactNav).getByRole('link', { name: 'Dashboard' });
  trigger.focus();
  fireEvent.click(trigger);

  // The browser moves focus here on Shift+Tab from Tools.
  act(() => dashboard.focus());

  expect(dashboard).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('dismisses compact tools when focus leaves the last link for the theme toggle', () => {
  const { container } = render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  const themeToggle = screen.getByRole('button', { name: /switch to .* theme/i });
  fireEvent.click(trigger);
  const menu = container.querySelector('#compact-tools-menu');
  if (!menu) throw new Error('Expected compact tools menu');
  const lastLink = within(menu as HTMLElement).getByRole('link', { name: 'Interview' });
  act(() => lastLink.focus());
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // The browser moves focus here on Tab from the final tool link.
  act(() => themeToggle.focus());

  expect(themeToggle).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('keeps compact tools open while focus moves between the trigger and its links', () => {
  const { container } = render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  trigger.focus();
  fireEvent.click(trigger);
  const menu = container.querySelector('#compact-tools-menu');
  if (!menu) throw new Error('Expected compact tools menu');
  const links = within(menu as HTMLElement).getAllByRole('link');

  for (const target of [...links, trigger]) {
    act(() => target.focus());
    expect(target).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  }
});

it('keeps internal pointer presses open and allows each tool link to activate', () => {
  const { container } = render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  const destinations = [
    ['Career 5 Whys', '/career/'],
    ['Resume Game', '/resume-game/'],
    ['Networking', '/networking-practice/'],
    ['Interview', '/interview-glow-up/'],
  ];

  for (const [name, href] of destinations) {
    fireEvent.click(trigger);
    const menu = container.querySelector('#compact-tools-menu');
    if (!menu) throw new Error('Expected compact tools menu');
    const link = within(menu as HTMLElement).getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    fireEvent.pointerDown(link);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Observe the uncancelled activation before preventing jsdom navigation.
    let activationWasCancelled: boolean | undefined;
    const preventNavigation = (event: MouseEvent) => {
      activationWasCancelled = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', preventNavigation, { once: true });
    fireEvent.click(link);

    expect(activationWasCancelled).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('#compact-tools-menu')).not.toBeInTheDocument();
  }
});

it('handles repeated trigger toggles and outside dismissal without reopening', () => {
  render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  const icon = trigger.querySelector('svg');
  if (!icon) throw new Error('Expected tools trigger icon');

  for (let cycle = 0; cycle < 3; cycle += 1) {
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(icon);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(icon);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }
});

it.each([767, 1280])('dismisses compact tools outside the tablet range at %s px', (width) => {
  render(<Navigation currentPath="/" />);
  const trigger = screen.getAllByRole('button', { name: /tools/i })[0];
  fireEvent.click(trigger);
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  fireEvent.resize(window);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  fireEvent.resize(window);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  fireEvent.resize(window);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
});
