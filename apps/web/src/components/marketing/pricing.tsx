import { getTranslations } from 'next-intl/server';
import type { PublicPlan } from '@/lib/plans';
import { TRIAL_DAYS } from '@/lib/site';
import { PricingCards } from './pricing-cards';
import { SectionHeading } from './section-heading';

export async function Pricing({ plans }: { plans: PublicPlan[] }) {
  const t = await getTranslations('Pricing');

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-muted/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          id="pricing-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle', { days: TRIAL_DAYS })}
        />
        <PricingCards plans={plans} />
      </div>
    </section>
  );
}
