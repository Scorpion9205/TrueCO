import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HomeworkPage } from '@/components/homework/homework-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('homework') };
}

export default function Page() {
  return <HomeworkPage />;
}
