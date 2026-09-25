import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReportsPage } from '@/components/reports/reports-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('reports') };
}

export default function Page() {
  return <ReportsPage />;
}
