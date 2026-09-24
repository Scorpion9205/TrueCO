'use client';

import { isApiError } from '@trueco/api-client';
import { CircleAlert, Lock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

/**
 * What a page shows when its data could not load. A 402 means the subscription stopped the
 * request, which retrying cannot fix, so it points to billing instead of offering a retry.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations('Common');
  const canManageBilling = can(useSession()?.user, 'billing:manage');

  if (isApiError(error) && error.isPaymentRequired) {
    return (
      <StatePanel icon={<Lock className="size-5" aria-hidden />} title={t('paymentRequired.title')}>
        <p>{canManageBilling ? t('paymentRequired.owner') : t('paymentRequired.staff')}</p>
        {canManageBilling ? (
          <Button asChild className="mt-2">
            <Link href="/app/billing">{t('paymentRequired.action')}</Link>
          </Button>
        ) : null}
      </StatePanel>
    );
  }

  const offline = isApiError(error) && error.status === 0;
  return (
    <StatePanel
      icon={<CircleAlert className="size-5" aria-hidden />}
      title={t('error.title')}
      role="alert"
    >
      <p>{offline ? t('error.offline') : t('error.body')}</p>
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        {t('retry')}
      </Button>
    </StatePanel>
  );
}
