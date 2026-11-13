import { expect, type Locator, type Page, test } from '@playwright/test';
import type { GuideCheck, GuideTool } from '../src/lib/guide';
import { GUIDES } from '../src/lib/guides';
import { rate, useStudentProfile, waitForHydration } from './helpers';

/** On a phone the coach is a one-line bar; open it before pressing anything inside. */
async function openCoach(page: import('@playwright/test').Page) {
  const coach = page.getByRole('complementary', { name: 'Guide' });
  // Wait for the bar's own toggle: a closing menu can hide the page from the
  // accessibility tree for a moment, and a one-off check would miss it.
  await expect(coach.getByRole('button', { name: /^(Show|Hide)$/ })).toBeVisible();
  // Exact: "Show me where" is a different button.
  const show = coach.getByRole('button', { name: 'Show', exact: true });
  if (await show.isVisible()) await show.click();
  return coach;
}

test('guided mode walks a first-timer through the Resume Game by watching what they do', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/resume-game/');
  await waitForHydration(page);

  // Offered, not forced.
  await expect(page.getByText(/New to this\?/)).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Guide' })).toHaveCount(0);

  await page.getByRole('radio', { name: 'Guided' }).check();
  const coach = page.getByRole('complementary', { name: 'Guide' });
  await expect(coach).toContainText('Step 1 of 5');
  await expect(page.getByLabel('Paste resume text')).toHaveAttribute('data-guide-active', '');

  // The example shortcut does the step, and the coach notices on its own.
  await (await openCoach(page)).getByRole('button', { name: 'Use a sample resume' }).click();
  await expect(coach).toContainText('Step 2 of 5');
  await expect(coach).toContainText('Score it');

  await page.getByRole('button', { name: 'Analyze resume' }).click();
  await expect(coach).toContainText('Step 3 of 5');
  await expect(page.locator('[data-bullet-list]')).toHaveAttribute('data-guide-active', '');

  // Some steps only the visitor can confirm.
  await page.locator('[data-bullet-list] button').first().click();
  await (await openCoach(page)).getByRole('button', { name: 'I did this' }).click();
  await expect(coach).toContainText('Step 4 of 5');

  // Progress survives a reload, and the guide can be ended.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole('complementary', { name: 'Guide' })).toContainText('Step 4 of 5');
  await page.getByRole('button', { name: 'End guide' }).click();
  await expect(page.getByRole('complementary', { name: 'Guide' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'On my own' })).toBeChecked();
});

// ---------------------------------------------------------------------------
// One walk per tool. The walker turns the guide on with empty storage, then for
// each step asserts that the coach is on that step, that the page renders what
// the step points at (target, example button, and the check's selector), that
// finishing the previous step did not already satisfy this one, does what a
// visitor would, and waits for the coach to notice.

type Act = (coach: Locator) => Promise<void>;

/** The same look at the page the coach takes, run in the browser. */
function checkHolds(page: Page, check: GuideCheck) {
  return page.evaluate((c) => {
    if (c.kind === 'manual') return false;
    const all = [...document.querySelectorAll(c.selector)];
    switch (c.kind) {
      case 'exists':
        return all.length > 0;
      case 'count':
        return all.length >= c.atLeast;
      case 'filled':
        return all.some(
          (el) => ((el as HTMLInputElement).value ?? '').trim().length >= (c.minLength ?? 1)
        );
      case 'text':
        return all[0] ? new RegExp(c.pattern, 'i').test(all[0].textContent ?? '') : false;
    }
  }, check);
}

