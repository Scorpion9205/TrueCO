import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const OWNER_STATE = 'e2e/.auth/owner.json';

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
