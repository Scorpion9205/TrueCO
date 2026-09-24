import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthHeading } from '@/components/auth/auth-heading';
import { VerifyEmail } from '@/components/auth/verify-email';
import { Alert } from '@/components/ui/alert';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.verify');
  // The URL carries a one-time token: never pass it on to other sites as the referrer
  return { title: t('metaTitle'), referrer: 'no-referrer' };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Opened from the link in the verification email: /verify-email?token=... */
export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('Auth.verify');
  const { token } = await searchParams;

  return (
    <>
      <AuthHeading title={t('metaTitle')} />
      {typeof token === 'string' && token ? (
        <VerifyEmail token={token} />
      ) : (
        <Alert tone="danger">{t('missingToken')}</Alert>
      )}
    </>
  );
}
