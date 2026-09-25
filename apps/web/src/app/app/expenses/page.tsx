import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ExpensesPage } from '@/components/money/expenses-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('expenses') };
}

export default function Page() {
  return <ExpensesPage />;
}
