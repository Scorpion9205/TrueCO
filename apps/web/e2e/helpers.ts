import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const OWNER_STATE = 'e2e/.auth/owner.json';
/** The new owner's sign-in, for tests that need a session of their own (e.g. on a phone) */
export const OWNER_LOGIN = 'e2e/.auth/owner-login.json';

export const SECTIONS = [
  '/app/students',
  '/app/batches',
  '/app/attendance',
  '/app/tests',
  '/app/homework',
  '/app/fees',
  '/app/expenses',
  '/app/salary',
  '/app/teachers',
  '/app/notices',
  '/app/reports',
  '/app/settings',
  '/app/billing',
];

/** Collects Content-Security-Policy violations and uncaught errors while a page is used */
export function watchForProblems(page: Page): () => string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      problems.push(`CSP: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`Error: ${error.message}`));
  return () => problems;
}

/** Fails on serious or critical WCAG A/AA problems on the current page, naming each element */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => {
      const nodes = violation.nodes.slice(0, 5).map((node) => {
        const why = (node.failureSummary ?? '').split('\n').slice(1).join(' ');
        return `  ${node.target.join(' ')}: ${why}`;
      });
      return [`${violation.id}: ${violation.help}`, ...nodes].join('\n');
    });
  expect(serious, `${page.url()}\n${serious.join('\n')}`).toEqual([]);
}

/**
 * Opens a section through the app's own navigation, as a person would. A full page load per
 * section would fetch a new session each time and soon meet the API's limit on those.
 */
export async function openSection(page: Page, path: string): Promise<void> {
  const menuButton = page.getByRole('button', { name: /open menu/i });
  const scope = (await menuButton.isVisible())
    ? (await menuButton.click(), page.getByRole('dialog'))
    : page.getByRole('navigation', { name: 'App' }).first();
  await scope.locator(`a[href="${path}"]`).first().click();
  await page.waitForURL(`**${path}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The new page's title arrives with its data, just after the address changes
  await expect(page).toHaveTitle(/\S.* · Vargly$/);
}
