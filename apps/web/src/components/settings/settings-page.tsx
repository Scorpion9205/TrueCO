'use client';

import { useTranslations } from 'next-intl';
import { QueryError } from '@/components/dashboard/query-error';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useCoachingProfile } from '@/lib/queries';
import { AccountSection } from './account-section';
import { InstituteSection } from './institute-section';
import { PreferencesSection } from './preferences-section';

/**
 * Everyone manages their own account here; the institute's details and preferences are shown
 * to those who can read settings and editable by those who can manage them.
 */
export function SettingsPage() {
  const t = useTranslations('Settings');
  const user = useSession()?.user;
  const profile = useCoachingProfile();
  const canRead = can(user, 'settings:read');
  const canManage = can(user, 'settings:manage');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t('title')} />
      {canRead ? (
        profile.isPending ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : profile.isError ? (
          <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (
          <InstituteSection profile={profile.data} canManage={canManage} />
        )
      ) : null}
      {canRead ? <PreferencesSection canManage={canManage} /> : null}
      {user ? <AccountSection user={user} /> : null}
    </div>
  );
}
