'use client';

import { Hammer, Lock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { NAV_ITEMS, type NavKey } from './nav-config';

/** Placeholder for a section that is in the navigation but not built yet */
export function ComingSoon({ navKey }: { navKey: NavKey }) {
  const t = useTranslations('Shell');
  const user = useSession()?.user;
  const item = NAV_ITEMS.find((nav) => nav.key === navKey);
  const title = t(`nav.${navKey}`);

  if (item?.permission && !can(user, item.permission)) {
    return (
      <StatePanel icon={<Lock className="size-5" aria-hidden />} title={t('noAccess.title')}>
        <p>{t('noAccess.body')}</p>
      </StatePanel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <StatePanel icon={<Hammer className="size-5" aria-hidden />} title={t('comingSoon.title')}>
        <p>{t('comingSoon.body', { section: title })}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/app">{t('comingSoon.back')}</Link>
        </Button>
      </StatePanel>
    </div>
  );
}
