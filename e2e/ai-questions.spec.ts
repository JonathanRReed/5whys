import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('the likely-questions prompt is built locally and the answer saves', async ({ page }) => {
  await page.addInitScript(() => {
    // Seed once: the init script runs on reload too, and the reload below is
    // the round-trip that proves the paste-back actually persisted.
    if (window.localStorage.getItem('interview-glow-up-data')) return;
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'r1',
            jobTitle: 'STEP Intern',
            company: 'Google',
            rawJdText: 'Intern role',
            bullets: [
              {
                id: 'b1',
                text: 'Write SQL queries',
                status: 'active',
                primarySkillId: null,
                secondarySkillIds: [],
                suggestion: [],
              },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        stories: [],
        packets: [
          {
            id: 'p1',
            roleId: 'r1',
            mode: 'prep',
            topStoryIds: [],
            customQuestions: [],
            notes: '',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        currentRoleId: 'r1',
        currentPacketId: 'p1',
      })
    );
  });

  await page.goto('/interview-glow-up/workspace/?tab=packet');
  await waitForHydration(page);

  await page.getByRole('button', { name: 'Copy the prompt' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

  // The prompt is composed from the decoded posting, on the device.
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('STEP Intern');
  expect(prompt).toContain('Google');
  expect(prompt).toContain('Write SQL queries');

  // The paste-back persists under its "from your AI" label.
  await page.getByLabel('The answer it gave you').fill('1. Tell me about a time you used SQL.');
  await page.waitForTimeout(400);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByLabel('The answer it gave you')).toHaveValue(
    '1. Tell me about a time you used SQL.'
  );
  await expect(page.getByText('From your AI')).toBeVisible();
});
