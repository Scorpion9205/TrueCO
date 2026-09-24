import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BatchDetail } from '@/components/batches/batch-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('batches') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchDetail id={id} />;
}
