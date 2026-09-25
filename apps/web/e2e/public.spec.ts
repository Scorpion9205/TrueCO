import { expect, test } from '@playwright/test';
import { expectAccessible, watchForProblems } from './helpers';

test.describe('public pages', () => {
  test('the landing page loads with pricing, within the security policy', async ({ page }) => {
    const problems = watchForProblems(page);
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#pricing')).toBeVisible();
    await expectAccessible(page);
    expect(problems()).toEqual([]);
  });

  test('the sign-in page is accessible and refuses a wrong password', async ({ page }) => {
    const problems = watchForProblems(page);
    await page.goto('/login');
    await expectAccessible(page);
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(problems()).toEqual([]);
  });

  test('signed-out visitors are sent from the app to sign in', async ({ page }) => {
    await page.goto('/app/students');
    await page.waitForURL(/\/login/);
  });
});
