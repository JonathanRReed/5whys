import { expect, type Page, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

const ANSWERS = [
  'I like the shadow days on the hospital floor the most.',
  'Someone got calmer because a nurse explained what was happening.',
  'My brother was in the hospital and the nurse helped my mom.',
  'I want to make a scary place less confusing for a family.',
  'I need work where helping someone understand is the job itself.',
];

async function fillChain(page: Page, topic: string) {
  await page.locator('#career-topic').fill(topic);
  for (let i = 0; i < ANSWERS.length; i += 1) {
    await page.getByLabel(`Depth ${i + 1} response`).fill(ANSWERS[i]);
  }
}

/** Never open a real print dialog; PrintSheet still mounts and stays. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    window.print = () => {};
  });
}

function snapshot(index: number) {
  return {
    id: `snap-${index}`,
    timestamp: new Date(Date.UTC(2026, 9, 1, 12, index)).toISOString(),
    whyStatement: `Statement ${index}`,
    rootReason: '',
    nextStep: '',
    track: 'career',
    topic: `Topic ${index}`,
    responses: ANSWERS,
    updatedAt: '2026-10-01T12:00:00.000Z',
    version: 3,
  };
}

const STORY = {
  id: 'story-1',
  primarySkillId: 'communication',
  otherSkillIds: [],
  trigger: 'Pantry schedule',
  hook: 'Volunteers kept missing shifts.',
  proofSnippet: '',
  play: 'I rebuilt our campus pantry volunteer schedule and the volunteers stopped missing shifts.',
  proof: 'No missed shifts for the rest of the term.',
  confidence: 60,
  readiness: 'solid',
  questionPrompts: [],
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

const WORKSPACE = {
  version: 1,
  roles: [
    {
      id: 'role-1',
      jobTitle: 'Community Programs Intern',
      company: '',
      rawJdText: 'Community Programs Intern\nClear written communication',
      bullets: [
        {
          id: 'b1',
          text: 'Clear written communication',
          status: 'active',
          primarySkillId: 'communication',
          secondarySkillIds: [],
          section: 'required',
          confirmed: false,
          origin: 'parsed',
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  stories: [STORY],
  packets: [
    {
      id: 'packet-1',
      roleId: 'role-1',
      mode: 'prep',
      topStoryIds: ['story-1'],
      customQuestions: ['What does a good first month look like?'],
      notes: '',
      panicAnswer: '',
      companyIntel: { keywords: ['community', 'reliable'], notes: '', links: [] },
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  currentRoleId: 'role-1',
  currentPacketId: 'packet-1',
};

async function seedWorkspace(page: Page) {
  await page.goto('/interview-glow-up/workspace/');
  await page.evaluate((data) => {
    window.localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
  }, WORKSPACE);
}

test.describe('Five Whys history', () => {
  test('a stale tab keeps the snapshot another tab saved', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await useStudentProfile(first);
    for (const page of [first, second]) {
      await page.goto('/career/');
      await waitForHydration(page);
    }
    await fillChain(first, 'Biology reflection A');
    await first.getByRole('button', { name: 'Save snapshot' }).click();

    await fillChain(second, 'Physics reflection B');
    await second.getByRole('button', { name: 'Save snapshot' }).click();

    const history = JSON.parse((await readStorage(second, 'career-why-history')) ?? '[]');
    expect(history.map((entry: { topic: string }) => entry.topic).sort()).toEqual([
      'Biology reflection A',
      'Physics reflection B',
    ]);
    // The first tab hears about the second tab's save.
    await expect(
      first.getByRole('button', { name: /^Load snapshot: Physics reflection B/ })
    ).toBeVisible();
  });

  test('a saved limit of 24 keeps 16 snapshots through a reload', async ({ page }) => {
    await page.goto('/career/');
    await page.evaluate(
      (entries) => {
        window.localStorage.setItem('career-why-history', JSON.stringify(entries));
        window.localStorage.setItem('career-why-history-limit', '24');
      },
      Array.from({ length: 16 }, (_, index) => snapshot(index))
    );
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole('button', { name: /^Load snapshot:/ })).toHaveCount(16);
    const stored = JSON.parse((await readStorage(page, 'career-why-history')) ?? '[]');
    expect(stored).toHaveLength(16);
  });
});

test.describe('guide after a reload', () => {
  test('the workspace guide reopens Decode the job for the parse step', async ({ page }) => {
    await useStudentProfile(page);
    await page.goto('/interview-glow-up/workspace/?guide=1');
    await waitForHydration(page);
    const coach = page.locator('aside[aria-label="Guide"]');
    await expect(coach).toContainText('Step 1 of 8');
    await page.locator('[data-guide="decode-sample"]').click();
    await expect(coach).toContainText('Step 2 of 8');

    await page.reload();
    await waitForHydration(page);
    await expect(coach).toContainText('Step 2 of 8');
    await expect(page.getByRole('tab', { name: /Decode the job/ })).toHaveAttribute(
      'data-state',
      'active'
    );
    const show = coach.getByRole('button', { name: 'Show', exact: true });
    if (await show.isVisible()) await show.click();
    await coach.getByRole('button', { name: 'Show me where' }).click();
    await expect(page.getByRole('button', { name: 'Parse the requirements' })).toBeFocused();
  });

  test('the rehearsal guide goes back to the start when the answer is gone', async ({ page }) => {
    await page.goto('/interview-glow-up/rehearse/?guide=1');
    await waitForHydration(page);
    const coach = page.locator('aside[aria-label="Guide"]');
    await page.getByRole('radio', { name: /In writing/ }).check();
    await page.getByRole('button', { name: 'Start with the first question' }).click();
    await page.getByLabel('Your answer').fill('I ran the volunteer schedule for my campus pantry.');
    await page.getByRole('button', { name: 'Review my answer' }).click();
    await expect(coach).toContainText('Step 3 of 6');

    await page.reload();
    await waitForHydration(page);
    await expect(page.getByText('How will you answer?')).toBeVisible();
    await expect(coach).toContainText('Step 1 of 6');
  });

  test('a decoded posting and a saved story start the workspace guide past them', async ({
    page,
  }) => {
    await seedWorkspace(page);
    await page.goto('/interview-glow-up/workspace/?guide=1');
    await waitForHydration(page);
    await expect(page.locator('aside[aria-label="Guide"]')).toContainText('Step 7 of 8');
  });
});

test.describe('printing the packet', () => {
  test('prints the stories in full, keywords, and questions, not the form', async ({ page }) => {
    await stubPrint(page);
    await seedWorkspace(page);
    await page.goto('/interview-glow-up/workspace/?tab=packet');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'Print or save as PDF' }).click();
    const sheet = page.getByTestId('packet-print');
    await expect(sheet).toContainText(STORY.play);
    await expect(sheet).toContainText(STORY.proof);
    await expect(sheet).toContainText('community, reliable');
    await expect(sheet).toContainText('What does a good first month look like?');
    await expect(sheet.locator('h1')).toHaveText('Community Programs Intern');

    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(page.locator('#packet-keywords')).toBeHidden();
    await expect(page.getByRole('tab', { name: /Pack the proof/ })).toBeHidden();
  });

  test('printing from the open cheat sheet prints the cheat sheet', async ({ page }) => {
    await stubPrint(page);
    await seedWorkspace(page);
    await page.goto('/interview-glow-up/workspace/?tab=packet');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'Open the cheat sheet (HUD)' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 1 })).toHaveText('Community Programs Intern');
    await dialog.getByRole('button', { name: 'Print the cheat sheet' }).click();
    const sheet = page.getByTestId('packet-print');
    await expect(sheet).toContainText('One-screen cheat sheet (HUD)');
    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(STORY.play);
    const printed = await page.evaluate(() => document.body.innerText);
    expect(printed).toContain(STORY.play);
  });

  test('the browser print with the cheat sheet open is not blank', async ({ page }) => {
    await stubPrint(page);
    await seedWorkspace(page);
    await page.goto('/interview-glow-up/workspace/?tab=packet');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'Open the cheat sheet (HUD)' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => document.body.innerText);
    expect(printed).toContain(STORY.play);
    expect(printed).toContain('What does a good first month look like?');
  });

  test('Enter on the focused Close button closes the cheat sheet', async ({ page }) => {
    await seedWorkspace(page);
    await page.goto('/interview-glow-up/workspace/?tab=packet');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'Open the cheat sheet (HUD)' }).first().click();
    const close = page.getByRole('button', { name: 'Close HUD' });
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('phone coach', () => {
  test('Show me where leaves the topic field reachable in OpenDyslexic at night', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem('career-tools-font', 'dyslexic');
      window.localStorage.setItem('career-tools-theme', 'night');
    });
    await page.goto('/career/?guide=1');
    await waitForHydration(page);
    const coach = page.locator('aside[aria-label="Guide"]');
    const show = coach.getByRole('button', { name: 'Show', exact: true });
    if (await show.isVisible()) await show.click();
    await coach.getByRole('button', { name: 'Show me where' }).click();
    // The coach folds to its bar and the field is not under it.
    await expect(coach.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    const reachable = await page.locator('#career-topic').evaluate((field) => {
      const box = field.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return hit === field || field.contains(hit);
    });
    expect(reachable).toBe(true);
  });

  test('a focused field is lifted above the coach bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/career/?guide=1');
    await waitForHydration(page);
    const coach = page.locator('aside[aria-label="Guide"]');
    await expect(coach).toBeVisible();
    const field = page.getByLabel('Depth 1 response');
    // Put the field right where the coach sits, then focus it.
    await field.evaluate((element) => {
      const box = element.getBoundingClientRect();
      window.scrollBy(0, box.top - (window.innerHeight - 40));
    });
    await page.locator('#career-topic').fill('Nursing');
    await field.focus();
    await page.waitForTimeout(400);
    const clear = await field.evaluate((element) => {
      const bar = document.querySelector('aside[aria-label="Guide"]')?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return bar ? box.bottom <= bar.top : true;
    });
    expect(clear).toBe(true);
  });
});
