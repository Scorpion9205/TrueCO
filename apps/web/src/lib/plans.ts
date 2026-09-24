/** GET /billing/plans item (apps/api BillingMapper.toPlanDto) */
export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  defaultFeatures: string[];
  defaultCredits: number;
}

/** A plan without a price is sold by quote ("Talk to us") */
export function isCustomPriced(plan: PublicPlan): boolean {
  return !(plan.priceMonthly > 0);
}

/** Cheapest first, quote-only plans last */
export function sortPlans(plans: PublicPlan[]): PublicPlan[] {
  return [...plans].sort((a, b) => {
    if (isCustomPriced(a) !== isCustomPriced(b)) return isCustomPriced(a) ? 1 : -1;
    return a.priceMonthly - b.priceMonthly;
  });
}

/** Lowest paid monthly price, for "from ₹X a month" copy */
export function startingPrice(plans: PublicPlan[]): number | null {
  const paid = plans.filter((plan) => !isCustomPriced(plan)).map((plan) => plan.priceMonthly);
  return paid.length ? Math.min(...paid) : null;
}
