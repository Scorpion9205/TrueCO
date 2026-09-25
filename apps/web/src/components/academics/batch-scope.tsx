'use client';

import { Layers } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { type TeachingBatch, useTeachingBatches } from '@/lib/teaching-batches';

interface BatchScopeProps {
  /** The page content for the chosen batch */
  children: (batch: TeachingBatch) => ReactNode;
  /** Extra controls shown next to the batch picker, e.g. a "New test" button */
  actions?: (batch: TeachingBatch) => ReactNode;
}

/**
 * Batch picker for pages that work one batch at a time (tests, homework). The choice is kept in
 * the URL (?batch=), a single batch is picked automatically, and teachers only see their own.
 */
export function BatchScope({ children, actions }: BatchScopeProps) {
  const t = useTranslations('Common.batchPicker');
  const user = useSession()?.user;
  const batches = useTeachingBatches();
  const [selected, setSelected] = useQueryState('batch', parseAsString);

  if (batches.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-11 w-full max-w-sm" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (batches.isError) {
    return <QueryError error={batches.error} onRetry={() => void batches.refetch()} />;
  }

  const list = batches.data ?? [];
  if (list.length === 0) {
    const canCreate = can(user, 'batches:create');
    return (
      <StatePanel icon={<Layers className="size-5" aria-hidden />} title={t('noBatches')}>
        <p>{canCreate ? t('noBatchesOwner') : t('noBatchesTeacher')}</p>
        {canCreate ? (
          <Button asChild variant="outline" className="mt-2">
            <Link href="/app/batches">{t('goToBatches')}</Link>
          </Button>
        ) : null}
      </StatePanel>
    );
  }

  const batch = list.find((item) => item.id === selected) ?? (list.length === 1 ? list[0] : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-col gap-2 sm:w-80">
          <span className="text-sm font-medium">{t('label')}</span>
          <Select
            value={batch?.id ?? ''}
            onChange={(event) => void setSelected(event.target.value || null)}
          >
            {batch ? null : <option value="">{t('choose')}</option>}
            {list.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject ? `${item.name} · ${item.subject}` : item.name}
              </option>
            ))}
          </Select>
        </label>
        {batch && actions ? <div className="flex gap-2">{actions(batch)}</div> : null}
      </div>
      {batch ? children(batch) : <p className="text-sm text-muted-foreground">{t('pick')}</p>}
    </div>
  );
}
