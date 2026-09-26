'use client';

import { ExternalLink, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useState } from 'react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MonthPicker, useMonthParam } from '@/components/ui/month-picker';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination, pageRange } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { monthRange } from '@/lib/attendance';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { sumRupees } from '@/lib/fees';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  EXPENSES_PAGE_SIZE,
  type Expense,
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useSalaries,
} from '@/lib/spending';
import { useApiError } from '@/lib/use-api-error';
import { useCategoryLabel } from './category-label';

// The form is left out of the page's first download and loads just after it
const ExpenseDialog = dynamic(() => import('./expense-dialog').then((m) => m.ExpenseDialog));

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

      <section className="enter-stagger grid grid-cols-2 gap-4 lg:grid-cols-3">
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
