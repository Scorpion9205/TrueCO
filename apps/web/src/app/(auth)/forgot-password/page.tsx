import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthHeading } from '@/components/auth/auth-heading';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.forgot');
  return { title: t('metaTitle') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Auth.forgot');
  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      <ForgotPasswordForm />
    </>
  );
}