async function walkGuide(
  page: Page,
  tool: GuideTool,
  acts: Record<string, Act>,
  beforeFinish?: () => Promise<void>
) {
  const guide = GUIDES[tool];
  if (!guide) throw new Error(`No guide for ${tool}`);
  expect(Object.keys(acts).sort()).toEqual(guide.steps.map((s) => s.id).sort());

  // Empty storage: nothing on the page already counts as a finished step.
  for (const step of guide.steps) {
    expect(await checkHolds(page, step.done), `${step.id} holds on a fresh page`).toBe(false);
  }

  await expect(page.getByText(guide.invitation)).toBeVisible();
  await page.getByRole('radio', { name: 'Guided' }).check();
  // Located by CSS so it still reads while a modal hides the rest of the page.
  const coach = page.locator('aside[aria-label="Guide"]');
  const total = guide.steps.length;

  for (const [index, step] of guide.steps.entries()) {
    await expect(coach).toContainText(`Step ${index + 1} of ${total}`);
    await expect(coach).toContainText(step.title);
    expect(await checkHolds(page, step.done), `${step.id} was done by an earlier step`).toBe(false);
    if (step.target) {
      await expect(page.locator(step.target).first()).toHaveAttribute('data-guide-active', '');
    }
    if (step.example) await expect(page.locator(step.example.click).first()).toBeAttached();

    await acts[step.id](coach);

    if (step.done.kind !== 'manual') {
      await expect.poll(() => checkHolds(page, step.done), { message: step.id }).toBe(true);
    }
  }

  await expect(coach).toContainText('Guide finished');
  await beforeFinish?.();
  const finished = page.getByRole('complementary', { name: 'Guide' });
  await expect(finished).toContainText(guide.finish.title);
  if (guide.finish.link) {
    await openCoach(page);
    await expect(finished.getByRole('link', { name: guide.finish.link.label })).toHaveAttribute(
      'href',
      guide.finish.link.href
    );
  }
}

test('guided mode walks a first-timer through the Five Whys', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);

  await walkGuide(page, 'career', {
    topic: async () => {
      await page.getByRole('button', { name: /Interest Path/ }).click();
      await page.locator('#career-topic').fill('biology');
    },
    'depth-1': async (coach) => {
      // The worked example opens from the coach.
      await (await openCoach(page)).getByRole('button', { name: 'Show a worked example' }).click();
      await expect(page.locator('[data-guide="why-example-0"]')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      await page.getByLabel('Depth 1 response').fill('I liked the lab sections more than lectures');
    },
    'depth-2': async () => {
      await page.getByLabel('Depth 2 response').fill('I get to test an idea with my own hands');
    },
    'depth-3': async () => {
      await page
        .getByLabel('Depth 3 response')
        .fill('It proves to me that I can figure things out');
    },
    'depth-4': async () => {
      await page.getByLabel('Depth 4 response').fill('I want work where evidence beats opinion');
    },
    'depth-5': async () => {
      await page.getByLabel('Depth 5 response').fill('I need to trust what I am working on');
    },
    save: async () => {
      await page.getByRole('button', { name: 'Save snapshot' }).click();
    },
  });
});

test('guided mode walks a first-timer through one networking rep', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/networking-practice/');
  await waitForHydration(page);

  await walkGuide(page, 'networking-practice', {
    scenario: async (coach) => {
      await page.locator('#scenario').click();
      await page.getByRole('option').nth(1).click();
      // A scenario is chosen by default, so only the visitor can say they picked.
      await (await openCoach(page)).getByRole('button', { name: 'I did this' }).click();
    },
    draft: async () => {
      await page
        .locator('#intro-draft')
        .fill(
          'Hi, I am Sam, a second-year biology student. I ran our lab study group. What do new analysts here work on first?'
        );
    },
    timer: async () => {
      await page.getByRole('button', { name: 'Start', exact: true }).click();
    },
    rate: async () => {
      for (const label of ['Confidence', 'Clarity', 'Rapport', 'Authenticity']) {
        await rate(page, label, 4);
      }
    },
    'next-fix': async () => {
      await page.locator('#reflection-nextFocus').fill('Slow down on the opener');
    },
    save: async () => {
      await page.getByRole('button', { name: 'Save this rep' }).click();
    },
  });
});

const POSTING = `Junior Software Developer
Brightline Health - Remote (US)

Responsibilities
- Build and maintain features in our Python backend and React frontend
- Write unit and integration tests for new code
- Collaborate with designers and product managers on requirements

Requirements
- Familiarity with Python or JavaScript from coursework or projects
- Comfortable with Git and pull request workflows
- Clear written communication`;

