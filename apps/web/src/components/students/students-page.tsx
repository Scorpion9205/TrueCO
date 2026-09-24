'use client';

import { Plus, SearchX, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination, pageRange } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { fullName, STUDENTS_PAGE_SIZE, type Student, useStudents } from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StudentFormDialog } from './student-form-dialog';

const STATUSES = ['active', 'inactive', 'all'] as const;

export function StudentsPage() {
  const t = useTranslations('Students');
  const common = useTranslations('Common');
  const router = useRouter();
  const canCreate = can(useSession()?.user, 'students:create');
  const [adding, setAdding] = useState(false);

  // Filters live in the URL: shareable, and the back button returns to the same view
  const [{ q, status, page }, setParams] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral(STATUSES).withDefault('active'),
    page: parseAsInteger.withDefault(1),
  });
  const students = useStudents({ search: q, status, page });
  const total = students.data?.meta.total ?? 0;
  const { from, to } = pageRange(page, STUDENTS_PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={students.data ? t('count', { count: total }) : null}
        actions={
          canCreate ? (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t('add')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={q}
          onSearch={(value) => void setParams({ q: value || null, page: null })}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          clearLabel={common('clearSearch')}
        />
        <div className="sm:w-40">
          <Select
            aria-label={t('statusFilter')}
            value={status}
            onChange={(event) =>
              void setParams({
                status: event.target.value as (typeof STATUSES)[number],
                page: null,
              })
            }
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`filter.${value}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {students.isPending ? (
        <ListSkeleton />
      ) : students.isError ? (
        <QueryError error={students.error} onRetry={() => void students.refetch()} />
      ) : students.data.items.length === 0 ? (
        q ? (
          <StatePanel
            icon={<SearchX className="size-5" aria-hidden />}
            title={t('empty.searchTitle')}
          >
            <p>{t('empty.searchBody', { search: q })}</p>
          </StatePanel>
        ) : (
          <StatePanel icon={<Users className="size-5" aria-hidden />} title={t('empty.title')}>
            <p>{t('empty.body')}</p>
            {canCreate ? (
              <Button className="mt-2" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                {t('add')}
              </Button>
            ) : null}
          </StatePanel>
        )
      ) : (
        <>
          <StudentTable students={students.data.items} dimmed={students.isPlaceholderData} />
          <Pagination
            page={page}
            limit={STUDENTS_PAGE_SIZE}
            total={total}
            onPageChange={(next) => {
              void setParams({ page: next === 1 ? null : next });
              window.scrollTo({ top: 0 });
            }}
            labels={{
              previous: common('previous'),
              next: common('next'),
              nav: common('pagination'),
              range: common('range', { from, to, total }),
            }}
          />
        </>
      )}

      <StudentFormDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(student) => router.push(`/app/students/${student.id}`)}
      />
    </div>
  );
}

/** A table on wide screens; on phones the extra columns fold under the name */
function StudentTable({ students, dimmed }: { students: Student[]; dimmed: boolean }) {
  const t = useTranslations('Students');
  const common = useTranslations('Common');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-card transition-opacity',
        dimmed && 'opacity-60',
      )}
    >
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/60 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">
              {t('columns.name')}
            </th>
            <th scope="col" className="hidden px-4 py-3 md:table-cell">
              {t('columns.phone')}
            </th>
            <th scope="col" className="hidden px-4 py-3 lg:table-cell">
              {t('columns.joined')}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              {t('columns.status')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((student) => (
            <tr key={student.id} className="relative hover:bg-muted/50">
              <td className="px-4 py-3">
                {/* The link covers the whole row, so any part of it can be tapped */}
                <Link
                  href={`/app/students/${student.id}`}
                  className="font-semibold after:absolute after:inset-0 after:content-['']"
                >
                  {fullName(student)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {student.rollNumber ? t('rollNo', { roll: student.rollNumber }) : null}
                  {student.rollNumber && student.phone ? (
                    <span className="md:hidden"> · </span>
                  ) : null}
                  {/* Wider screens show the phone in its own column */}
                  {student.phone ? <span className="md:hidden">{student.phone}</span> : null}
                </p>
              </td>
              <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                {student.phone ?? '—'}
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">{formatDate(student.joiningDate)}</td>
              <td className="px-4 py-3 text-right">
                <Badge tone={student.isActive ? 'success' : 'neutral'}>
                  {common(student.isActive ? 'status.active' : 'status.inactive')}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}
