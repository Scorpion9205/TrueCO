'use client';

import { Plus, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import {
  canPay,
  type FeeInstallment,
  type FeePlan,
  isOverdue,
  useStudentFees,
  useWaiveInstallment,
} from '@/lib/fees';
import { formatCurrency, formatDate } from '@/lib/format';
import { useApiError } from '@/lib/use-api-error';
import { FeePlanDialog } from './fee-plan-dialog';
import { PaymentDialog } from './payment-dialog';

const STATUS_TONES = {
  PENDING: 'neutral',
  PARTIAL: 'warning',
  PAID: 'success',
  WAIVED: 'info',
  OVERDUE: 'danger',
} as const;

/** The Fees card on a student's profile */
export function StudentFees({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const t = useTranslations('Fees');
  const user = useSession()?.user;
  const fees = useStudentFees(studentId);
  const [adding, setAdding] = useState(false);

  return (
    <Card id="fees">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('student.title')}</CardTitle>
        {can(user, 'fees:create') ? (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t('student.addPlan')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {fees.isPending ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : fees.isError ? (
          <QueryError error={fees.error} onRetry={() => void fees.refetch()} />
        ) : fees.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('student.empty')}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {fees.data.map((plan) => (
              <PlanView key={plan.id} plan={plan} studentId={studentId} studentName={studentName} />
            ))}
          </div>
        )}
      </CardContent>
      <FeePlanDialog open={adding} onOpenChange={setAdding} studentId={studentId} />
    </Card>
  );
}

function PlanView({
  plan,
  studentId,
  studentName,
}: {
  plan: FeePlan;
  studentId: string;
  studentName: string;
}) {
  const t = useTranslations('Fees');
  const waived = plan.totalWaived ?? 0;
  // Waived amounts are settled too, so a fully paid-or-waived plan shows a full bar
  const settledPercent = plan.finalAmount
    ? Math.min(100, ((plan.totalPaid + waived) / plan.finalAmount) * 100)
    : 100;
  const discount = plan.totalAmount - plan.finalAmount;

  return (
    <section
      aria-label={t('student.plan', { year: plan.academicYear })}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{t('student.plan', { year: plan.academicYear })}</h3>
        {discount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('student.discount', { amount: formatCurrency(discount) })}
          </span>
        ) : null}
      </div>
      <div>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>
            {t('student.paidOf', {
              paid: formatCurrency(plan.totalPaid),
              total: formatCurrency(plan.finalAmount),
            })}
          </span>
          <span className="flex gap-3">
            {waived > 0 ? (
              <span className="text-muted-foreground">
                {t('student.waived', { amount: formatCurrency(waived) })}
              </span>
            ) : null}
            {plan.totalPending > 0 ? (
              <span className="font-semibold">
                {t('student.pending', { amount: formatCurrency(plan.totalPending) })}
              </span>
            ) : null}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success" style={{ width: `${settledPercent}%` }} />
        </div>
      </div>
      <ul className="divide-y rounded-lg border">
        {(plan.installments ?? []).map((installment) => (
          <InstallmentRow
            key={installment.id}
            installment={installment}
            studentId={studentId}
            studentName={studentName}
          />
        ))}
      </ul>
    </section>
  );
}

function InstallmentRow({
  installment,
  studentId,
  studentName,
}: {
  installment: FeeInstallment;
  studentId: string;
  studentName: string;
}) {
  const t = useTranslations('Fees');
  const common = useTranslations('Common');
  const user = useSession()?.user;
  const describeError = useApiError();
  const waive = useWaiveInstallment();
  const [paying, setPaying] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const overdue = isOverdue(installment, todayInIndia());
  const status = overdue ? 'OVERDUE' : installment.status;
  const payable = canPay(installment);

  const confirmWaive = async () => {
    try {
      await waive.mutateAsync({ id: installment.id });
      toast.success(t('waive.done'));
    } catch (error) {
      toast.error(describeError(error));
    }
    setWaiving(false);
  };

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            {t('student.instalment', { no: installment.installmentNo })} ·{' '}
            <span className="tabular-nums">{formatCurrency(installment.amount)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('student.columns.due')} {formatDate(installment.dueDate)}
            {installment.paidAmount > 0 && installment.status !== 'PAID'
              ? ` · ${t('student.columns.paid')} ${formatCurrency(installment.paidAmount)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONES[status]}>{t(`status.${status}`)}</Badge>
          {payable && can(user, 'fees:pay') ? (
            <Button size="sm" onClick={() => setPaying(true)}>
              {t('student.recordPayment')}
            </Button>
          ) : null}
          {payable && can(user, 'fees:waive') ? (
            <Button size="sm" variant="ghost" onClick={() => setWaiving(true)}>
              {t('student.waive')}
            </Button>
          ) : null}
        </div>
      </div>

      {installment.transactions?.length ? (
        <ul className="flex flex-wrap gap-2">
          {installment.transactions.map((transaction) => (
            <li key={transaction.id}>
              <Link
                href={`/app/fees/receipts/${transaction.id}?student=${studentId}`}
                aria-label={t('student.viewReceipt', { number: transaction.receiptNumber })}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70"
              >
                <Receipt className="size-3.5" aria-hidden />
                {transaction.receiptNumber} · {formatCurrency(transaction.amount)} ·{' '}
                {t(`method.${transaction.paymentMethod}`)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        installment={installment}
        studentId={studentId}
        studentName={studentName}
      />
      <ConfirmDialog
        open={waiving}
        onOpenChange={setWaiving}
        title={t('waive.title', { no: installment.installmentNo })}
        description={t('waive.body', { amount: formatCurrency(installment.balanceAmount) })}
        confirmLabel={t('waive.confirm', { amount: formatCurrency(installment.balanceAmount) })}
        cancelLabel={common('cancel')}
        onConfirm={() => void confirmWaive()}
        pending={waive.isPending}
        destructive
      />
    </li>
  );
}
