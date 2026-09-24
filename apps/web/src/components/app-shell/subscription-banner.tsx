'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CoachingProfile } from '@/lib/api-types';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

/** Trials show a countdown in their last two weeks */
export const TRIAL_REMINDER_DAYS = 14;

type Banner = { tone: 'info' | 'warning' | 'danger'; message: string } | null;

/**
 * Tells the institute where its subscription stands before features stop working. Only people
 * who can manage billing get the "choose a plan" link; others are told who to ask.
 */
export function SubscriptionBanner({
  subscription,
}: {
  subscription: CoachingProfile['subscription'];
}) {
  const t = useTranslations('Shell.subscription');
  const canManage = can(useSession()?.user, 'billing:manage');
  const banner = bannerFor(subscription, t);
  if (!banner) return null;

  return (
    <div
      role={banner.tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-center text-sm font-medium',
        banner.tone === 'info' && 'bg-brand-soft text-accent-foreground',
        banner.tone === 'warning' && 'bg-warning/15 text-foreground',
        banner.tone === 'danger' && 'bg-destructive text-destructive-foreground',
      )}
    >
      <span>{banner.message}</span>
      {canManage ? (
        <Link href="/app/billing" className="font-semibold underline underline-offset-4">
          {t('choosePlan')}
        </Link>
      ) : (
        <span className="opacity-80">{t('askOwner')}</span>
      )}
    </div>
  );
}

function bannerFor(
  subscription: CoachingProfile['subscription'],
  t: ReturnType<typeof useTranslations<'Shell.subscription'>>,
): Banner {
  switch (subscription.status) {
    case 'TRIALING':
      return subscription.daysRemaining <= TRIAL_REMINDER_DAYS
        ? { tone: 'info', message: t('trialEnding', { days: subscription.daysRemaining }) }
        : null;
    case 'PAST_DUE':
    case 'GRACE':
      return { tone: 'warning', message: t('grace') };
    case 'EXPIRED':
    case 'CANCELLED':
      return { tone: 'danger', message: t('expired') };
    default:
      return null;
  }
}
