import { writeFileSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { expectAccessible, OWNER_LOGIN, OWNER_STATE, watchForProblems } from './helpers';

/** Signs up a new institute through the real form and keeps the session for the other tests */
setup('an owner signs up and lands on the dashboard', async ({ page }) => {
  const problems = watchForProblems(page);
  const stamp = Date.now();
  const login = { email: `e2e-${stamp}@example.com`, password: 'Secret@1234' };

  await page.goto('/signup');
  await expectAccessible(page);
  await page.getByLabel('Your full name').fill('E2E Owner');
  await page.getByLabel('Your email').fill(login.email);
  await page.getByLabel('Your mobile number').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByLabel('Institute name').fill(`E2E Academy ${stamp}`);
  await page.getByLabel('Institute code').fill(`e2e-${stamp}`);
  await page.getByRole('button', { name: 'Create my institute' }).click();

  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(problems()).toEqual([]);

  await page.context().storageState({ path: OWNER_STATE });
  writeFileSync(OWNER_LOGIN, JSON.stringify(login));
});
