'use client';

import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { addDays, shiftMonth, useAttendanceBatches } from '@/lib/attendance';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { todayInIndia } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { HistoryView } from './history-view';
import { MarkSheet } from './mark-sheet';

const VIEWS = ['mark', 'history'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export function AttendancePage() {
  const t = useTranslations('Attendance');
  const user = useSession()?.user;
  const today = todayInIndia();
  const batches = useAttendanceBatches();

  // Batch, day and tab live in the URL, so a shared link opens the same register
  const [params, setParams] = useQueryStates({
    view: parseAsStringLiteral(VIEWS).withDefault('mark'),
    batch: parseAsString,
    date: parseAsString,
    month: parseAsString,
  });
  // Future days cannot be marked; malformed values fall back to today / this month
  const date = params.date && DAY.test(params.date) && params.date <= today ? params.date : today;
  const month =
    params.month && MONTH.test(params.month) && params.month <= today.slice(0, 7)
      ? params.month
      : today.slice(0, 7);

  const list = batches.data ?? [];
  // With one batch there is nothing to choose; otherwise the user picks (and it stays in the URL)
  const batchId =
    list.find((batch) => batch.id === params.batch)?.id ?? (list.length === 1 ? list[0]!.id : null);

  if (batches.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <PageHeader title={t('title')} />
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  if (batches.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} />
        <QueryError error={batches.error} onRetry={() => void batches.refetch()} />
      </div>
    );
  }
  if (list.length === 0) {
    const canCreate = can(user, 'batches:create');
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} />
        <StatePanel icon={<Layers className="size-5" aria-hidden />} title={t('empty.noBatches')}>
          <p>{canCreate ? t('empty.noBatchesBody') : t('empty.noBatchesTeacher')}</p>
          {canCreate ? (
            <Button asChild variant="outline" className="mt-2">
              <Link href="/app/batches">{t('empty.createBatch')}</Link>
            </Button>
          ) : null}
        </StatePanel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />

      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b">
        {VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={params.view === view}
            onClick={() => void setParams({ view: view === 'mark' ? null : view })}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              params.view === view
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${view}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-2 sm:w-72">
          <span className="text-sm font-medium">{t('batch')}</span>
          <Select
            value={batchId ?? ''}
            onChange={(event) => void setParams({ batch: event.target.value || null })}
          >
            {batchId ? null : <option value="">{t('chooseBatch')}</option>}
            {list.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.subject ? `${batch.name} · ${batch.subject}` : batch.name}
              </option>
            ))}
          </Select>
        </label>

        {params.view === 'mark' ? (
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11"
              aria-label={t('previousDay')}
              onClick={() => void setParams({ date: addDays(date, -1) })}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('date')}</span>
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(event) =>
                  void setParams({ date: event.target.value === today ? null : event.target.value })
                }
              />
            </label>
            <Button
              variant="outline"
              size="icon"
              className="h-11"
              aria-label={t('nextDay')}
              disabled={date >= today}
              onClick={() => {
                const next = addDays(date, 1);
                void setParams({ date: next === today ? null : next });
              }}
            >
              <ChevronRight aria-hidden />
            </Button>
            {date !== today ? (
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => void setParams({ date: null })}
              >
                {t('today')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11"
              aria-label={t('history.previousMonth')}
              onClick={() => void setParams({ month: shiftMonth(month, -1) })}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('history.month')}</span>
              <Input
                type="month"
                value={month}
                max={today.slice(0, 7)}
                onChange={(event) => void setParams({ month: event.target.value || null })}
              />
            </label>
            <Button
              variant="outline"
              size="icon"
              className="h-11"
              aria-label={t('history.nextMonth')}
              disabled={month >= today.slice(0, 7)}
              onClick={() => void setParams({ month: shiftMonth(month, 1) })}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <div role="tabpanel">
        {!batchId ? (
          <p className="text-sm text-muted-foreground">{t('empty.pickBatch')}</p>
        ) : params.view === 'mark' ? (
          <MarkSheet batchId={batchId} date={date} />
        ) : (
          <HistoryView
            batchId={batchId}
            month={month}
            onOpenDay={(day) => void setParams({ view: null, date: day === today ? null : day })}
          />
        )}
      </div>
    </div>
  );
}
