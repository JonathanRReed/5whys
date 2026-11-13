import { expect, type Page, test } from '@playwright/test';
import { useStudentProfile, waitForHydration } from './helpers';

const RESUME = `Marcus Bell
Riverside, CA | marcus.bell.student@example.com
Education
Inland Valley Community College, Associate in Business Administration, expected May 2027
Experience
Cashier, Valley Fresh Market, Aug 2023 - Present
- Responsible for helping customers
- Handled the cash register and counted the drawer
Treasurer, Business Club, Inland Valley Community College, Sep 2024 - Present
- In charge of club money
Skills
Excel, customer service, teamwork`;

const POSTING = `Operations Intern (Summer 2027)
Coastline Supply Co. | Ontario, CA | Paid, $19 per hour

Required qualifications
- Currently enrolled in an associate or bachelor's program in business, supply chain, or a related field
- Working knowledge of Microsoft Excel, including sorting, filters, and basic formulas
- Able to work on site in Ontario, CA, Monday through Friday

Preferred qualifications
- Experience in retail, food service, or a warehouse

Other
- Must be at least 18 years old and authorized to work in the United States. We do not sponsor visas for this role.
- Coastline Supply Co. is an equal opportunity employer.`;

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '');

async function saveResume(page: Page) {
  await page.goto('/resume-game/');
  await waitForHydration(page);
  await page.getByLabel('Paste resume text').fill(RESUME);
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.localStorage)))
    .toContain('Valley Fresh Market');
}

async function startApplication(page: Page, deadline?: string) {
  await page.goto('/application/');
  await waitForHydration(page);
  await page.getByLabel('Role', { exact: true }).fill('Operations Intern (Summer 2027)');
  await page.getByLabel('Company or organization (optional)').fill('Coastline Supply Co.');
  if (deadline) await page.getByLabel('Deadline (optional)').fill(deadline);
  await page.getByRole('button', { name: 'Start this application' }).click();
  await page.getByLabel('Job description').fill(POSTING);
  await page.getByRole('button', { name: 'Decode the posting' }).click();
  await page.getByRole('button', { name: /^Confirm the required and preferred ones/ }).click();
}

