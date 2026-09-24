import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './api';
import { type PublicPlan, sortPlans, startingPrice } from './plans';

const plan = (code: string, priceMonthly: number): PublicPlan => ({
  id: code,
  code,
  name: code,
  priceMonthly,
  priceYearly: priceMonthly * 10,
  defaultFeatures: [],
  defaultCredits: 0,
});

describe('plan helpers', () => {
  it('sorts cheapest first with quote-only plans last', () => {
    const sorted = sortPlans([plan('ENTERPRISE', 0), plan('PRO_AI', 1999), plan('STARTER', 999)]);
    expect(sorted.map((p) => p.code)).toEqual(['STARTER', 'PRO_AI', 'ENTERPRISE']);
  });

  it('finds the lowest paid price', () => {
    expect(startingPrice([plan('ENTERPRISE', 0), plan('PRO_AI', 1999), plan('STARTER', 999)])).toBe(
      999,
    );
    expect(startingPrice([plan('ENTERPRISE', 0)])).toBeNull();
  });
});

describe('getPublicPlans', () => {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => vi.resetModules());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns the API plans, sorted', async () => {
    server.use(
      http.get(`${API_URL}/billing/plans`, () =>
        HttpResponse.json({ data: [plan('PRO_AI', 1999), plan('STARTER', 999)] }),
      ),
    );
    const { getPublicPlans } = await import('./plans.server');

    expect((await getPublicPlans()).map((p) => p.code)).toEqual(['STARTER', 'PRO_AI']);
  });

  it('returns no plans (so pricing is hidden) when the API is down', async () => {
    server.use(
      http.get(`${API_URL}/billing/plans`, () => HttpResponse.json({ error: {} }, { status: 503 })),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getPublicPlans } = await import('./plans.server');

    await expect(getPublicPlans()).resolves.toEqual([]);
  });
});
