import { createApiClient } from '@vargly/api-client';
import { cache } from 'react';
import { API_URL } from './api';
import { sortPlans, type PublicPlan } from './plans';

// Server components only: uses Next's data cache. Client code imports from ./plans.

/** Plans are re-read at most once an hour; a price change shows up without a redeploy. */
export const PLANS_REVALIDATE_SECONDS = 3600;

const plansApi = createApiClient({
  baseUrl: API_URL,
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      next: { revalidate: PLANS_REVALIDATE_SECONDS },
      // A slow or stopped API must not stall the page (or the build)
      signal: init?.signal ?? AbortSignal.timeout(4000),
    }),
});

/**
 * Public plans for the pricing section, or [] when the API cannot be reached. The site hides
 * pricing rather than failing the page, so marketing pages stay up during an API outage.
 */
export const getPublicPlans = cache(async (): Promise<PublicPlan[]> => {
  try {
    const plans = await plansApi.get<PublicPlan[]>('/billing/plans');
    return Array.isArray(plans) ? sortPlans(plans) : [];
  } catch (error) {
    console.warn(
      'Pricing hidden: could not load plans:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
});
