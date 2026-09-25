'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { useStudentFees } from '@/lib/fees';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { rupeesInWords } from '@/lib/money-words';
import { useCoachingProfile } from '@/lib/queries';

/**
 * A printable fee receipt. The API has no single-receipt endpoint, so it is found among the
 * student's fee plans (which carry every payment).
 */
export function ReceiptView({
  transactionId,
  studentId,
}: {
  transactionId: string;
  studentId: string;
}) {
  const t = useTranslations('Fees.receipt');
  const methods = useTranslations('Fees.method');
  const fees = useStudentFees(studentId, Boolean(studentId));
  const institute = useCoachingProfile();

  const back = (
    <Link
      href={studentId ? `/app/students/${studentId}#fees` : '/app/fees'}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('back')}
    </Link>
  );

  if (fees.isPending && studentId) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {back}
        <Skeleton className="mx-auto h-[28rem] w-full max-w-2xl rounded-xl" />
      </div>
    );
  }
  if (fees.isError) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <QueryError error={fees.error} onRetry={() => void fees.refetch()} />
      </div>
    );
  }

  const match = (fees.data ?? [])
    .flatMap((plan) =>
      (plan.installments ?? []).flatMap((installment) =>
        (installment.transactions ?? []).map((transaction) => ({ plan, installment, transaction })),
      ),
    )
    .find((entry) => entry.transaction.id === transactionId);

  if (!match) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <StatePanel icon={<Printer className="size-5" aria-hidden />} title={t('notFound')} />
      </div>
    );
  }

  const { plan, installment, transaction } = match;
  const rows: Array<[string, string]> = [
    [t('student'), plan.studentName ?? ''],
    [t('academicYear'), plan.academicYear],
    [t('instalment'), String(installment.installmentNo)],
    [t('method'), methods(transaction.paymentMethod)],
    ...(transaction.transactionRef
      ? [[t('reference'), transaction.transactionRef] as [string, string]]
      : []),
    [t('balance'), formatCurrency(installment.balanceAmount)],
    ...(transaction.remarks ? [[t('note'), transaction.remarks] as [string, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        {back}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t('print')}
        </Button>
      </div>

      <article className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 shadow-card sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-1 border-b pb-6">
          <p className="text-2xl font-extrabold">{institute.data?.name}</p>
          {institute.data ? (
            <p className="text-sm text-muted-foreground">
              {[institute.data.city, institute.data.phone, institute.data.email]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <h1 className="mt-4 text-lg font-bold tracking-wide uppercase">{t('title')}</h1>
        </header>

        <dl className="grid grid-cols-2 gap-4 border-b py-6 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('number')}</dt>
            <dd className="font-semibold">{transaction.receiptNumber}</dd>
          </div>
          <div className="text-right">
            <dt className="text-muted-foreground">{t('date')}</dt>
            <dd className="font-semibold">{formatDateTime(transaction.paidAt)}</dd>
          </div>
        </dl>

        <dl className="flex flex-col gap-3 border-b py-6 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-1 py-6">
          <p className="text-sm text-muted-foreground">{t('amount')}</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {formatCurrency(transaction.amount)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">{t('inWords')}: </span>
            {rupeesInWords(transaction.amount)}
          </p>
        </div>

        <p className="border-t pt-6 text-xs text-muted-foreground">{t('footer')}</p>
      </article>
    </div>
  );
}
