import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TeachersPage } from '@/components/teachers/teachers-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('teachers') };
}

export default function Page() {
  return <TeachersPage />;
}
