'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { isCustomPriced, type PublicPlan } from '@/lib/plans';
import { CONTACT_EMAIL } from '@/lib/site';
import { cn } from '@/lib/utils';

type Period = 'monthly' | 'yearly';

/** Message key for a plan feature code: next-intl reserves "." for nesting ("ai.summary" -> "ai_summary") */
const featureKey = (code: string) => code.replaceAll('.', '_');

/** The plan to highlight: Pro AI when offered, otherwise the middle one */
function popularIndex(plans: PublicPlan[]): number {
  const pro = plans.findIndex((plan) => plan.code === 'PRO_AI');
  return pro >= 0 ? pro : Math.floor((plans.length - 1) / 2);
}

export function PricingCards({ plans }: { plans: PublicPlan[] }) {
  const t = useTranslations('Pricing');
  const [period, setPeriod] = useState<Period>('monthly');
  const popular = popularIndex(plans);

  // Only list features we have copy for, so a new backend code never shows as a raw key
  const knownFeatures = (plan: PublicPlan) =>
    plan.defaultFeatures.filter((code) => t.has(`feature.${featureKey(code)}`));

  return (
    <div className="mt-10 flex flex-col items-center gap-10">
      <div
        role="group"
        aria-label={t('billingPeriod')}
        className="inline-flex rounded-full border bg-muted p-1"
      >
        {(['monthly', 'yearly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-semibold transition-colors',
              period === value
                ? 'bg-background text-foreground shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(value)}
          </button>
        ))}
      </div>

      <ul className="grid w-full items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const highlighted = index === popular;
          const custom = isCustomPriced(plan);
          const previous = index > 0 ? plans[index - 1] : undefined;
          const inherited = new Set(previous ? knownFeatures(previous) : []);
          const features = knownFeatures(plan).filter((code) => !inherited.has(code));
          const yearlySaving = plan.priceMonthly * 12 - plan.priceYearly;

          return (
            <li
              key={plan.id}
              aria-label={plan.name}
              className={cn(
                'relative flex flex-col rounded-xl border bg-card p-6 shadow-card sm:p-8',
                highlighted && 'border-2 border-primary shadow-float lg:-my-4 lg:py-12',
              )}
            >
              {highlighted ? (
                <Badge
                  tone="brand"
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground"
                >
                  {t('popular')}
                </Badge>
              ) : null}

              <h3 className="text-lg font-bold">{plan.name}</h3>

              <div className="mt-4 min-h-20">
                {custom ? (
                  <>
                    <p className="text-4xl font-extrabold tracking-tight">{t('custom')}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t('customNote')}</p>
                  </>
                ) : (
                  <>
                    <p className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {formatCurrency(
                          period === 'monthly' ? plan.priceMonthly : plan.priceYearly,
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {period === 'monthly' ? t('perMonth') : t('perYear')}
                      </span>
                    </p>
                    {period === 'yearly' && yearlySaving > 0 ? (
                      <p className="mt-2 text-sm font-semibold text-success">
                        {t('save', { amount: formatCurrency(yearlySaving) })}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
                {previous ? (
                  <li className="font-semibold">{t('everythingIn', { plan: previous.name })}</li>
                ) : null}
                {features.map((code) => (
                  <li key={code} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {t(`feature.${featureKey(code)}`)}
                  </li>
                ))}
                {plan.defaultCredits > 0 ? (
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {t('credits', { count: plan.defaultCredits })}
                  </li>
                ) : null}
              </ul>

              <Button
                asChild
                size="lg"
                variant={highlighted ? 'primary' : 'outline'}
                className="mt-8 w-full"
              >
                {custom ? (
                  <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(plan.name)}`}>
                    {t('contact')}
                  </a>
                ) : (
                  <Link href={`/signup?plan=${encodeURIComponent(plan.code)}`}>{t('start')}</Link>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
