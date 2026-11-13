import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../src/lib/glossary';

describe('plain-word explanations', () => {
  it('keeps every meaning to one or two short sentences in the house voice', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.means.split(/\s+/).length, key).toBeLessThanOrEqual(24);
      expect(`${entry.term} ${entry.means}`, key).not.toMatch(/—|!/);
    }
  });
});

describe('words on this page', () => {
  it('shows one meaning at a time under the row', async () => {
    const { default: WordHelp } = await import('../src/components/shared/WordHelp');
    render(<WordHelp words={['basePay', 'variablePay']} />);
    const base = screen.getByRole('button', { name: /base pay/ });
    const variable = screen.getByRole('button', { name: /variable pay/ });
    expect(screen.getByRole('note', { hidden: true })).not.toBeVisible();
    fireEvent.click(base);
    expect(screen.getByRole('note')).toHaveTextContent('before any bonus');
    fireEvent.click(variable);
    expect(base).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('note')).toHaveTextContent('not promised');
    fireEvent.click(variable);
    expect(screen.getByRole('note', { hidden: true })).not.toBeVisible();
  });
});
