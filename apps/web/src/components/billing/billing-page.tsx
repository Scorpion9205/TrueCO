'use client';

import { CalendarClock, Loader2, Receipt, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import type { SubscriptionStatus } from '@/lib/api-types';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import {
  type BillingPayment,
  CREDIT_PACKS,
  creditsPrice,
  type Subscription,
  useBillingPayments,
  usePlans,
  useSubscription,
} from '@/lib/billing';
import { formatCurrency, formatDate } from '@/lib/format';
import { type PublicPlan, sortPlans } from '@/lib/plans';
import { cn } from '@/lib/utils';
import { usePurchase } from './use-purchase';

const STATUS_TONE: Record<SubscriptionStatus, BadgeProps['tone']> = {
  TRIALING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  GRACE: 'warning',
  EXPIRED: 'danger',
  CANCELLED: 'neutral',
};

export function BillingPage() {
  const t = useTranslations('Billing');
  const canManage = can(useSession()?.user, 'billing:manage');
  const subscription = useSubscription();
  const plans = usePlans();
  const payments = useBillingPayments();
  const purchase = usePurchase();

  if (subscription.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <PageHeader title={t('title')} />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (subscription.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} />
        <QueryError error={subscription.error} onRetry={() => void subscription.refetch()} />
      </div>
    );
  }
  const sub = subscription.data;
  const paidUp = sub.status === 'ACTIVE';

  const planAction = (plan: PublicPlan, period: 'monthly' | 'yearly', highlighted: boolean) => {
    const cycle = period === 'monthly' ? 'MONTHLY' : 'YEARLY';
    const key = `${plan.code}-${cycle}`;
    const current = paidUp && plan.code === sub.planCode;
    const label = t('planItem', {
      plan: plan.name,
      cycle: t(`cycle.${cycle}`),
    });
    return (
      <Button
        size="lg"
        variant={highlighted ? 'primary' : 'outline'}
        className="w-full"
        disabled={!canManage || purchase.busy !== null}
        aria-busy={purchase.busy === key}
        onClick={() =>
          void purchase.buy(
            { type: 'PLAN_UPGRADE', planCode: plan.code, billingCycle: cycle },
            label,
            key,
          )
        }
      >
        {purchase.busy === key ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {current ? t('renew') : t('choose')}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <CurrentPlan sub={sub} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t('plansTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {canManage ? t('plansBody') : t('ownerOnly')}
        </p>
        {plans.isPending ? (
          <Skeleton className="mt-6 h-96 rounded-xl" />
        ) : plans.isError ? (
          <QueryError error={plans.error} onRetry={() => void plans.refetch()} />
        ) : (
          <PricingCards plans={sortPlans(plans.data)} action={planAction} />
        )}
      </section>

      {sub.aiCreditPricePaise > 0 ? (
        <Credits sub={sub} canManage={canManage} purchase={purchase} />
      ) : null}

      <History
        payments={payments.data}
        plans={plans.data ?? []}
        loading={payments.isPending}
        error={payments.error}
        onRetry={() => void payments.refetch()}
      />

      {purchase.dialogs}
    </div>
  );
}

function CurrentPlan({ sub }: { sub: Subscription }) {
  const t = useTranslations('Billing.current');
  const when = (() => {
    switch (sub.status) {
      case 'TRIALING':
        return t('trial', { days: sub.trialDaysRemaining, date: formatDate(sub.trialEndsAt) });
      case 'ACTIVE':
        return t('active', { date: formatDate(sub.currentPeriodEnd) });
      case 'GRACE':
      case 'PAST_DUE':
        return t('grace', { date: formatDate(sub.gracePeriodEndsAt ?? sub.currentPeriodEnd) });
      default:
        return t('ended');
    }
  })();

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-[1fr_auto] sm:p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t('label')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-extrabold">{sub.planName}</h2>
          <Badge tone={STATUS_TONE[sub.status]}>{t(`status.${sub.status}`)}</Badge>
        </div>
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
            sub.status === 'ACTIVE' || sub.status === 'TRIALING'
              ? 'text-muted-foreground'
              : 'font-medium text-destructive',
          )}
        >
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {when}
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-brand-soft px-4 py-3 sm:self-center">
        <Sparkles className="size-5 text-primary" aria-hidden />
        <div>
          <p className="text-xs text-muted-foreground">{t('credits')}</p>
          <p className="text-xl font-bold tabular-nums">
            {sub.aiCreditBalance.toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </section>
  );
}

function Credits({
  sub,
  canManage,
  purchase,
}: {
  sub: Subscription;
  canManage: boolean;
  purchase: ReturnType<typeof usePurchase>;
}) {
  const t = useTranslations('Billing.credits');
  const [credits, setCredits] = useState<number>(CREDIT_PACKS[1]);
  const price = creditsPrice(credits, sub.aiCreditPricePaise);
  const key = `credits-${credits}`;

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div>
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t('pack')}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {CREDIT_PACKS.map((pack) => (
          <button
            key={pack}
            type="button"
            role="radio"
            aria-checked={credits === pack}
            onClick={() => setCredits(pack)}
            className={cn(
              'flex flex-col items-center rounded-lg border px-3 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              credits === pack ? 'border-primary bg-brand-soft' : 'hover:bg-muted',
            )}
          >
            <span className="font-bold tabular-nums">{pack.toLocaleString('en-IN')}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(creditsPrice(pack, sub.aiCreditPricePaise))}
            </span>
          </button>
        ))}
      </div>
      {canManage ? (
        <Button
          className="self-start"
          disabled={purchase.busy !== null}
          aria-busy={purchase.busy === key}
          onClick={() =>
            void purchase.buy({ type: 'AI_CREDITS', credits }, t('item', { count: credits }), key)
          }
        >
          {purchase.busy === key ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t('buy', { count: credits, price: formatCurrency(price) })}
        </Button>
      ) : null}
    </section>
  );
}

function History({
  payments,
  plans,
  loading,
  error,
  onRetry,
}: {
  payments?: BillingPayment[];
  plans: PublicPlan[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useTranslations('Billing');
  const planName = (code?: string | null) =>
    plans.find((plan) => plan.code === code)?.name ?? code ?? '';

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{t('history.title')}</h2>
      {loading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : !payments?.length ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('history.empty')}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Receipt className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">
                    {payment.type === 'PLAN_UPGRADE'
                      ? t('planItem', {
                          plan: planName(payment.planCode),
                          cycle: t(`cycle.${payment.billingCycle ?? 'MONTHLY'}`),
                        })
                      : t('credits.item', { count: payment.credits ?? 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDate(payment.paidAt ?? payment.createdAt), payment.invoiceNumber]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-7 sm:pl-0">
                <span className="font-semibold tabular-nums">{formatCurrency(payment.amount)}</span>
                <Badge tone={payment.status === 'PAID' ? 'success' : 'danger'}>
                  {t(`history.status.${payment.status}`)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
