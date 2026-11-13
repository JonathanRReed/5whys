import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { readStorage, waitForHydration } from './helpers';

const KEY = 'interview-glow-up-data';
const LAB_POSTING = readFileSync('tests/fixtures/postings/research-technician.txt', 'utf8');

const story = {
  id: 's1',
  primarySkillId: 'lab-technique',
  otherSkillIds: [],
  trigger: 'Smeared gels',
  hook: 'Every gel in the teaching lab smeared for a week.',
  proofSnippet: '',
  play: 'I remade the running buffer and reran the samples. Then I wrote the fix into our notes.',
  proof: 'The next runs were clean. Six groups used the corrected buffer for the rest of the term.',
  confidence: 60,
  readiness: 'solid',
  questionPrompts: [],
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

function seeded(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    roles: [
      {
        id: 'r1',
        jobTitle: 'Research Technician I',
        company: 'Halvorsen Institute',
        rawJdText: 'Run PCR and gels.',
        parsedJdText: 'Run PCR and gels.',
        bullets: [
          {
            id: 'b1',
            text: 'Run PCR, qPCR, and gel electrophoresis on samples',
            status: 'active',
            primarySkillId: 'lab-technique',
            secondarySkillIds: [],
            section: 'responsibility',
            confirmed: false,
            origin: 'parsed',
          },
          {
            id: 'b2',
            text: 'Ability to follow written protocols',
            status: 'active',
            primarySkillId: 'procedures-safety',
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
    stories: [story],
    packets: [
      {
        id: 'p1',
        roleId: 'r1',
        mode: 'prep',
        topStoryIds: ['s1'],
        customQuestions: [],
        notes: '',
        panicAnswer: '',
        companyIntel: { keywords: [], notes: '', links: [] },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    currentRoleId: 'r1',
    currentPacketId: 'p1',
    ...extra,
  };
}

test('an edited workspace tab never overwrites newer work saved in another tab', async ({
  page,
  context,
}) => {
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);
  await page.locator('#job-title').fill('Original role');
  // The edit reaches storage.
  await expect
    .poll(async () => JSON.parse((await readStorage(page, KEY)) ?? '{}').roles?.[0]?.jobTitle)
    .toBe('Original role');

  // Another tab (the desk, an import) changes the same role.
  const other = await context.newPage();
  await other.goto('/dashboard/');
  await other.evaluate((key) => {
    const data = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    data.roles[0].company = 'NEW COMPANY FROM DESK';
    window.localStorage.setItem(key, JSON.stringify(data));
  }, KEY);

  // The first tab shows the newer copy, and leaving it keeps it.
  await page.bringToFront();
  await expect(page.locator('#company')).toHaveValue('NEW COMPANY FROM DESK');
  await page.goto('/about/');
  const saved = JSON.parse((await readStorage(page, KEY)) ?? '{}');
  expect(saved.roles[0].company).toBe('NEW COMPANY FROM DESK');
  expect(saved.roles[0].jobTitle).toBe('Original role');
});

test('an edit waiting to save merges with a newer change from another tab', async ({
  page,
  context,
}) => {
  await page.addInitScript(
    ([key, data]) => {
      if (!window.sessionStorage.getItem('seeded')) {
        window.localStorage.setItem(key as string, JSON.stringify(data));
        window.sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, seeded()]
  );
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);

  const other = await context.newPage();
  await other.goto('/dashboard/');
  await other.evaluate((key) => {
    const data = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    data.stories.push({ ...data.stories[0], id: 's2', trigger: 'Written on the phone' });
    window.localStorage.setItem(key, JSON.stringify(data));
  }, KEY);

  await page.bringToFront();
  await page.locator('#job-title').fill('Research Technician II');
  await page.goto('/about/');
  const saved = JSON.parse((await readStorage(page, KEY)) ?? '{}');
  expect(saved.roles[0].jobTitle).toBe('Research Technician II');
  expect(saved.stories.map((s: { trigger: string }) => s.trigger)).toEqual([
    'Smeared gels',
    'Written on the phone',
  ]);
});

test('a lab posting decodes to lab work, with no SQL gap', async ({ page }) => {
  await page.goto('/interview-glow-up/workspace/?tab=decode');
  await waitForHydration(page);
  await page.locator('#jd-text').fill(LAB_POSTING);
  await page.locator('[data-guide="decode-parse"]').click();
  await expect(page.locator('[data-guide="decode-requirements"]')).toBeVisible();
  const tests = page.getByRole('heading', { name: 'What this job tests' }).locator('..');
  await expect(tests).toContainText('Lab technique');
  await expect(tests).toContainText('Following procedures and safety');
  await expect(tests).not.toContainText('SQL/Databases');
  await expect(page.getByTestId('decode-gaps')).not.toContainText('SQL/Databases');
  // What was set aside can be read, and brought back.
  await page.getByTestId('set-aside').locator('summary').click();
  await expect(page.getByTestId('set-aside')).toContainText('$44,000 to $48,000');
});

test('the packet has one cheat-sheet button, a competency view, and a HUD that rehearses', async ({
  page,
}) => {
  await page.addInitScript(
    ([key, data]) => window.localStorage.setItem(key as string, JSON.stringify(data)),
    [KEY, seeded()]
  );
  await page.goto('/interview-glow-up/workspace/?tab=packet');
  await waitForHydration(page);

  await expect(page.getByRole('button', { name: 'Open the cheat sheet (HUD)' })).toHaveCount(1);
  await expect(page.locator('[data-guide="packet-hud"]')).toHaveCount(1);
  await expect(page.getByTestId('packet-coverage')).toHaveText(
    'Stories in this packet answer 1 of 2 requirements: 0 rough, 1 solid, 0 rehearsed.'
  );
  await expect(page.getByTestId('packet-hud-missing')).toContainText('keywords');

  await page.locator('[data-guide="packet-hud"]').click();
  await expect(page.getByTestId('hud-play')).toContainText('I remade the running buffer');
  await expect(page.getByTestId('hud-proof')).toContainText('Six groups used the corrected buffer');
  await expect(page.getByTestId('hud-missing')).toBeVisible();
  await page.getByRole('link', { name: 'Rehearse these questions' }).click();
  await expect(page).toHaveURL(/\/interview-glow-up\/rehearse\/$/);
});

test('a written answer is kept, survives a reload, and becomes a story draft', async ({ page }) => {
  await page.addInitScript(
    ([key, data]) => {
      if (!window.sessionStorage.getItem('seeded')) {
        window.localStorage.setItem(key as string, JSON.stringify(data));
        window.sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, seeded({ packets: [{ ...seeded().packets[0], aiQuestions: '1. Why this core lab?' }] })]
  );
  await page.goto('/interview-glow-up/rehearse/');
  await waitForHydration(page);

  // The packet's saved questions are offered, unticked.
  const fromPacket = page.getByTestId('rehearsal-packet-questions');
  await expect(fromPacket.getByRole('checkbox', { name: 'Why this core lab?' })).not.toBeChecked();

  await page.getByRole('radio', { name: /In writing/ }).check();
  await page.getByRole('button', { name: 'Start with the first question' }).click();
  await page
    .getByLabel('Your answer')
    .fill('I want to be a research technician. Last spring I ran every gel for our teaching lab.');
  await page.getByRole('button', { name: 'Review my answer' }).click();
  await expect(page.getByTestId('answer-notes')).toContainText('It names "research".');
  // Nothing is written until the visitor keeps it.
  expect(JSON.parse((await readStorage(page, KEY)) ?? '{}').answers).toBeUndefined();
  await page.getByRole('button', { name: 'Keep this answer' }).click();
  await expect(page.getByRole('button', { name: 'Answer kept on this device' })).toBeDisabled();

  await page.reload();
  await waitForHydration(page);
  const kept = page.getByTestId('kept-answers');
  await expect(kept).toContainText('Last spring I ran every gel');
  await kept.getByRole('link', { name: /Use as a story draft/ }).click();

  await expect(page).toHaveURL(/\/interview-glow-up\/workspace\/\?draft=/);
  await waitForHydration(page);
  await expect(page.locator('#story-play')).toHaveValue(
    'I want to be a research technician. Last spring I ran every gel for our teaching lab.'
  );
});

test('the end of a session counts the answers given, not the questions skipped', async ({
  page,
}) => {
  await page.goto('/interview-glow-up/rehearse/');
  await waitForHydration(page);
  await page.getByRole('radio', { name: /In writing/ }).check();
  await page.getByRole('button', { name: 'Start with the first question' }).click();
  await page.getByLabel('Your answer').fill('I am a first-year student who likes fixing bikes.');
  await page.getByRole('button', { name: 'Review my answer' }).click();
  await page.getByRole('button', { name: 'Next question' }).click();
  while (await page.getByRole('button', { name: 'Skip to the next question' }).isVisible()) {
    await page.getByRole('button', { name: 'Skip to the next question' }).click();
  }
  await page.getByRole('button', { name: 'Skip and finish' }).click();
  await expect(page.getByTestId('rehearsal-summary')).toHaveText(
    /^You answered 1 of \d+ questions\.$/
  );
  await expect(page.getByTestId('session-answer')).toHaveCount(1);
  await expect(page.getByTestId('session-answer')).toContainText('likes fixing bikes');
});
