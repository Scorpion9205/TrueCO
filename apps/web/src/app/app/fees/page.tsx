import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeesPage } from '@/components/fees/fees-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('fees') };
}

export default function Page() {
  return <FeesPage />;
}
