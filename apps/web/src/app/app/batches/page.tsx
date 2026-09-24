import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BatchesPage } from '@/components/batches/batches-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('batches') };
}

export default function Page() {
  return <BatchesPage />;
}
