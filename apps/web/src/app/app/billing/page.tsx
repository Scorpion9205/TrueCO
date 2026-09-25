import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BillingPage } from '@/components/billing/billing-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Shell.nav');
  return { title: t('billing') };
}

export default function Page() {
  return <BillingPage />;
}