test('an intern works through the desk: honest evidence, kept focus, and a gated send', async ({
  page,
}) => {
  await useStudentProfile(page);
  await saveResume(page);

  await page.goto('/application/');
  await waitForHydration(page);
  // A day-first date read month-first shows at once, in words.
  await page.getByLabel('Deadline (optional)').fill('2027-12-01');
  await expect(page.getByTestId('deadline-words')).toHaveText(
    'Deadline read as Wednesday, December 1, 2027.'
  );
  await startApplication(page);

  // "Mark as sent" waits for a posting, then sits in the header.
  await expect(page.getByRole('button', { name: /^Mark as sent/ }).first()).toBeVisible();

  // The no-sponsorship sentence is kept as a condition, with its glossary once.
  await expect(page.getByText('Visa sponsorship, a condition of the job.')).toBeVisible();
  await expect(page.getByTestId('condition-terms')).toHaveCount(1);

  await page.getByRole('tab', { name: /Qualifications/ }).click();
  const row = (text: string) => page.locator('li', { hasText: text }).last();
  await expect(row('Currently enrolled in an associate')).toContainText('In your resume');
  await expect(row('Currently enrolled in an associate')).not.toContainText('Not shown yet');
  await expect(row('Experience in retail')).toContainText('Read as retail from the word "Cashier"');
  await row('We do not sponsor visas').getByRole('radio', { name: 'Yes, I will' }).check();
  await row('Working knowledge of Microsoft Excel').getByRole('radio', { name: 'Have it' }).check();
  await row('Working knowledge of Microsoft Excel')
    .getByRole('textbox')
    .fill('I keep the Business Club budget in an Excel sheet with SUM formulas');
  await row('Experience in retail').getByRole('radio', { name: 'Have it' }).check();

  // Add step keeps the keyboard in the step box.
  await page.getByLabel('Next step').fill('Ask the career center to read my letter');
  await page.getByLabel('Next step').press('Enter');
  await expect(
    page.getByRole('checkbox', { name: 'Done: Ask the career center to read my letter' })
  ).toBeVisible();
  expect(await activeId(page)).toBe('desk-step-text');

  // Letter: skill then proof, focus moves into the box the press filled.
  await page.getByRole('tab', { name: /Letter/ }).click();
  await page.getByRole('button', { name: 'Start from what you marked "have it"' }).click();
  const whyYou = page.locator('#desk-letter-whyYou');
  await expect(whyYou).toHaveValue(
    /^Microsoft Excel: I keep the Business Club budget in an Excel sheet with SUM formulas\. /
  );
  expect(await activeId(page)).toBe('desk-letter-whyYou');
  await page.getByRole('button', { name: 'Use "Marcus Bell" from your resume' }).click();
  await expect(page.locator('#desk-letter-sender')).toHaveValue('Marcus Bell');

  await page
    .getByLabel(/Name the role with a hook/)
    .fill(
      'Every month this year I balanced the Business Club budget to the cent, and I want to bring that care to the Operations Intern role at Coastline Supply Co.'
    );
  await page.getByRole('button', { name: 'Write the three messages' }).click();
  await expect(page.locator('#desk-message-linkedin')).toBeFocused();
  for (const kind of ['linkedin', 'follow-up-email', 'intro-call']) {
    await expect(page.locator(`#desk-message-${kind}`)).not.toHaveValue(/Co\.\./);
  }

  // Before you send: the length is not ticked, and the sponsorship answer is carried.
  await page.getByRole('tab', { name: /Before you send/ }).click();
  await expect(page.getByTestId('condition-warnings')).toContainText(
    'You said you will need sponsorship, and this posting says it does not sponsor.'
  );
  await expect(page.getByText(/A letter this short reads as a note/)).toBeVisible();
  await expect(page.getByText('Mentions Operations Intern and Coastline Supply Co.')).toBeVisible();

  const send = page.getByRole('region', { name: 'Sent it?' }).getByRole('button', {
    name: /Mark as sent/,
  });
  await send.click();
  await expect(send).toHaveText(/The letter still has \[.*\]\. Mark as sent anyway/);
  await send.click();
  await expect(page.getByTestId('sent-on').first()).toBeVisible();
});

test('a posting brought from the homepage is not lost behind an open application', async ({
  page,
}) => {
  await useStudentProfile(page);
  await startApplication(page);
  await page.evaluate(() =>
    window.sessionStorage.setItem(
      'desk-posting-handoff',
      'Marketing Intern\nNew University\n\nRequirements\n- Experience with Canva'
    )
  );
  await page.reload();
  await waitForHydration(page);
  const waiting = page.getByTestId('posting-waiting');
  await expect(waiting).toContainText('It starts: "Marketing Intern"');
  await waiting.getByRole('button', { name: 'Start a new application with it' }).click();
  await expect(page.locator('#desk-new-title')).toHaveValue('Marketing Intern');
  await page.getByRole('button', { name: 'Start this application' }).click();
  await expect(page.getByLabel('Job description')).toHaveValue(/Experience with Canva/);
});

test('the start form stacks at large text instead of squeezing', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One width is enough for the layout check.');
  await useStudentProfile(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/application/');
  await waitForHydration(page);
  // Chrome's own text size setting at 200 percent, as a visitor would set it.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 32 } });
  const role = page.getByLabel('Role', { exact: true });
  await expect.poll(async () => (await role.boundingBox())?.width ?? 0).toBeGreaterThan(300);
  const roleBox = await role.boundingBox();
  const deadline = await page.getByLabel('Deadline (optional)').boundingBox();
  // Not four in a row: the deadline moves to a row of its own.
  expect(deadline?.y ?? 0).toBeGreaterThan((roleBox?.y ?? 0) + (roleBox?.height ?? 0));
  const button = page.getByRole('button', { name: 'Start this application' });
  expect(await button.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});
