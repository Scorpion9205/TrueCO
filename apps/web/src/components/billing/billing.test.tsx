import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from '@/lib/api';
import { __resetSessionForTests } from '@/lib/auth/session';
import { type BillingPayment, creditsPrice, type Subscription } from '@/lib/billing';
import type { PublicPlan } from '@/lib/plans';
import { renderWithIntl } from '@/test/render';
import { OWNER, signInAs } from '@/test/session';
import { BillingPage } from './billing-page';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => __resetSessionForTests());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const plans: PublicPlan[] = [
  {
    id: 'p1',
    code: 'STARTER',
    name: 'Starter Plan',
    priceMonthly: 999,
    priceYearly: 9990,
    defaultFeatures: ['core'],
    defaultCredits: 100,
  },
  {
    id: 'p2',
    code: 'PRO_AI',
    name: 'Pro AI Suite',
    priceMonthly: 1999,
    priceYearly: 19990,
    defaultFeatures: ['core', 'ai.summary'],
    defaultCredits: 500,
  },
  {
    id: 'p3',
    code: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    defaultFeatures: ['core'],
    defaultCredits: 1000,
  },
];

const trial: Subscription = {
  id: 's1',
  planCode: 'ENTERPRISE',
  planName: 'Enterprise',
  status: 'TRIALING',
  trialEndsAt: '2026-11-01T00:00:00.000Z',
  trialDaysRemaining: 37,
  currentPeriodEnd: '2026-11-01T00:00:00.000Z',
  gracePeriodEndsAt: null,
  isGracePeriod: false,
  features: [],
  aiCreditBalance: 1000,
  aiCreditPricePaise: 100,
};

const paid: BillingPayment = {
  id: 'bp1',
  orderId: 'order_1',
  type: 'PLAN_UPGRADE',
  status: 'PAID',
  planCode: 'PRO_AI',
  billingCycle: 'YEARLY',
  credits: null,
  amount: 19990,
  invoiceNumber: 'INV/2026-27/00001',
  paidAt: '2026-09-25T06:00:00.000Z',
  createdAt: '2026-09-25T06:00:00.000Z',
};

function billingApi(subscription: Subscription, payments: BillingPayment[] = []) {
  const state = { subscription, payments: [...payments] };
  const orders: unknown[] = [];
  server.use(
    http.get(`${API_URL}/billing/subscription`, () =>
      HttpResponse.json({ data: state.subscription }),
    ),
    http.get(`${API_URL}/billing/plans`, () => HttpResponse.json({ data: plans })),
    http.get(`${API_URL}/billing/payments`, () => HttpResponse.json({ data: state.payments })),
    http.get(`${API_URL}/coachings/me`, () =>
      HttpResponse.json({
        data: { id: 'c1', name: 'Sharma Classes', code: 'sharma', phone: '9876543210' },
      }),
    ),
    http.post(`${API_URL}/billing/orders`, async ({ request }) => {
      orders.push(await request.json());
      return HttpResponse.json(
        {
          data: {
            orderId: 'order_mock_1',
            amount: 19990,
            currency: 'INR',
            receipt: 'r',
            mock: true,
          },
        },
        { status: 201 },
      );
    }),
    http.post(`${API_URL}/billing/orders/:orderId/simulate-payment`, ({ params }) => {
      state.subscription = {
        ...state.subscription,
        status: 'ACTIVE',
        planCode: 'PRO_AI',
        planName: 'Pro AI Suite',
      };
      state.payments = [{ ...paid, orderId: String(params.orderId) }];
      return HttpResponse.json({ data: { status: 'PROCESSED' } });
    }),
  );
  return orders;
}