test('guided mode walks a first-timer through the interview workspace, tab by tab', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/interview-glow-up/workspace/');
  await waitForHydration(page);

  await walkGuide(
    page,
    'interview-glow-up',
    {
      paste: async () => {
        await page.locator('#jd-text').fill(POSTING);
      },
      parse: async () => {
        await page.getByRole('button', { name: 'Parse the requirements' }).click();
      },
      'open-stories': async () => {
        await page.getByRole('tab', { name: /Build stories/ }).click();
      },
      'start-story': async () => {
        // The first gap after "+ New story" opens the editor with that skill chosen.
        await page.locator('[data-guide="stories-start"] button').nth(1).click();
        await expect(page.locator('#story-primary-skill')).not.toContainText('Select skill');
      },
      play: async () => {
        await page
          .locator('#story-play')
          .fill('I rebuilt our capstone data pipeline in Python when the original plan broke.');
      },
      'save-story': async () => {
        await page.getByRole('button', { name: 'Save and add to packet' }).click();
      },
      'open-packet': async () => {
        await page.getByRole('tab', { name: /Pack the proof/ }).click();
      },
      hud: async () => {
        await page.locator('[data-guide="packet-hud"]').click();
      },
    },
    async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Close HUD' })).toHaveCount(0);
    }
  );
});

// With no wage data built in, the guide starts at the worksheet; the title
// search steps return once wages ship.
test('guided mode walks a first-timer through the offer worksheet', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/pay/');
  await waitForHydration(page);

  await walkGuide(page, 'pay', {
    base: async () => {
      await page.getByLabel('Base pay').fill('18');
    },
    period: async () => {
      await page.getByLabel('Paid').selectOption('hour');
    },
    time: async () => {
      await page.getByLabel('Hours a week').fill('20');
      await page.getByLabel('Weeks a year').fill('10');
    },
  });
});

test('the rehearsal guide follows one written answer from start to review', async ({ page }) => {
  await page.goto('/interview-glow-up/rehearse/');
  await waitForHydration(page);
  await page.getByRole('radio', { name: 'Guided' }).check();
  const coach = page.getByRole('complementary', { name: 'Guide' });
  await expect(coach).toContainText('Step 1 of 6');

  await page.getByRole('radio', { name: /In writing/ }).check();
  await page.getByRole('button', { name: 'Start with the first question' }).click();
  await expect(coach).toContainText('Step 2 of 6');

  await page.getByLabel('Your answer').fill('I ran the volunteer schedule for my campus pantry.');
  await page.getByRole('button', { name: 'Review my answer' }).click();
  await expect(coach).toContainText('Step 3 of 6');
  await (await openCoach(page)).getByRole('button', { name: 'I did this' }).click();
  await expect(coach).toContainText('Step 4 of 6');

  await page.getByLabel('I answered the question that was asked').check();
  await expect(coach).toContainText('Step 5 of 6');
  await page.getByRole('button', { name: 'What might they ask next?' }).click();
  await expect(coach).toContainText('Step 6 of 6');
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(coach).toContainText('That is one full rep');
});

test('the coach stays usable on a short laptop screen, above the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/application/?guide=1');
  await waitForHydration(page);
  // The link turned the guide on without a click.
  const coach = await openCoach(page);
  await expect(coach).toContainText('Step 1 of 6');
  // Nothing else on the page may sit on top of the coach's own buttons.
  for (const name of ['Skip this step', 'Show me where']) {
    const covered = await coach.getByRole('button', { name }).evaluate((button) => {
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !(top === button || button.contains(top));
    });
    expect(covered, `${name} is covered`).toBe(false);
  }
  await coach.getByRole('button', { name: 'Skip this step' }).click();
  await expect(coach).toContainText('Step 2 of 6');
  // The same holds at the bottom of the page, where the footer is.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await (await openCoach(page)).getByRole('button', { name: 'Skip this step' }).click();
  await expect(coach).toContainText('Step 3 of 6');
});
