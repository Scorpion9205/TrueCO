'use client';

import { AlertTriangle, CalendarX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { QueryError } from '@/components/dashboard/query-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import {
  LOW_ATTENDANCE_PERCENT,
  monthRange,
  summariseByStudent,
  toDay,
  useAttendanceSessions,
} from '@/lib/attendance';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface HistoryViewProps {
  batchId: string;
  /** YYYY-MM */
  month: string;
  /** Open a day in the Mark tab */
  onOpenDay: (day: string) => void;
}

/** One month of a batch: attendance per day, and per student (lowest first) */
export function HistoryView({ batchId, month, onOpenDay }: HistoryViewProps) {
  const t = useTranslations('Attendance');
  const [from, to] = monthRange(month);
  const sessions = useAttendanceSessions(batchId, from, to);

  if (sessions.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  if (sessions.isError) {
    return <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }
  if (sessions.data.length === 0) {
    return (
      <StatePanel icon={<CalendarX className="size-5" aria-hidden />} title={t('history.none')} />
    );
  }

  const students = summariseByStudent(sessions.data);
  const marked = students.reduce((sum, row) => sum + row.marked, 0);
  const attended = students.reduce((sum, row) => sum + row.attended, 0);
  const average = marked ? Math.round((attended / marked) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-muted-foreground">
        {t('history.average', { percent: average })}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('history.days')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sessions.data.map((session) => {
                const day = toDay(session.sessionDate);
                const rate = session.totalStudents
                  ? Math.round((session.presentCount / session.totalStudents) * 100)
                  : 0;
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      aria-label={t('history.open', { date: formatDate(day) })}
                      className="flex w-full flex-col gap-2 rounded-lg px-2 py-3 text-left hover:bg-muted"
                    >
                      <span className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium">{formatDate(day)}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {t('history.dayRow', {
                            present: session.presentCount,
                            total: session.totalStudents,
                          })}
                        </span>
                      </span>
                      <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            rate < LOW_ATTENDANCE_PERCENT ? 'bg-warning' : 'bg-success',
                          )}
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('history.students')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {students.map((row) => {
                const low = row.percent < LOW_ATTENDANCE_PERCENT;
                return (
                  <li key={row.studentId} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.studentName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('history.classes', { attended: row.attended, marked: row.marked })}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums',
                        low && 'text-destructive',
                      )}
                    >
                      {low ? (
                        <AlertTriangle
                          className="size-4"
                          aria-label={t('history.low', { percent: LOW_ATTENDANCE_PERCENT })}
                        />
                      ) : null}
                      {row.percent}%
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
