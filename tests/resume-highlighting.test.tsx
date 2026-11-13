import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import ResumeGame from '../src/components/ResumeGame';
import {
  detectResumeStructure,
  findNumbers,
  highlightResume,
  parseHighlightedResume,
  STUDENT_SAMPLE_RESUME,
} from '../src/lib/resume-game';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

async function visualizationFor(text: string) {
  render(<ResumeGame />);
  fireEvent.change(screen.getByLabelText('Paste resume text'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze resume' }));
  const heading = await screen.findByRole('heading', { name: 'Your text, marked' });
  const card = heading.closest('[data-slot="card"]');
  if (!card) throw new Error('Analysis card was not rendered');
  return card;
}

/** What a sighted reader sees: the text without the visually hidden labels. */
function visibleText(element: Element) {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('.sr-only')) hidden.remove();
  return copy;
}

/** Each highlight's own words, without its hidden category label. */
const markedWords = (card: Element) =>
  Array.from(visibleText(card).querySelectorAll('mark')).map((mark) => mark.textContent);

it('preserves apostrophes without highlighting HTML entity digits as achievements', async () => {
  const text = "Led O'Reilly training for 5 people";
  const card = await visualizationFor(text);
  expect(visibleText(card)).toHaveTextContent(text);
  expect(markedWords(card)).toEqual(['Led', '5']);
  // The category is in the text too, not only in the color.
  expect(Array.from(card.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
    'Action verb: Led',
    'Number: 5',
  ]);
});

it('renders HTML-shaped input as literal text while retaining highlights and line breaks', async () => {
  const card = await visualizationFor('<img src=x onerror=alert(1)>\nBuilt 3 tools.');
  expect(visibleText(card)).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(card.querySelector('img, script')).toBeNull();
  expect(card.querySelectorAll('br')).toHaveLength(1);
  // The markup line is not an achievement line, so nothing in it is marked.
  expect(markedWords(card)).toEqual(['Built', '3']);
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

it('marks only achievement lines in the sample, never contact details, dates, or GPA', async () => {
  const card = await visualizationFor(STUDENT_SAMPLE_RESUME);
  const marks = Array.from(card.querySelectorAll('mark'));
  const marked = marks.map((mark) => mark.textContent ?? '');
  // The phone number, the graduation year, the GPA, and both date ranges stay plain.
  for (const plain of ['555', '201', '4477', '2027', '3.6', '2025', '2024']) {
    expect(marked.some((text) => text.includes(plain))).toBe(false);
  }
  // A screen reader hears the phone number as written, not "Number:" inside it.
  expect(card).toHaveTextContent('(555) 201-4477');
  expect(card).not.toHaveTextContent(/Number:\s*(555|201|4477|2027|3\.6|2025|2024)/);
});

it('marks a number only where the scorer counts one', () => {
  const lines = [
    'Coordinated 12 volunteers for the 2025 food drive, raising $1,200',
    'Kept a 3.8 GPA while working 20 hours a week',
    'Answered calls for 3 departments from 2023 - 2025',
    'Ranked 2nd of 40 students in the design competition',
  ];
  const text = lines.join('\n');
  expect(detectResumeStructure(text).achievementLines).toEqual([0, 1, 2, 3]);
  const tokens = parseHighlightedResume(text);
  const marked = tokens.filter((token) => token.type === 'number').map((token) => token.text);
  expect(marked).toEqual(['12', '$1,200', '20', '3', '40']);
  // The specimen and the score agree: every marked number is one the scorer found.
  const scored = lines.flatMap((line) => findNumbers(line)).map((found) => found.text);
  expect(scored).toHaveLength(marked.length);
});
