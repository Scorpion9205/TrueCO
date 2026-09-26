import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { expectAccessible, openSection, OWNER_LOGIN, SECTIONS, watchForProblems } from './helpers';

test.describe.configure({ mode: 'serial' });

/** Nothing may be wider than the screen: sideways scrolling on a phone is a layout bug */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

test('the landing page fits a phone', async ({ page }) => {
  await page.goto('/');
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('an owner signs in on a phone and uses every section', async ({ page }) => {
  // Visits and scans every section
  test.setTimeout(180_000);
  const problems = watchForProblems(page);
  const login = JSON.parse(readFileSync(OWNER_LOGIN, 'utf8')) as {
    email: string;
    password: string;
  };

  await page.goto('/login');
  await page.getByLabel('Email').fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/app');
  await expectNoSidewaysScroll(page);

  // On a phone the sections are behind the menu button
  await page.getByRole('button', { name: /open menu/i }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Students' }).click();
  await page.waitForURL('**/app/students');
  await expect(page.getByRole('dialog')).toBeHidden();

  for (const path of SECTIONS) {
    await openSection(page, path);
    await expectNoSidewaysScroll(page);
    await expectAccessible(page);
  }
  expect(problems()).toEqual([]);
});
