'use client';

import { Clock, Layers, Plus, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { type Batch, useBatches } from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatTime, sortDays } from '@/lib/schedule';

// Forms are left out of the page's first download and load just after it
const BatchFormDialog = dynamic(() => import('./batch-form-dialog').then((m) => m.BatchFormDialog));

export function BatchesPage() {
  const t = useTranslations('Batches');
  const router = useRouter();
  const canCreate = can(useSession()?.user, 'batches:create');
  const [adding, setAdding] = useState(false);
  const batches = useBatches();

  const addButton = canCreate ? (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      {t('add')}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={batches.data ? t('count', { count: batches.data.length }) : null}
        actions={addButton}
      />

      {batches.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : batches.isError ? (
        <QueryError error={batches.error} onRetry={() => void batches.refetch()} />
      ) : batches.data.length === 0 ? (
        <StatePanel icon={<Layers className="size-5" aria-hidden />} title={t('empty.title')}>
          <p>{t('empty.body')}</p>
          {addButton ? <div className="mt-2">{addButton}</div> : null}
        </StatePanel>
      ) : (
        <ul className="enter-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {batches.data.map((batch) => (
            <li key={batch.id}>
              <BatchCard batch={batch} />
            </li>
          ))}
        </ul>
      )}

      <BatchFormDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(batch) => router.push(`/app/batches/${batch.id}`)}
      />
    </div>
  );
}

function BatchCard({ batch }: { batch: Batch }) {
  const t = useTranslations('Batches');
  const common = useTranslations('Common');
  const teachers = batch.teachers ?? [];

  return (
    <Link
      href={`/app/batches/${batch.id}`}
      className="lift flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{batch.name}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {[batch.subject, batch.academicYear].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!batch.isActive ? <Badge>{common('status.inactive')}</Badge> : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 text-sm">
        <p className="flex items-center gap-2">
          <Users className="size-4 text-primary" aria-hidden />
          {t('students', { count: batch.activeStudentCount ?? 0 })}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          <ScheduleText batch={batch} />
        </p>
        <p className="truncate text-muted-foreground">
          {teachers.length
            ? teachers.map((teacher) => teacher.teacherName).join(', ')
            : t('noTeacher')}
        </p>
      </div>
    </Link>
  );
}

/** "Mon, Wed, Fri · 7:00 AM – 8:30 AM" */
export function ScheduleText({
  batch,
}: {
  batch: Pick<Batch, 'daysOfWeek' | 'startTime' | 'endTime'>;
}) {
  const t = useTranslations('Batches');
  const common = useTranslations('Common');
  const days = sortDays(batch.daysOfWeek)
    .map((day) => (common.has(`days.${day}`) ? common(`days.${day}` as 'days.MON') : day))
    .join(', ');
  const times = [formatTime(batch.startTime), formatTime(batch.endTime)]
    .filter(Boolean)
    .join(' – ');
  const text = [days, times].filter(Boolean).join(' · ');
  return <>{text || t('noSchedule')}</>;
}
