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
  // The lowest networking rating was confidence, so the next step is a concrete pause-and-compare exercise.
  await expect(
    page.getByText(/Try another rep with one change: pause before your opening line/)
  ).toBeVisible();
  await expect(page.getByText('Understanding as a form of help.')).toBeVisible();

  // Every recommendation is a link into a tool.
  const recommendation = page.getByRole('link', { name: /No resume scored yet/ });
  await expect(recommendation).toHaveAttribute('href', '/resume-game/');
});

test('the dashboard says so when the whole loop is closed', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    window.localStorage.setItem(
      'career-why-history',
      JSON.stringify([
        {
          id: 'snap_1',
          timestamp: now,
          rootReason: 'Understanding as a form of help.',
          nextStep: 'Ask one person which part survived.',
          track: 'interest',
          topic: 'biology',
          responses: ['a', 'b', 'c', 'd', 'e'],
          updatedAt: now,
          version: 3,
        },
      ])
    );
    window.localStorage.setItem(
      'resume-game-session-v2',
      JSON.stringify({
        bullets: [
          {
            id: 'b1',
            original: 'Helped run a fundraiser',
            improved: 'Raised $400 for the club by booking two campus sponsors',
            baselineScore: 40,
            improvedScore: 72,
          },
        ],
        lastAnalyzedAt: now,
      })
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
          ratings: { confidence: 4, clarity: 4, rapport: 4, authenticity: 4 },
          reflection: { humanNote: '', nervesNote: '', nextFocus: '', wins: '' },
          createdAt: now,
        },
      ])
    );
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [{ id: 'r1', jobTitle: 'STEP Intern', company: 'Google' }],
        stories: [{ id: 'st1', primarySkillId: 'problem-solving' }],
        packets: [{ id: 'p1', roleId: 'r1', mode: 'prep', topStoryIds: ['st1'] }],
        currentRoleId: 'r1',
        currentPacketId: 'p1',
      })
    );
    window.localStorage.setItem(
      'career-applications',
      JSON.stringify({
        version: 1,
        applications: [
          {
            id: 'app1',
            title: 'STEP Intern',
            company: 'Google',
            deadline,
            roleId: 'r1',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activeId: 'app1',
      })
    );
  });

  await page.goto('/dashboard/');
  await waitForHydration(page);

  await expect(
    page.getByText(/You have done the whole loop: reflection, resume, reps, and a packed packet/)
  ).toBeVisible();
  // The line names the in-focus deadline when there is one.
  await expect(page.getByText(/STEP Intern is due in 4 days/)).toBeVisible();
});