describe('BillingPage', () => {
  it('shows the trial, credits and plans, with quote-only plans as a contact link', async () => {
    billingApi(trial);
    signInAs(OWNER);
    renderWithIntl(<BillingPage />);

    expect(await screen.findByText('Free trial')).toBeInTheDocument();
    expect(screen.getByText(/37 days left in your free trial/)).toBeInTheDocument();
    const balance = screen.getByText('AI credits', { selector: 'p' }).parentElement!;
    expect(within(balance).getByText('1,000')).toBeInTheDocument();
    const pro = await screen.findByRole('listitem', { name: 'Pro AI Suite' });
    expect(within(pro).getByRole('button', { name: 'Choose plan' })).toBeEnabled();
    const enterprise = screen.getByRole('listitem', { name: 'Enterprise' });
    expect(within(enterprise).getByRole('link', { name: 'Talk to us' })).toBeInTheDocument();
    expect(
      screen.getByText('No payments yet. Your invoices will be listed here.'),
    ).toBeInTheDocument();
  });

  it('buys a yearly plan and, without Razorpay keys, can mark it paid in development', async () => {
    const orders = billingApi(trial);
    signInAs(OWNER);
    renderWithIntl(<BillingPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Yearly' }));
    const pro = screen.getByRole('listitem', { name: 'Pro AI Suite' });
    await userEvent.click(within(pro).getByRole('button', { name: 'Choose plan' }));

    const dialog = await screen.findByRole('dialog', {
      name: "Online payments aren't connected yet",
    });
    expect(orders).toEqual([{ type: 'PLAN_UPGRADE', planCode: 'PRO_AI', billingCycle: 'YEARLY' }]);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Mark as paid (development)' }),
    );

    // The page refreshes from the API: now an active plan with a paid invoice
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(await screen.findByText(/INV\/2026-27\/00001/)).toBeInTheDocument();
    expect(screen.getByText('Pro AI Suite · 1 year')).toBeInTheDocument();
  });

  it('buys a pack of AI credits at the server price', async () => {
    const orders = billingApi(trial);
    signInAs(OWNER);
    renderWithIntl(<BillingPage />);

    await userEvent.click(await screen.findByRole('radio', { name: /1,000/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Buy 1,000 credits for ₹1,000' }));
    await waitFor(() => expect(orders).toEqual([{ type: 'AI_CREDITS', credits: 1000 }]));
  });

  it('warns when payment is overdue and lists past invoices', async () => {
    billingApi(
      {
        ...trial,
        status: 'GRACE',
        planCode: 'STARTER',
        planName: 'Starter Plan',
        gracePeriodEndsAt: '2026-10-05T00:00:00.000Z',
      },
      [paid],
    );
    signInAs(OWNER);
    renderWithIntl(<BillingPage />);

    expect(await screen.findByText(/Payment is overdue/)).toBeInTheDocument();
    expect(screen.getByText('INV/2026-27/00001', { exact: false })).toBeInTheDocument();
  });

  it('offers renewal of the plan already paid for', async () => {
    billingApi({ ...trial, status: 'ACTIVE', planCode: 'PRO_AI', planName: 'Pro AI Suite' });
    signInAs(OWNER);
    renderWithIntl(<BillingPage />);

    const pro = await screen.findByRole('listitem', { name: 'Pro AI Suite' });
    expect(within(pro).getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'Starter Plan' })).getByRole('button', {
        name: 'Choose plan',
      }),
    ).toBeInTheDocument();
  });

  it('lets staff see billing without buying', async () => {
    billingApi(trial);
    signInAs({ ...OWNER, permissions: ['billing:read'] });
    renderWithIntl(<BillingPage />);

    const pro = await screen.findByRole('listitem', { name: 'Pro AI Suite' });
    expect(within(pro).getByRole('button', { name: 'Choose plan' })).toBeDisabled();
    expect(
      screen.getByText('Only the institute owner can change the plan or buy credits.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buy .* credits/ })).toBeNull();
  });
});

describe('billing helpers', () => {
  it('prices credits from paise', () => {
    expect(creditsPrice(500, 100)).toBe(500);
    expect(creditsPrice(100, 150)).toBe(150);
  });
});
