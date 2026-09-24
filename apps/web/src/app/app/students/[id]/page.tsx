import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentDetail } from '@/components/students/student-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('students') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetail id={id} />;
}
