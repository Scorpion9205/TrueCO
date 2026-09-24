import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthHeading } from '@/components/auth/auth-heading';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Alert } from '@/components/ui/alert';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.reset');
  // The URL carries a one-time token: never pass it on to other sites as the referrer
  return { title: t('metaTitle'), referrer: 'no-referrer' };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Opened from the link in the password reset email: /reset-password?token=... */
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('Auth.reset');
  const { token } = await searchParams;

  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      {typeof token === 'string' && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-6">
          <Alert tone="danger">{t('missingToken')}</Alert>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t('requestNew')}
          </Link>
        </div>
      )}
    </>
  );
}
