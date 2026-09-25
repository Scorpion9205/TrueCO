'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import {
  type FeeInstallment,
  PAYMENT_METHODS,
  type PaymentMethod,
  toPaise,
  useRecordPayment,
} from '@/lib/fees';
import { formatCurrency } from '@/lib/format';
import { useApiError } from '@/lib/use-api-error';
import { parseRupees } from './fee-plan-dialog';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: FeeInstallment;
  studentId: string;
  studentName: string;
}

export function PaymentDialog(props: PaymentDialogProps) {
  const t = useTranslations('Fees.pay');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('title')}
      description={t('for', {
        student: props.studentName,
        no: props.installment.installmentNo,
        balance: formatCurrency(props.installment.balanceAmount),
      })}
      closeLabel={common('close')}
    >
      {props.open ? <PaymentForm {...props} /> : null}
    </Dialog>
  );
}

function PaymentForm({ installment, studentId, onOpenChange }: PaymentDialogProps) {
  const t = useTranslations('Fees');
  const router = useRouter();
  const describeError = useApiError();
  const record = useRecordPayment();
  // The full balance is the usual case; part payments just change the amount
  const [amount, setAmount] = useState(String(installment.balanceAmount));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const value = parseRupees(amount);
  const overBalance = value !== null && toPaise(value) > toPaise(installment.balanceAmount);
  const amountError =
    amount && value === null
      ? t('plan.amountInvalid')
      : overBalance
        ? t('pay.overBalance', { balance: formatCurrency(installment.balanceAmount) })
        : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value === null || overBalance) return;
    setError(null);
    try {
      const receipt = await record.mutateAsync({
        installmentId: installment.id,
        amount: value,
        paymentMethod: method,
        ...(reference.trim() ? { transactionRef: reference.trim() } : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      });
      const duplicate = (receipt as { duplicate?: boolean }).duplicate;
      toast.success(
        t(duplicate ? 'pay.duplicate' : 'pay.recorded', { number: receipt.receiptNumber }),
        {
          action: {
            label: t('pay.viewReceipt'),
            onClick: () => router.push(`/app/fees/receipts/${receipt.id}?student=${studentId}`),
          },
        },
      );
      onOpenChange(false);
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="pay-amount" label={t('pay.amount')} error={amountError}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            className="tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField id="pay-method" label={t('pay.method')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {t(`method.${option}`)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {method !== 'CASH' ? (
        <FormField id="pay-ref" label={t('pay.reference')}>
          <Input
            autoComplete="off"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </FormField>
      ) : null}
      <FormField id="pay-remarks" label={t('pay.remarks')}>
        <Input autoComplete="off" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
      <Button
        type="submit"
        size="lg"
        className="mt-2"
        disabled={value === null || overBalance || record.isPending}
        aria-busy={record.isPending}
      >
        {record.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {record.isPending ? t('pay.submitting') : t('pay.submit')}
      </Button>
    </form>
  );
}
