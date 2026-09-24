import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { getPublicPlans } from '@/lib/plans.server';

export default async function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Deduplicated with the page's own call; decides whether "Pricing" appears in the nav
  const showPricing = (await getPublicPlans()).length > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader showPricing={showPricing} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter showPricing={showPricing} />
    </div>
  );
}
