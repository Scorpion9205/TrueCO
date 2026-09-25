import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NoticesPage } from '@/components/notices/notices-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('notices') };
}

export default function Page() {
  return <NoticesPage />;
}
