import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TestDetail } from '@/components/tests/test-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('tests') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestDetail id={id} />;
}
