import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

// Local date math, matching how the store parses 'YYYY-MM-DD'.
const isoDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test('a deadline on the empty dashboard starts the studio', async ({ page }) => {
  await page.goto('/dashboard/');
  await waitForHydration(page);

  await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();

  await page.getByLabel('Role').fill('Marketing Intern');
  await page.getByLabel('Company').fill('City Parks Department');
  await page.getByLabel('Deadline').fill(isoDaysFromNow(10));
  await page.getByRole('button', { name: 'Track this application' }).click();

  await expect(page.getByRole('heading', { name: 'One application in motion' })).toBeVisible();

  const row = page.locator('li').filter({ hasText: 'Marketing Intern' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Due in 10 days')).toBeVisible();
  await expect(row.getByText('No decoded posting')).toBeVisible();
  // The posting is pasted on this application's own desk, not in whichever
  // interview role happens to be current.
  await expect(row.getByRole('link', { name: 'Paste the posting on the desk' })).toHaveAttribute(
    'href',
    /\/application\/\?id=.+&station=posting/
  );

  // The deadline-aware recommendation names the same application.
  await expect(
    page.getByText(/"Marketing Intern at City Parks Department" has no decoded posting/)
  ).toBeVisible();
});

test('a decoded role can be tracked from the Glow Up workspace', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'interview-glow-up-data',
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'r1',
            jobTitle: 'Product Analyst',
            company: 'Acme',
            rawJdText: 'Analyst role',
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
        packets: [],
        currentRoleId: 'r1',
        currentPacketId: null,
      })
    );
  });

  await page.goto('/interview-glow-up/workspace/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Track this application' }).click();

  const tracked = page.getByRole('link', { name: 'Tracked on your dashboard' });
  await expect(tracked).toBeVisible();
  await tracked.click();
  await waitForHydration(page);

  // The linked role's live title and decode state show through.
  const row = page.locator('li').filter({ hasText: 'Product Analyst' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Posting decoded')).toBeVisible();
  await expect(row.getByText('No interview stories packed')).toBeVisible();
});
