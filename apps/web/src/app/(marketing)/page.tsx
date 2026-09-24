import { Cta } from '@/components/marketing/cta';
import { Features } from '@/components/marketing/features';
import { Hero } from '@/components/marketing/hero';
import { Highlights } from '@/components/marketing/highlights';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Pricing } from '@/components/marketing/pricing';
import { startingPrice } from '@/lib/plans';
import { getPublicPlans } from '@/lib/plans.server';

// Static page, rebuilt at most hourly so plan prices stay current (matches PLANS_REVALIDATE_SECONDS)
export const revalidate = 3600;

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Highlights startingPrice={startingPrice(plans)} />
      {/* Pricing comes from the API; without plans the section is left out, not shown empty */}
      {plans.length > 0 ? <Pricing plans={plans} /> : <div className="h-16 sm:h-24" />}
      <Cta />
    </>
  );
}
