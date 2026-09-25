import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TestsPage } from '@/components/tests/tests-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('tests') };
}

export default function Page() {
  return <TestsPage />;
}
