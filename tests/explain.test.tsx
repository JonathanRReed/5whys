import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Explain from '../src/components/shared/Explain';
import { GLOSSARY } from '../src/lib/glossary';

describe('plain-word explanations', () => {
  it('keeps every meaning to one or two short sentences in the house voice', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.means.split(/\s+/).length, key).toBeLessThanOrEqual(24);
      expect(`${entry.term} ${entry.means}`, key).not.toMatch(/—|!/);
    }
  });

  it('shows the meaning in place when asked, and hides it again', () => {
    render(
      <p>
        Paste the posting
        <Explain word="posting" />
      </p>
    );
    const button = screen.getByRole('button', { name: 'What does "job posting" mean?' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('note', { hidden: true })).not.toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent('The job ad');
    fireEvent.click(button);
    expect(screen.getByRole('note', { hidden: true })).not.toBeVisible();
  });
});
