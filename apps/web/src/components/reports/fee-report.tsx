'use client';

import { AlertTriangle, BadgeCheck, CircleSlash, Download, Phone, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { downloadCsv, toCsv } from '@/lib/csv';
import { todayInIndia } from '@/lib/dates';
import { formatCurrency, formatDate } from '@/lib/format';
import { type FeeDefaulter, useFeeReport } from '@/lib/reports';

export function FeeReportView() {
  const t = useTranslations('Reports.fees');
  const report = useFeeReport();

  if (report.isPending) return <ReportSkeleton />;
  if (report.isError) {
    return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  }
  const data = report.data;
  const rate = data.collectionPercentage;

  const exportCsv = () =>
    downloadCsv(
      `fee-defaulters-${todayInIndia()}.csv`,
      toCsv<FeeDefaulter>(data.defaulters, [
        { label: t('csv.student'), value: (row) => row.studentName },
        { label: t('csv.phone'), value: (row) => row.studentPhone },
        { label: t('csv.parent'), value: (row) => row.parentName },
        { label: t('csv.parentPhone'), value: (row) => row.parentPhone },
        { label: t('csv.overdue'), value: (row) => row.pendingAmount },
        { label: t('csv.since'), value: (row) => row.installmentDueDate },
        { label: t('csv.days'), value: (row) => row.overdueDays },
      ]),
    );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t('scope')}</p>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('kpi.expected')}
          value={formatCurrency(data.totalExpected)}
          icon={Wallet}
        />
        <KpiCard
          label={t('kpi.collected')}
          value={formatCurrency(data.totalCollected)}
          icon={BadgeCheck}
          hint={rate === null ? undefined : t('kpi.rate', { rate })}
        />
        <KpiCard
          label={t('kpi.pending')}
          value={formatCurrency(data.totalPending)}
          icon={AlertTriangle}
          tone={data.totalOverdue > 0 ? 'attention' : 'default'}
          hint={
            data.totalOverdue > 0
              ? t('kpi.overdue', { amount: formatCurrency(data.totalOverdue) })
              : undefined
          }
        />
        <KpiCard
          label={t('kpi.waived')}
          value={formatCurrency(data.totalWaived)}
          icon={CircleSlash}
        />
      </section>

      {rate !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t('progress')}</span>
            <span className="font-semibold tabular-nums">{rate}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={t('progress')}
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {t('defaulters.title', { count: data.defaulterCount })}
          </h2>
          {data.defaulters.length ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download aria-hidden />
              {t('download')}
            </Button>
          ) : null}
        </div>
        {data.defaulters.length === 0 ? (
          <StatePanel
            icon={<BadgeCheck className="size-5" aria-hidden />}
            title={t('defaulters.noneTitle')}
          >
            <p>{t('defaulters.noneBody')}</p>
          </StatePanel>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
            {data.defaulters.map((row) => (
              <li
                key={row.studentId}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/app/students/${row.studentId}`}
                    className="font-semibold hover:text-primary hover:underline"
                  >
                    {row.studentName}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {row.parentName ? <span>{row.parentName}</span> : null}
                    {row.parentPhone || row.studentPhone ? (
                      <a
                        href={`tel:${row.parentPhone || row.studentPhone}`}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        <Phone className="size-3" aria-hidden />
                        {row.parentPhone || row.studentPhone}
                      </a>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                  <span className="font-bold text-destructive tabular-nums">
                    {formatCurrency(row.pendingAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('defaulters.since', {
                      date: formatDate(`${row.installmentDueDate}T00:00:00Z`),
                      days: row.overdueDays,
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
