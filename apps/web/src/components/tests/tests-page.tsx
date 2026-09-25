'use client';

import { ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BatchScope } from '@/components/academics/batch-scope';
import { QueryError } from '@/components/dashboard/query-error';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { type Test, useBatchTests } from '@/lib/assessments';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatDate } from '@/lib/format';
import type { TeachingBatch } from '@/lib/teaching-batches';
import { TestFormDialog } from './test-form-dialog';

/** Marks to at most two decimals, without trailing zeros: 37.5, 40 */
export function formatMarks(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function TestsPage() {
  const t = useTranslations('Tests');
  const router = useRouter();
  const canCreate = can(useSession()?.user, 'tests:create');
  const [creatingFor, setCreatingFor] = useState<TeachingBatch | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <BatchScope
        actions={(batch) =>
          canCreate ? (
            <Button onClick={() => setCreatingFor(batch)}>
              <Plus aria-hidden />
              {t('add')}
            </Button>
          ) : null
        }
      >
        {(batch) => (
          <TestList batch={batch} onCreate={canCreate ? () => setCreatingFor(batch) : undefined} />
        )}
      </BatchScope>
      <TestFormDialog
        open={creatingFor !== null}
        onOpenChange={(open) => !open && setCreatingFor(null)}
        batch={creatingFor ?? undefined}
        onCreated={(test) => router.push(`/app/tests/${test.id}`)}
      />
    </div>
  );
}

function TestList({ batch, onCreate }: { batch: TeachingBatch; onCreate?: () => void }) {
  const t = useTranslations('Tests');
  const tests = useBatchTests(batch.id);

  if (tests.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }
  if (tests.isError) {
    return <QueryError error={tests.error} onRetry={() => void tests.refetch()} />;
  }
  if (tests.data.length === 0) {
    return (
      <StatePanel icon={<ClipboardCheck className="size-5" aria-hidden />} title={t('empty.title')}>
        <p>{t('empty.body')}</p>
        {onCreate ? (
          <Button className="mt-2" onClick={onCreate}>
            <Plus aria-hidden />
            {t('add')}
          </Button>
        ) : null}
      </StatePanel>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tests.data.map((test) => (
        <li key={test.id}>
          <TestCard test={test} />
        </li>
      ))}
    </ul>
  );
}

function TestCard({ test }: { test: Test }) {
  const t = useTranslations('Tests');
  const entered = test.results?.length ?? 0;

  return (
    <Link
      href={`/app/tests/${test.id}`}
      className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-float"
    >
      <div className="min-w-0">
        <h2 className="truncate font-bold">{test.title}</h2>
        <p className="text-sm text-muted-foreground">
          {test.subject} · {formatDate(test.testDate)}
        </p>
      </div>
      <p className="text-sm font-medium">{t('totalOf', { total: formatMarks(test.totalMarks) })}</p>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{t('marked', { count: entered })}</span>
        {test.averageScore !== undefined ? (
          <span>{t('average', { score: formatMarks(test.averageScore) })}</span>
        ) : null}
        {test.highestScore !== undefined ? (
          <span>{t('highest', { score: formatMarks(test.highestScore) })}</span>
        ) : null}
      </div>
    </Link>
  );
}
