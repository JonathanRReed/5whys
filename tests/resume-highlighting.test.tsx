import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';
import { highlightResume } from '../src/lib/resume-game';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

async function visualizationFor(text: string) {
  render(<ResumeGame />);
  fireEvent.change(screen.getByLabelText('Paste resume text'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze resume' }));
  const heading = await screen.findByRole('heading', { name: 'Analysis visualization' });
  const card = heading.closest('[data-slot="card"]');
  if (!card) throw new Error('Analysis card was not rendered');
  return card;
}

it('preserves apostrophes without highlighting HTML entity digits as achievements', async () => {
  const text = "Led O'Reilly training for 5 people";
  const card = await visualizationFor(text);
  expect(card).toHaveTextContent(text);
  expect(
    Array.from(card.querySelectorAll('mark'))
      .slice(2)
      .map((mark) => mark.textContent)
  ).toEqual(['Led', '5']);
});

it('renders HTML-shaped input as literal text while retaining highlights and line breaks', async () => {
  const card = await visualizationFor('<img src=x onerror=alert(1)>\nBuilt 3 tools.');
  expect(card).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(card.querySelector('img, script')).toBeNull();
  expect(card.querySelectorAll('br')).toHaveLength(1);
  expect(
    Array.from(card.querySelectorAll('mark'))
      .slice(2)
      .map((mark) => mark.textContent)
  ).toEqual(['1', 'Built', '3']);
});

it('keeps the legacy HTML formatter consistent with literal text highlighting', () => {
  const text = "Led O'Reilly training for 5 people";
  const preview = document.createElement('div');
  preview.innerHTML = highlightResume(text);
  expect(preview.textContent).toBe(text);
  expect(Array.from(preview.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
    'Led',
    '5',
  ]);
});
