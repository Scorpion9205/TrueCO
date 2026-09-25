import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SalaryPage } from '@/components/money/salary-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('salary') };
}

export default function Page() {
  return <SalaryPage />;
}
