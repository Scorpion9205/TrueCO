'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import { todayInIndia } from '@/lib/dates';
import { parseRupees, PAYMENT_METHODS, type PaymentMethod } from '@/lib/fees';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseInput,
  useCreateExpense,
  useUpdateExpense,
} from '@/lib/spending';
import { useApiError } from '@/lib/use-api-error';
import { useCategoryLabel } from './category-label';

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
}) {
  const t = useTranslations('Expenses.form');
  const common = useTranslations('Common');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? t('editTitle') : t('createTitle')}
      closeLabel={common('close')}
    >
      {open ? <ExpenseForm expense={expense} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

const CUSTOM = '__custom__';

function ExpenseForm({ expense, onDone }: { expense?: Expense; onDone: () => void }) {
  const t = useTranslations('Expenses');
  const v = useTranslations('Auth.validation');
  const common = useTranslations('Common');
  const methods = useTranslations('Fees.method');
  const fees = useTranslations('Fees');
  const label = useCategoryLabel();
  const describeError = useApiError();
  const create = useCreateExpense();
  const update = useUpdateExpense(expense?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const known = (EXPENSE_CATEGORIES as readonly string[]).includes(expense?.category ?? 'RENT');

  const schema = useMemo(
    () =>
      z
        .object({
          title: z.string().trim().min(1, v('required')).max(255),
          categoryChoice: z.string(),
          customCategory: z.string().trim().max(100),
          amount: z
            .string()
            .refine((value) => parseRupees(value) !== null, fees('plan.amountInvalid')),
          expenseDate: z.string().min(1, v('required')),
          paymentMethod: z.enum(PAYMENT_METHODS),
          receiptUrl: z
            .string()
            .trim()
            .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), t('form.invalidUrl')),
          remarks: z.string().trim().max(255),
        })
        .refine((values) => values.categoryChoice !== CUSTOM || values.customCategory.length > 0, {
          path: ['customCategory'],
          message: v('required'),
        }),
    [t, v, fees],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: expense?.title ?? '',
      categoryChoice: expense ? (known ? expense.category : CUSTOM) : 'RENT',
      customCategory: expense && !known ? expense.category : '',
      amount: expense ? String(expense.amount) : '',
      expenseDate: expense ? expense.expenseDate.slice(0, 10) : todayInIndia(),
      paymentMethod: expense?.paymentMethod ?? 'CASH',
      receiptUrl: expense?.receiptUrl ?? '',
      remarks: expense?.remarks ?? '',
    },
  });
  const categoryChoice = useWatch({ control, name: 'categoryChoice' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const input: ExpenseInput = {
      title: values.title,
      category: values.categoryChoice === CUSTOM ? values.customCategory : values.categoryChoice,
      amount: parseRupees(values.amount)!,
      expenseDate: values.expenseDate,
      paymentMethod: values.paymentMethod as PaymentMethod,
      receiptUrl: values.receiptUrl,
      remarks: values.remarks,
    };
    const fields = ['title', 'amount', 'expenseDate', 'receiptUrl', 'remarks'] as const;
    try {
      if (expense) {
        const changes = changedFields(
          { ...expense, expenseDate: expense.expenseDate.slice(0, 10) } as Record<string, unknown>,
          input,
        );
        // The API clears text fields with "" rather than null
        for (const key of ['receiptUrl', 'remarks'] as const) {
          if (changes[key] === null) changes[key] = '';
        }
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes as Partial<ExpenseInput>);
          toast.success(t('form.updated'));
        }
      } else {
        await create.mutateAsync({
          ...input,
          receiptUrl: input.receiptUrl || undefined,
          remarks: input.remarks || undefined,
        });
        toast.success(t('form.created'));
      }
      onDone();
    } catch (error) {
      setFormError(describeError(error, setError, fields));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField id="exp-title" label={t('form.title')} error={errors.title?.message}>
        <Input
          autoComplete="off"
          autoFocus
          placeholder={t('form.titlePlaceholder')}
          {...register('title')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="exp-category" label={t('form.category')}>
          <Select {...register('categoryChoice')}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {label(category)}
              </option>
            ))}
            <option value={CUSTOM}>{t('form.customCategory')}…</option>
          </Select>
        </FormField>
        {categoryChoice === CUSTOM ? (
          <FormField
            id="exp-custom"
            label={t('form.customCategory')}
            error={errors.customCategory?.message}
          >
            <Input autoComplete="off" {...register('customCategory')} />
          </FormField>
        ) : null}
        <FormField id="exp-amount" label={t('form.amount')} error={errors.amount?.message}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            {...register('amount')}
          />
        </FormField>
        <FormField id="exp-date" label={t('form.date')} error={errors.expenseDate?.message}>
          <Input type="date" max={todayInIndia()} {...register('expenseDate')} />
        </FormField>
        <FormField id="exp-method" label={t('form.method')}>
          <Select {...register('paymentMethod')}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {methods(method)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField id="exp-receipt" label={t('form.receiptUrl')} error={errors.receiptUrl?.message}>
        <Input type="url" inputMode="url" autoComplete="off" {...register('receiptUrl')} />
      </FormField>
      <FormField id="exp-remarks" label={t('form.remarks')} error={errors.remarks?.message}>
        <Input autoComplete="off" {...register('remarks')} />
      </FormField>
      <div className="mt-2 flex justify-end border-t pt-5">
        <div className="w-full sm:w-48">
          <SubmitButton
            pending={isSubmitting}
            label={expense ? common('save') : t('form.create')}
            pendingLabel={expense ? common('saving') : t('form.creating')}
          />
        </div>
      </div>
    </form>
  );
}
