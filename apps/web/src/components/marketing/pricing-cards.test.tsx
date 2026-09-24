import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PublicPlan } from '@/lib/plans';
import { renderWithIntl } from '@/test/render';
import { PricingCards } from './pricing-cards';

// Mirrors the plans seeded by apps/api init-rbac.ts, already sorted as the page sorts them
const plans: PublicPlan[] = [
  {
    id: '1',
    code: 'STARTER',
    name: 'Starter Plan',
    priceMonthly: 999,
    priceYearly: 9990,
    defaultFeatures: ['core', 'attendance', 'fees', 'reports'],
    defaultCredits: 100,
  },
  {
    id: '2',
    code: 'PRO_AI',
    name: 'Pro AI Suite',
    priceMonthly: 1999,
    priceYearly: 19990,
    defaultFeatures: [
      'core',
      'attendance',
      'fees',
      'reports',
      'homework',
      'ai.risk_engine',
      'brand.new_code',
    ],
    defaultCredits: 500,
  },
  {
    id: '3',
    code: 'ENTERPRISE',
    name: 'Enterprise Pro AI Bundle',
    priceMonthly: 0,
    priceYearly: 0,
    defaultFeatures: ['core', 'salary'],
    defaultCredits: 1000,
  },
];

const card = (name: string) => screen.getByRole('listitem', { name });

describe('PricingCards', () => {
  it('shows monthly prices and highlights Pro AI', () => {
    renderWithIntl(<PricingCards plans={plans} />);

    expect(within(card('Starter Plan')).getByText('₹999')).toBeInTheDocument();
    expect(within(card('Pro AI Suite')).getByText('Most popular')).toBeInTheDocument();
    expect(within(card('Starter Plan')).queryByText('Most popular')).toBeNull();
    expect(
      within(card('Starter Plan')).getByRole('link', { name: 'Start free trial' }),
    ).toHaveAttribute('href', '/signup?plan=STARTER');
  });

  it('switches to yearly prices with the saving', async () => {
    renderWithIntl(<PricingCards plans={plans} />);

    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

    expect(screen.getByRole('button', { name: 'Yearly' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card('Pro AI Suite')).getByText('₹19,990')).toBeInTheDocument();
    // 12 x 1,999 - 19,990
    expect(within(card('Pro AI Suite')).getByText('Save ₹3,998')).toBeInTheDocument();
  });

  it('lists only what a plan adds, and skips feature codes without copy', () => {
    renderWithIntl(<PricingCards plans={plans} />);
    const pro = card('Pro AI Suite');

    expect(within(pro).getByText('Everything in Starter Plan, plus:')).toBeInTheDocument();
    expect(within(pro).getByText('At-risk student alerts')).toBeInTheDocument();
    expect(within(pro).queryByText('Attendance')).toBeNull();
    expect(within(pro).queryByText(/brand/)).toBeNull();
    expect(within(pro).getByText('500 AI credits')).toBeInTheDocument();
  });

  it('sells unpriced plans by contact instead of showing ₹0', () => {
    renderWithIntl(<PricingCards plans={plans} />);
    const enterprise = card('Enterprise Pro AI Bundle');

    expect(within(enterprise).getByText('Custom')).toBeInTheDocument();
    expect(within(enterprise).queryByText('₹0')).toBeNull();
    expect(
      within(enterprise).getByRole('link', { name: 'Talk to us' }).getAttribute('href'),
    ).toMatch(/^mailto:/);
  });
});
