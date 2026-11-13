import { expect, type Page, test } from '@playwright/test';
import { readStorage, useStudentProfile, waitForHydration } from './helpers';

const ANSWERS = [
  'I liked the lab days more than anything else in my classes this year.',
  'On the floor I could see a person get calmer because someone explained what was happening.',
  'When my brother was in the hospital, the nurse was the only one who told us what the machines meant.',
  'I want to be the person who makes a scary place less confusing for a family.',
  'I need work where helping patients understand is part of the job, not extra.',
];

async function answerAll(page: Page, answers: string[]) {
  for (const [index, answer] of answers.entries()) {
    const box = page.getByLabel(`Depth ${index + 1} response`);
    await box.fill(answer);
    await expect(box).toHaveAttribute('data-answered', '');
  }
}

test('an answer written in Chinese counts, and the chain moves on', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);
  await page.getByRole('button', { name: /Career Path/ }).click();
  await page.locator('#career-topic').fill('資料分析師 data analyst');
  const first = page.getByLabel('Depth 1 response');
  await first.fill('我喜歡用數據幫助醫院的病人');
  await expect(first).toHaveAttribute('data-answered', '');
  await expect(page.getByLabel('Depth 2 response')).toBeEnabled();
  await expect(page.getByText('Needs more')).toHaveCount(0);
  // A held key still does not count.
  await first.fill('啊啊啊啊啊啊啊啊');
  await expect(first).not.toHaveAttribute('data-answered', '');
});

test('an either/or topic gets a test for each side, and the statement goes to an intro', async ({
  page,
}) => {
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);
  await page.getByRole('button', { name: /Career Path/ }).click();
  await page.locator('#career-topic').fill('Research technician or pharmacy');
  await expect(page.getByText(/toward research technician or pharmacy/)).toBeVisible();
  await answerAll(page, ANSWERS);

  await expect(
    page.getByText(
      /one person who works as a research technician and one who works in pharmacy this week/
    )
  ).toBeVisible();

  // The statement is built from the visitor's own phrases, and stays editable.
  await page.getByRole('button', { name: /I liked the lab days/ }).click();
  await expect(page.locator('#why-statement-draft')).toHaveValue(
    'I liked the lab days more than anything else in my classes this year'
  );
  await page.locator('#why-must-offer').fill('time with patients');
  await page.locator('[data-guide="why-save"]').click();
  await expect(page.getByText('Saved to local dashboard').first()).toBeAttached();
  const history = JSON.parse((await readStorage(page, 'career-why-history')) ?? '[]');
  expect(history[0]).toMatchObject({
    statement: 'I liked the lab days more than anything else in my classes this year',
    mustOffer: 'time with patients',
  });

  await page.getByRole('link', { name: 'Put it in a networking intro' }).click();
  await waitForHydration(page);
  await expect(page.getByText('From your Five Whys')).toBeVisible();
  await page.locator('#intro-draft').fill('Hi, I am Sam.');
  await page.getByRole('button', { name: 'Add to the end of my draft' }).click();
  await expect(page.locator('#intro-draft')).toHaveValue(
    'Hi, I am Sam.\nI liked the lab days more than anything else in my classes this year'
  );
});

test('a chain can start from one experience', async ({ page }) => {
  await useStudentProfile(page);
  await page.goto('/career/');
  await waitForHydration(page);
  await page.getByRole('button', { name: /Start from an experience/ }).click();
  await expect(page.getByText('The experience', { exact: true })).toBeVisible();
  await page.locator('#career-topic').fill('Closing the bakery on Saturdays');
  await expect(
    page.getByText('Tell the story of "Closing the bakery on Saturdays".', { exact: false })
  ).toBeVisible();
  const session = JSON.parse((await readStorage(page, 'career-why-session-v2')) ?? '{}');
  expect(session).toMatchObject({ track: 'interest', start: 'experience' });
});
