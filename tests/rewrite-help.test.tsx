import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import RewriteHelp from '../src/components/resume-game/RewriteHelp';
import { AiText, sourceLabel } from '../src/components/shared/AiText';

it('offers a rules rewrite on request and says where it came from', async () => {
  render(<RewriteHelp line="Responsible for managing the club budget" />);
  expect(screen.queryByTestId('rewrite-text')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Suggest a rewrite' }));
  const text = await screen.findByTestId('rewrite-text');
  expect(text.textContent).toMatch(/^Managed/);
  expect(screen.getByText('From the built-in rules')).toBeInTheDocument();
});

it('never shows a number the student did not write', async () => {
  render(<RewriteHelp line="Responsible for managing the club budget" />);
  fireEvent.click(screen.getByRole('button', { name: 'Suggest a rewrite' }));
  const text = await screen.findByTestId('rewrite-text');
  expect(text.textContent).not.toMatch(/\d/);
});

it('strikes claims that were not in the original', () => {
  const { container } = render(
    <AiText
      text="Managed a 5000 dollar budget"
      claims={[{ kind: 'number', text: '5000', start: 10, end: 14 }]}
    />
  );
  expect(container.querySelector('del')?.textContent).toBe('5000');
  expect(container.textContent).toBe('Managed a 5000 dollar budget');
});

it('labels each source in plain words', () => {
  expect(sourceLabel('rules')).toBe('From the built-in rules');
  expect(sourceLabel('browser-model')).toContain('on this device');
  expect(sourceLabel('hosted-model')).toContain('on this device');
});
