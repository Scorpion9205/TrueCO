import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthHeading } from '@/components/auth/auth-heading';
import { LoginForm, type LoginNotice } from '@/components/auth/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.login');
  return { title: t('metaTitle') };
}

const NOTICES: ReadonlyArray<LoginNotice> = ['expired', 'registered', 'reset'];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('Auth.login');
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === 'string' ? params[key] : undefined);
  const notice = NOTICES.find((n) => n === one('notice'));

  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      <LoginForm next={one('next')} notice={notice} defaultEmail={one('email')} />
    </>
  );
}
