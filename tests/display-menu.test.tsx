import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import DisplayMenu from '../src/components/DisplayMenu';
import { TYPEFACE_STORAGE_KEY } from '../src/lib/typeface';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.font;
  delete document.documentElement.dataset.theme;
});

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Aa, display settings' }));

it('opens a panel with theme and typeface choices', () => {
  render(<DisplayMenu />);
  expect(screen.queryByRole('dialog')).toBeNull();
  openMenu();
  expect(screen.getByRole('dialog', { name: 'Display' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Night' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Dawn' })).toBeInTheDocument();
  for (const name of ['Default', 'Readable sans', 'OpenDyslexic']) {
    expect(screen.getByRole('radio', { name })).toBeInTheDocument();
  }
});

it('applies and remembers a typeface, and clears the attribute for the default', () => {
  render(<DisplayMenu />);
  openMenu();
  fireEvent.click(screen.getByRole('radio', { name: 'OpenDyslexic' }));
  expect(document.documentElement.dataset.font).toBe('dyslexic');
  expect(window.localStorage.getItem(TYPEFACE_STORAGE_KEY)).toBe('dyslexic');

  fireEvent.click(screen.getByRole('radio', { name: 'Default' }));
  expect(document.documentElement.dataset.font).toBeUndefined();
  expect(window.localStorage.getItem(TYPEFACE_STORAGE_KEY)).toBe('default');
});

it('picks up the typeface the boot script already applied', () => {
  document.documentElement.dataset.font = 'readable';
  render(<DisplayMenu />);
  openMenu();
  expect(screen.getByRole('radio', { name: 'Readable sans' })).toBeChecked();
});

it('applies and remembers a theme', () => {
  render(<DisplayMenu />);
  openMenu();
  fireEvent.click(screen.getByRole('radio', { name: 'Dawn' }));
  expect(document.documentElement.dataset.theme).toBe('dawn');
  expect(window.localStorage.getItem('career-tools-theme')).toBe('dawn');
});

it('closes on Escape and returns focus to the button', () => {
  render(<DisplayMenu />);
  const button = screen.getByRole('button', { name: 'Aa, display settings' });
  openMenu();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(button).toHaveFocus();
});
