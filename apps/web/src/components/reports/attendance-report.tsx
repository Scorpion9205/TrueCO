'use client';

import { AlertTriangle, CalendarCheck, ClipboardList, Download, Percent } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { StatePanel } from '@/components/ui/state-panel';
import { useBatches } from '@/lib/academics';
import { downloadCsv, toCsv } from '@/lib/csv';
import { type StudentAttendance, useAttendanceReport } from '@/lib/reports';
import { cn } from '@/lib/utils';
import { ReportSkeleton } from './fee-report';
import { PeriodPicker, usePeriod } from './period-picker';

export const THRESHOLDS = [50, 60, 75, 85, 90] as const;

export function AttendanceReportView() {
  const t = useTranslations('Reports.attendance');
  const { range } = usePeriod();
  const [params, setParams] = useQueryStates({
    batch: parseAsString,
    threshold: parseAsInteger.withDefault(75),
    below: parseAsBoolean.withDefault(false),
  });
  const threshold = (THRESHOLDS as readonly number[]).includes(params.threshold)
    ? params.threshold
    : 75;
  const batches = useBatches();
  const report = useAttendanceReport(range, params.batch, threshold);
  const data = report.data;
  const rows = data ? (params.below ? data.defaulters : data.students) : [];
  const batchName = batches.data?.find((batch) => batch.id === params.batch)?.name;

  const exportCsv = () =>
    downloadCsv(
      `attendance-${batchName ? `${batchName.replace(/[^\w-]+/g, '-')}-` : ''}${range[0]}-to-${range[1]}.csv`,
      toCsv<StudentAttendance>(rows, [
        { label: t('csv.student'), value: (row) => row.studentName },
        { label: t('csv.attended'), value: (row) => row.attendedClasses },
        { label: t('csv.total'), value: (row) => row.totalClasses },
        { label: t('csv.percentage'), value: (row) => row.percentage },
      ]),
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <PeriodPicker />
        <label className="flex flex-col gap-2 sm:w-60">
          <span className="text-sm font-medium">{t('batch')}</span>
          <Select
            value={params.batch ?? ''}
            onChange={(event) => void setParams({ batch: event.target.value || null })}
          >
            <option value="">{t('allBatches')}</option>
            {(batches.data ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-2 sm:w-40">
          <span className="text-sm font-medium">{t('threshold')}</span>
          <Select
            value={String(threshold)}
            onChange={(event) =>
              void setParams({
                threshold: Number(event.target.value) === 75 ? null : Number(event.target.value),
              })
            }
          >
            {THRESHOLDS.map((value) => (
              <option key={value} value={value}>
                {t('below', { threshold: value })}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {report.isPending ? (
        <ReportSkeleton />
      ) : report.isError ? (
        <QueryError error={report.error} onRetry={() => void report.refetch()} />
      ) : data!.students.length === 0 ? (
        <StatePanel
          icon={<CalendarCheck className="size-5" aria-hidden />}
          title={t('empty.title')}
        >
          <p>{t('empty.body')}</p>
        </StatePanel>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard
              label={t('kpi.sessions')}
              value={String(data!.totalSessions)}
              icon={ClipboardList}
            />
            <KpiCard
              label={t('kpi.average')}
              value={
                data!.averageAttendancePercentage === null
                  ? '—'
                  : `${data!.averageAttendancePercentage}%`
              }
              icon={Percent}
            />
            <KpiCard
              label={t('kpi.belowThreshold', { threshold })}
              value={String(data!.defaultersCount)}
              icon={AlertTriangle}
              tone={data!.defaultersCount > 0 ? 'attention' : 'default'}
              className="col-span-2 lg:col-span-1"
            />
          </section>

          <section className={cn('flex flex-col gap-3', report.isPlaceholderData && 'opacity-60')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={params.below}
                  onChange={(event) => void setParams({ below: event.target.checked || null })}
                />
                {t('onlyBelow', { threshold })}
              </label>
              {rows.length ? (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download aria-hidden />
                  {t('download')}
                </Button>
              ) : null}
            </div>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t('noneBelow', { threshold })}
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
                {rows.map((row) => {
                  const low = row.percentage < threshold;
                  return (
                    <li key={row.studentId} className="flex items-center gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/app/students/${row.studentId}`}
                          className="block truncate font-medium hover:text-primary hover:underline"
                        >
                          {row.studentName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t('classes', { attended: row.attendedClasses, total: row.totalClasses })}
                        </p>
                      </div>
                      <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            low ? 'bg-destructive' : 'bg-success',
                          )}
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'w-16 text-right font-semibold tabular-nums',
                          low && 'text-destructive',
                        )}
                      >
                        {row.percentage}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
