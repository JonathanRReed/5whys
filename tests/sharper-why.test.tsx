import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SharperWhy from '../src/components/career-5whys/SharperWhy';

afterEach(() => vi.unstubAllGlobals());

function installModel(reply: string) {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('LanguageModel', {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => reply,
      promptStreaming: () =>
        (async function* () {
          yield reply;
        })(),
      destroy: () => undefined,
    }),
  });
}

const props = {
  track: 'career' as const,
  topic: 'Product manager',
  answers: ['I want to work on things people use every day.'],
};

it('shows a question written by the browser model, labelled as such', async () => {
  installModel('What about everyday use matters most to you?');
  render(<SharperWhy {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask me a sharper why' }));
  expect(await screen.findByText('What about everyday use matters most to you?')).toBeVisible();
  expect(screen.getByText(/Written on this device/)).toBeVisible();
});

it('does not repeat the standard prompt when no model answers', async () => {
  render(<SharperWhy {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask me a sharper why' }));
  expect(
    await screen.findByText('No sharper question this time. The prompt above still applies.')
  ).toBeVisible();
});
