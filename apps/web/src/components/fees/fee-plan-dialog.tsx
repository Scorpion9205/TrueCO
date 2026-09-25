'use client';

import { CircleAlert, CircleCheck, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { todayInIndia } from '@/lib/dates';
import {
  addMonths,
  type DiscountType,
  finalAmount,
  fromPaise,
  splitAmount,
  sumRupees,
  toPaise,
  useCreateFeePlan,
} from '@/lib/fees';
import { parseRupees } from '@/lib/fees';
import { formatCurrency } from '@/lib/format';
import { currentAcademicYear } from '@/lib/schedule';
import { useApiError } from '@/lib/use-api-error';

interface FeePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
}

export function FeePlanDialog({ open, onOpenChange, studentId }: FeePlanDialogProps) {
  const t = useTranslations('Fees.plan');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      closeLabel={common('close')}
      size="lg"
    >
      {open ? <FeePlanForm studentId={studentId} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

interface Row {
  amount: string;
  dueDate: string;
}

function schedule(amount: number, count: number, firstDue: string, everyMonths: number): Row[] {
  return splitAmount(amount, count).map((part, index) => ({
    amount: String(part),
    dueDate: addMonths(firstDue, index * everyMonths),
  }));
}

function FeePlanForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const t = useTranslations('Fees.plan');
  const describeError = useApiError();
  const create = useCreateFeePlan();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [total, setTotal] = useState('');
  const [discountType, setDiscountType] = useState<'' | DiscountType>('');
  const [discountValue, setDiscountValue] = useState('');
  const [count, setCount] = useState(1);
  const [firstDue, setFirstDue] = useState(todayInIndia());
  const [every, setEvery] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = parseRupees(total);
  const discount = discountType ? Number(discountValue.replace(/,/g, '')) || 0 : 0;
  const discountProblem =
    discountType === 'PERCENTAGE' && discount > 100
      ? t('percentTooBig')
      : discountType === 'FIXED' && totalAmount !== null && discount >= totalAmount
        ? t('discountTooBig')
        : null;
  const final =
    totalAmount === null || discountProblem
      ? null
      : finalAmount(totalAmount, discountType || undefined, discount || undefined);

  // The schedule follows the inputs until someone edits a row by hand
  const [edited, setEdited] = useState(false);
  // An empty or half-typed date gives no schedule rather than an invalid one
  const validFirstDue = /^\d{4}-\d{2}-\d{2}$/.test(firstDue);
  const generated = final && validFirstDue ? schedule(final, count, firstDue, every) : [];
  const shownRows = edited ? rows : generated;
  const amounts = shownRows.map((row) => parseRupees(row.amount));
  const sum = amounts.every((a) => a !== null) ? sumRupees(amounts as number[]) : null;
  const matches = final !== null && sum !== null && toPaise(sum) === toPaise(final);

  const editRow = (index: number, change: Partial<Row>) => {
    const base = edited ? rows : generated;
    setRows(base.map((row, i) => (i === index ? { ...row, ...change } : row)));
    setEdited(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (totalAmount === null || final === null || !matches || !academicYear.trim()) return;
    try {
      await create.mutateAsync({
        studentId,
        academicYear: academicYear.trim(),
        totalAmount,
        ...(discountType && discount > 0 ? { discountType, discountValue: discount } : {}),
        installments: shownRows.map((row, index) => ({
          installmentNo: index + 1,
          amount: parseRupees(row.amount)!,
          dueDate: row.dueDate,
        })),
      });
      toast.success(t('created'));
      onDone();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="plan-year" label={t('academicYear')}>
          <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
        </FormField>
        <FormField
          id="plan-total"
          label={t('totalAmount')}
          error={total && totalAmount === null ? t('amountInvalid') : undefined}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setEdited(false);
            }}
          />
        </FormField>
        <FormField id="plan-discount-type" label={t('discountType')}>
          <Select
            value={discountType}
            onChange={(e) => {
              setDiscountType(e.target.value as '' | DiscountType);
              setEdited(false);
            }}
          >
            <option value="">{t('noDiscount')}</option>
            <option value="PERCENTAGE">{t('percentage')}</option>
            <option value="FIXED">{t('fixed')}</option>
          </Select>
        </FormField>
        {discountType ? (
          <FormField
            id="plan-discount"
            label={t('discountValue')}
            error={discountProblem ?? undefined}
          >
            <Input
              inputMode="decimal"
              autoComplete="off"
              value={discountValue}
              onChange={(e) => {
                setDiscountValue(e.target.value);
                setEdited(false);
              }}
            />
          </FormField>
        ) : null}
      </div>

      {final !== null ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">
          {t('final')}: <span className="font-bold tabular-nums">{formatCurrency(final)}</span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="plan-count" label={t('count')}>
          <Select
            value={String(count)}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setEdited(false);
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="plan-first-due" label={t('firstDue')}>
          <Input
            type="date"
            value={firstDue}
            onChange={(e) => {
              setFirstDue(e.target.value);
              setEdited(false);
            }}
          />
        </FormField>
        {count > 1 ? (
          <FormField id="plan-every" label={t('every')}>
            <Select
              value={String(every)}
              onChange={(e) => {
                setEvery(Number(e.target.value));
                setEdited(false);
              }}
            >
              {[1, 3, 6].map((months) => (
                <option key={months} value={months}>
                  {t(`frequency.${months}` as 'frequency.1')}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </div>

      {shownRows.length ? (
        <fieldset className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold">{t('schedule')}</legend>
            {edited ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEdited(false)}>
                <RefreshCw aria-hidden />
                {t('resplit')}
              </Button>
            ) : null}
          </div>
          <ol className="flex flex-col gap-2">
            {shownRows.map((row, index) => (
              <li key={index} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
                <Input
                  aria-label={t('rowAmount', { no: index + 1 })}
                  aria-invalid={parseRupees(row.amount) === null || undefined}
                  inputMode="decimal"
                  className="tabular-nums"
                  value={row.amount}
                  onChange={(e) => editRow(index, { amount: e.target.value })}
                />
                <Input
                  aria-label={t('rowDue', { no: index + 1 })}
                  type="date"
                  value={row.dueDate}
                  onChange={(e) => editRow(index, { dueDate: e.target.value })}
                />
              </li>
            ))}
          </ol>
          {final !== null && sum !== null ? (
            <p
              role="status"
              className={`flex items-center gap-2 text-sm ${matches ? 'text-success' : 'text-destructive'}`}
            >
              {matches ? (
                <CircleCheck className="size-4" aria-hidden />
              ) : (
                <CircleAlert className="size-4" aria-hidden />
              )}
              {matches
                ? t('sumOk', { amount: formatCurrency(final) })
                : t('sumOff', {
                    sum: formatCurrency(sum),
                    diff: formatCurrency(fromPaise(Math.abs(toPaise(sum) - toPaise(final)))),
                    direction: sum > final ? t('more') : t('less'),
                  })}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex justify-end border-t pt-5">
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={!matches || create.isPending || !academicYear.trim()}
          aria-busy={create.isPending}
        >
          {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {create.isPending ? t('creating') : t('create')}
        </Button>
      </div>
    </form>
  );
}
