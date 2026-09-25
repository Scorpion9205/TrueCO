import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AttendancePage } from '@/components/attendance/attendance-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('attendance') };
}

export default function Page() {
  return <AttendancePage />;
}
