'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SubmitButton } from '@/components/auth/submit-button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { parseRupees } from '@/components/fees/fee-plan-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MonthPicker, useMonthParam } from '@/components/ui/month-picker';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination, pageRange } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { changedFields } from '@/lib/academics';
import { monthRange } from '@/lib/attendance';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import { PAYMENT_METHODS, type PaymentMethod, sumRupees } from '@/lib/fees';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  EXPENSE_CATEGORIES,
  EXPENSES_PAGE_SIZE,
  type Expense,
  type ExpenseInput,
  useCreateExpense,
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useSalaries,
  useUpdateExpense,
} from '@/lib/spending';
import { useApiError } from '@/lib/use-api-error';

/** A category's label when it is one we know; other categories show as typed */
export function useCategoryLabel() {
  const t = useTranslations('Expenses.category');
  return (category: string) => (t.has(category as 'RENT') ? t(category as 'RENT') : category);
}

export function ExpensesPage() {
  const t = useTranslations('Expenses');
  const common = useTranslations('Common');
  const user = useSession()?.user;
  const label = useCategoryLabel();
  const [month, setMonth] = useMonthParam();
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [adding, setAdding] = useState(false);

  const range = monthRange(month);
  const summary = useExpenseSummary(month);
  const expenses = useExpenses(range, page);
  // Salaries are paid through their own register, so they are shown next to expenses
  const canSeeSalary = can(user, 'salary:read');
  const salaries = useSalaries(month, canSeeSalary);
  const salariesPaid = sumRupees(
    (salaries.data ?? []).filter((s) => s.status === 'PAID').map((s) => s.amount),
  );

  const total = expenses.data?.meta.total ?? 0;
  const { from, to } = pageRange(page, EXPENSES_PAGE_SIZE, total);
  const categories = Object.entries(summary.data?.byCategory ?? {}).sort((a, b) => b[1] - a[1]);
  const largest = categories[0]?.[1] ?? 0;

  const changeMonth = (next: string) => {
    setMonth(next);
    void setPage(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={
          can(user, 'expenses:create') ? (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t('add')}
            </Button>
          ) : null
        }
      />
      <MonthPicker month={month} onChange={changeMonth} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label={t('kpi.spent')}
          value={summary.data ? formatCurrency(summary.data.total) : '—'}
          hint={summary.data ? t('kpi.count', { count: summary.data.count }) : undefined}
          icon={Wallet}
        />
        {canSeeSalary ? (
          <>
            <KpiCard
              label={t('kpi.salaries')}
              value={salaries.data ? formatCurrency(salariesPaid) : '—'}
              icon={Wallet}
            />
            <KpiCard
              label={t('kpi.outgoing')}
              value={
                summary.data && salaries.data
                  ? formatCurrency(sumRupees([summary.data.total, salariesPaid]))
                  : '—'
              }
              hint={t('kpi.outgoingHint')}
              icon={Wallet}
              className="col-span-2 lg:col-span-1"
            />
          </>
        ) : null}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {expenses.isPending ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : expenses.isError ? (
            <QueryError error={expenses.error} onRetry={() => void expenses.refetch()} />
          ) : expenses.data.items.length === 0 ? (
            <StatePanel icon={<Wallet className="size-5" aria-hidden />} title={t('empty.title')}>
              <p>{t('empty.body')}</p>
            </StatePanel>
          ) : (
            <>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
                {expenses.data.items.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </ul>
              <Pagination
                page={page}
                limit={EXPENSES_PAGE_SIZE}
                total={total}
                onPageChange={(next) => void setPage(next === 1 ? null : next)}
                labels={{
                  previous: common('previous'),
                  next: common('next'),
                  nav: common('pagination'),
                  range: common('range', { from, to, total }),
                }}
              />
            </>
          )}
        </div>

        {categories.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('byCategory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {categories.map(([category, amount]) => (
                  <li key={category} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{label(category)}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${largest ? (amount / largest) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ExpenseDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const t = useTranslations('Expenses');
  const common = useTranslations('Common');
  const methods = useTranslations('Fees.method');
  const label = useCategoryLabel();
  const user = useSession()?.user;
  const describeError = useApiError();
  const remove = useDeleteExpense();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(expense.id);
      toast.success(t('deleted'));
    } catch (error) {
      toast.error(describeError(error));
    }
    setDeleting(false);
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{expense.title}</p>
        <p className="text-xs text-muted-foreground">
          {[
            label(expense.category),
            formatDate(expense.expenseDate),
            methods(expense.paymentMethod),
          ].join(' · ')}
        </p>
        {expense.remarks ? (
          <p className="text-xs text-muted-foreground">{expense.remarks}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 font-semibold tabular-nums">{formatCurrency(expense.amount)}</span>
        {expense.receiptUrl ? (
          <Button asChild size="icon" variant="ghost" className="size-9">
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('receipt')}: ${expense.title}`}
            >
              <ExternalLink aria-hidden />
            </a>
          </Button>
        ) : null}
        {can(user, 'expenses:update') ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label={`${t('edit')}: ${expense.title}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
          </Button>
        ) : null}
        {can(user, 'expenses:delete') ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-destructive hover:bg-destructive/10"
            aria-label={`${t('delete')}: ${expense.title}`}
            onClick={() => setDeleting(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
      <ExpenseDialog open={editing} onOpenChange={setEditing} expense={expense} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle', { name: expense.title })}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        cancelLabel={common('cancel')}
        onConfirm={() => void confirmDelete()}
        pending={remove.isPending}
        destructive
      />
    </li>
  );
}

function ExpenseDialog({
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
