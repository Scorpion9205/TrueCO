import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthHeading } from '@/components/auth/auth-heading';
import { SignupForm } from '@/components/auth/signup-form';
import { TRIAL_DAYS } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.signup');
  return { title: t('metaTitle') };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('Auth.signup');
  const { email } = await searchParams;

  return (
    <>
      <AuthHeading title={t('title', { days: TRIAL_DAYS })} subtitle={t('subtitle')} />
      {/* ?email= comes from the landing page's "Get started" form */}
      <SignupForm defaultEmail={typeof email === 'string' ? email : undefined} />
    </>
  );
}
