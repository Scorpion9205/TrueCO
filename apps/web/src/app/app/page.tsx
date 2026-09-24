import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardHome } from '@/components/dashboard/dashboard-home';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('dashboard') };
}

export default function AppHomePage() {
  return <DashboardHome />;
}
