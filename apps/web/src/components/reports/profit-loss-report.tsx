'use client';

import {
  Banknote,
  Download,
  ReceiptIndianRupee,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatCurrency } from '@/lib/format';
import { useProfitLossReport } from '@/lib/reports';
import { cn } from '@/lib/utils';
import { ReportSkeleton } from './fee-report';
import { PeriodPicker, usePeriod } from './period-picker';

export function ProfitLossView() {
  const t = useTranslations('Reports.pnl');
  const { range } = usePeriod();
  const report = useProfitLossReport(range);
  const data = report.data;

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `profit-and-loss-${range[0]}-to-${range[1]}.csv`,
      toCsv(
        [
          [t('revenue'), data.totalRevenue],
          [t('salaries'), data.teacherSalaryExpenses],
          [t('expenses'), data.generalExpenses],
          [t('totalCosts'), data.totalExpenses],
          [data.netProfit < 0 ? t('loss') : t('profit'), data.netProfit],
          [t('margin'), data.profitMarginPercentage],
        ] as Array<[string, number | null]>,
        [
          { label: t('csv.item'), value: (row) => row[0] },
          { label: t('csv.amount'), value: (row) => row[1] },
        ],
      ),
    );
  };

  const loss = (data?.netProfit ?? 0) < 0;
  // How much of the fee income each cost takes, for the breakdown bar
  const share = (amount: number) =>
    data && data.totalRevenue > 0 ? Math.min((amount / data.totalRevenue) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PeriodPicker />
        {data ? (
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="self-start sm:self-end"
          >
            <Download aria-hidden />
            {t('download')}
          </Button>
        ) : null}
      </div>

      {report.isPending ? (
        <ReportSkeleton />
      ) : report.isError ? (
        <QueryError error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <div className={cn('flex flex-col gap-6', report.isPlaceholderData && 'opacity-60')}>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label={t('revenue')}
              value={formatCurrency(data!.totalRevenue)}
              icon={ReceiptIndianRupee}
              hint={t('revenueHint')}
            />
            <KpiCard
              label={t('salaries')}
              value={formatCurrency(data!.teacherSalaryExpenses)}
              icon={Banknote}
            />
            <KpiCard
              label={t('expenses')}
              value={formatCurrency(data!.generalExpenses)}
              icon={Wallet}
            />
            <KpiCard
              label={loss ? t('loss') : t('profit')}
              value={formatCurrency(Math.abs(data!.netProfit))}
              icon={loss ? TrendingDown : TrendingUp}
              tone={loss ? 'attention' : 'default'}
              hint={
                data!.profitMarginPercentage === null
                  ? t('noRevenue')
                  : t('marginHint', { margin: data!.profitMarginPercentage })
              }
            />
          </section>

          {data!.totalRevenue > 0 ? (
            <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="font-bold">{t('breakdown')}</h2>
              <div
                className="flex h-4 overflow-hidden rounded-full bg-success/25"
                role="img"
                aria-label={t('breakdownLabel', {
                  salaries: Math.round(share(data!.teacherSalaryExpenses)),
                  expenses: Math.round(share(data!.generalExpenses)),
                })}
              >
                <div
                  className="h-full bg-primary"
                  style={{ width: `${share(data!.teacherSalaryExpenses)}%` }}
                />
                <div
                  className="h-full bg-warning"
                  style={{ width: `${share(data!.generalExpenses)}%` }}
                />
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Legend
                  className="bg-primary"
                  label={t('salaries')}
                  value={share(data!.teacherSalaryExpenses)}
                />
                <Legend
                  className="bg-warning"
                  label={t('expenses')}
                  value={share(data!.generalExpenses)}
                />
                <Legend
                  className="bg-success/25"
                  label={loss ? t('loss') : t('profit')}
                  value={loss ? 0 : Math.max(0, 100 - share(data!.totalExpenses))}
                />
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Legend({ className, label, value }: { className: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn('size-3 rounded-sm', className)} />
      {label}
      <span className="font-semibold tabular-nums">{Math.round(value)}%</span>
    </li>
  );
}
