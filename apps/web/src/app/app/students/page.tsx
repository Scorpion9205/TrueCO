import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentsPage } from '@/components/students/students-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('students') };
}

export default function Page() {
  return <StudentsPage />;
}
