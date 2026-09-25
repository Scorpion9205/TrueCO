import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReceiptView } from '@/components/fees/receipt-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Fees.receipt');
  return { title: t('title') };
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** /app/fees/receipts/<transaction id>?student=<student id> */
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { student } = await searchParams;
  return <ReceiptView transactionId={id} studentId={typeof student === 'string' ? student : ''} />;
}
