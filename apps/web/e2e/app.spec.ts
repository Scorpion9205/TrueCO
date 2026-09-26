import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { expectAccessible, openSection, OWNER_STATE, SECTIONS, watchForProblems } from './helpers';

// The API rotates refresh tokens and treats a reused one as theft, so the saved session is used
// by one browser context for all of these steps, in order
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let problems: () => string[];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ storageState: OWNER_STATE });
  page = await context.newPage();
  problems = watchForProblems(page);
});

test.afterAll(async () => {
  await context.close();
});

test.afterEach(() => {
  expect(problems()).toEqual([]);
});

test('the dashboard loads for the new institute', async () => {
  await page.goto('/app');
  await expect(page.getByRole('navigation', { name: 'App' }).first()).toBeVisible();
  await expectAccessible(page);
});

test('a student can be added and found', async () => {
  await page.goto('/app/students');
  await page.getByRole('button', { name: 'Add student' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First name').fill('Aarav');
  await dialog.getByLabel('Last name').fill('Sharma');
  await dialog.getByRole('button', { name: 'Add student' }).click();

  await page.goto('/app/students');
  await expect(page.getByRole('link', { name: /Aarav Sharma/ }).first()).toBeVisible();
  await expectAccessible(page);
});

test('each section opens without errors', async () => {
  // Visits and scans every section
  test.setTimeout(180_000);
  await page.goto('/app');
  for (const path of SECTIONS) {
    await openSection(page, path);
    await expectAccessible(page);
  }
});

test('an unknown app address shows "not found" inside the app', async () => {
  await page.goto('/app/no-such-page');
  await expect(page.getByText('Page not found')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to dashboard' })).toBeVisible();
});

test('dark mode is remembered across a reload, without a flash', async () => {
  // Visits and scans every section
  test.setTimeout(180_000);
  await page.goto('/app');
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.keyboard.press('Escape');

  await page.reload();
  // Set by the inline script before the app loads
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expectAccessible(page);

  // Every section stays readable in dark mode too
  for (const path of SECTIONS) {
    await openSection(page, path);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expectAccessible(page);
  }

  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
