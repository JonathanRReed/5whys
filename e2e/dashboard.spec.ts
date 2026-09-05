import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

test('the dashboard turns saved work into next actions and links', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      'career-why-history',
      JSON.stringify([
        {
          id: 'snap_1',
          timestamp: now,
          whyStatement:
            'You started with "biology". What it is really about: understanding as help.',
          rootReason: 'Understanding as a form of help.',
          nextStep: 'Find one person who turned biology into work and ask which part survived.',
          track: 'interest',
          topic: 'biology',
          responses: ['a', 'b', 'c', 'd', 'e'],
          updatedAt: now,
          version: 3,
        },
      ])
    );
    window.localStorage.setItem(
      'networking-practice-sessions',
      JSON.stringify([
        {
          id: 's1',
          versionId: 'v1',
          scenarioId: 'career-fair',
          scenarioTitle: 'Career Fair: Long Line Behind You',
          attempts: [{ id: 'a1', label: 'Rep', script: 'Hi', durationSeconds: 60, createdAt: now }],
          ratings: { confidence: 2, clarity: 4, rapport: 4, authenticity: 4 },
          reflection: { humanNote: '', nervesNote: '', nextFocus: '', wins: '' },
          createdAt: now,
        },
      ])
    );
  });

  await page.goto('/dashboard/');
  await waitForHydration(page);

  await expect(
    page.getByRole('heading', { name: 'What the tools told you to do next' })
  ).toBeVisible();
  await expect(page.getByText(/Find one person who turned biology into work/)).toBeVisible();
  // The lowest networking rating was confidence, so the fix is the second-rep one.
  await expect(page.getByText(/Run the same scenario again right now/)).toBeVisible();
  await expect(page.getByText('Understanding as a form of help.')).toBeVisible();

  // Every recommendation is a link into a tool.
  const recommendation = page.getByRole('link', { name: /No resume scored yet/ });
  await expect(recommendation).toHaveAttribute('href', '/resume-game/');
});
