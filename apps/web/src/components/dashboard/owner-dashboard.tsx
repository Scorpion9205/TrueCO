'use client';

import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  IndianRupee,
  Layers,
  ReceiptIndianRupee,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { OwnerDashboard as OwnerDashboardData } from '@/lib/api-types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useOwnerDashboard } from '@/lib/queries';
import { KpiCard } from './kpi-card';
import { QueryError } from './query-error';

export function OwnerDashboard() {
  const query = useOwnerDashboard();

  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return <OwnerDashboardView data={query.data} />;
}

export function OwnerDashboardView({ data }: { data: OwnerDashboardData }) {
  const t = useTranslations('Dashboard');
  const m = data.metrics;
  const isNew = m.totalStudents === 0 && m.totalBatches === 0;

  return (
    <div className="flex flex-col gap-6">
      {isNew ? <GettingStarted /> : null}

      <section aria-label={t('kpiLabel')} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label={t('kpi.students')} value={String(m.totalStudents)} icon={Users} />
        <KpiCard
          label={t('kpi.attendance')}
          value={m.todayAttendanceRate === null ? '—' : `${Math.round(m.todayAttendanceRate)}%`}
          icon={CalendarCheck}
          hint={m.todayAttendanceRate === null ? t('kpi.attendanceNone') : t('kpi.attendanceHint')}
        />
        <KpiCard
          label={t('kpi.collected')}
          value={formatCurrency(m.monthlyRevenue)}
          icon={IndianRupee}
        />
        <KpiCard
          label={t('kpi.pending')}
          value={formatCurrency(m.monthlyPendingFees)}
          icon={ReceiptIndianRupee}
          hint={t('kpi.pendingHint')}
        />
        <KpiCard label={t('kpi.teachers')} value={String(m.totalTeachers)} icon={GraduationCap} />
        <KpiCard label={t('kpi.batches')} value={String(m.totalBatches)} icon={Layers} />
        <KpiCard
          label={t('kpi.expenses')}
          value={formatCurrency(m.monthlyExpenses)}
          icon={Wallet}
        />
        <KpiCard
          label={t('kpi.atRisk')}
          value={String(m.highRiskCount)}
          icon={AlertTriangle}
          tone={m.highRiskCount > 0 ? 'attention' : 'default'}
          hint={t('kpi.atRiskHint')}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dues.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dues.empty')}</p>
            ) : (
              <ul className="divide-y">
                {data.upcomingInstallments.map((due) => (
                  <li
                    key={due.installmentId}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{due.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('dues.due', { date: formatDate(due.dueDate) })}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(due.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('activity.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('activity.empty')}</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {data.recentActivities.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <p className="text-sm">{activity.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {[activity.studentName, formatDateTime(activity.occurredAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** First-run checklist while the institute has no batches or students yet */
function GettingStarted() {
  const t = useTranslations('Dashboard.start');
  const steps = [
    { key: 'batches', href: '/app/batches' },
    { key: 'students', href: '/app/students' },
    { key: 'attendance', href: '/app/attendance' },
  ] as const;

  return (
    <section
      aria-labelledby="getting-started"
      className="rounded-xl bg-foreground p-6 text-background shadow-card sm:p-8"
    >
      <h2 id="getting-started" className="text-xl font-bold">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-background/75">{t('subtitle')}</p>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="group flex h-full items-center gap-3 rounded-lg bg-background/10 p-4 transition-colors hover:bg-background/15"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{t(step.key)}</span>
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
