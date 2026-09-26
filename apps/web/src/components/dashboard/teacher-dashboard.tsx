'use client';

import { BookOpen, CalendarCheck, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeacherDashboard as TeacherDashboardData } from '@/lib/api-types';
import { useTeacherDashboard } from '@/lib/queries';
import { KpiCard } from './kpi-card';
import { DashboardSkeleton } from './owner-dashboard';
import { QueryError } from './query-error';

export function TeacherDashboard() {
  const query = useTeacherDashboard();

  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return <TeacherDashboardView data={query.data} />;
}

export function TeacherDashboardView({ data }: { data: TeacherDashboardData }) {
  const t = useTranslations('Dashboard');
  const totalStudents = data.assignedBatches.reduce((sum, batch) => sum + batch.studentCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label={t('kpiLabel')}
        className="enter-stagger grid grid-cols-2 gap-4 md:grid-cols-3"
      >
        <KpiCard
          label={t('teacher.batches')}
          value={String(data.assignedBatches.length)}
          icon={Layers}
        />
        <KpiCard
          label={t('teacher.sessions')}
          value={String(data.todaySessions.length)}
          icon={CalendarCheck}
        />
        <KpiCard
          label={t('teacher.homework')}
          value={String(data.activeHomeworkCount)}
          icon={BookOpen}
          className="col-span-2 md:col-span-1"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('teacher.todayTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('teacher.todayEmpty')}</p>
            ) : (
              <ul className="divide-y">
                {data.todaySessions.map((session) => {
                  const rate = session.totalCount
                    ? Math.round((session.presentCount / session.totalCount) * 100)
                    : 0;
                  return (
                    <li key={session.sessionId} className="flex flex-col gap-2 py-3">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <p className="truncate font-medium">{session.batchName}</p>
                        <p className="shrink-0 tabular-nums text-muted-foreground">
                          {t('teacher.present', {
                            present: session.presentCount,
                            total: session.totalCount,
                          })}
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('teacher.batchesTitle', { students: totalStudents })}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.assignedBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('teacher.batchesEmpty')}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.assignedBatches.map((batch) => (
                  <li key={batch.batchId} className="rounded-lg border p-4">
                    <p className="truncate font-semibold">{batch.batchName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[batch.subject, t('teacher.students', { count: batch.studentCount })]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
