'use client';

import { GraduationCap, Layers, Mail, Pencil, Phone, Plus, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { toast } from '@/components/ui/toaster';
import { type Teacher, useTeachers } from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatCurrency } from '@/lib/format';
import { useUpdateTeacher } from '@/lib/teachers';
import { useApiError } from '@/lib/use-api-error';
import { TeacherBatchesDialog } from './teacher-batches-dialog';
import { TeacherFormDialog } from './teacher-form-dialog';

const STATUSES = ['active', 'inactive', 'all'] as const;
type Status = (typeof STATUSES)[number];

/** Filters in the browser: an institute has a handful of teachers, all loaded at once */
export function filterTeachers(teachers: Teacher[], search: string, status: Status): Teacher[] {
  const needle = search.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  return teachers.filter((teacher) => {
    if (status === 'active' && !teacher.isActive) return false;
    if (status === 'inactive' && teacher.isActive) return false;
    if (!needle) return true;
    return (
      teacher.name.toLowerCase().includes(needle) ||
      teacher.email.toLowerCase().includes(needle) ||
      (teacher.specialization ?? '').toLowerCase().includes(needle) ||
      (digits.length >= 3 && teacher.phone.replace(/\D/g, '').includes(digits))
    );
  });
}

export function TeachersPage() {
  const t = useTranslations('Teachers');
  const common = useTranslations('Common');
  const canCreate = can(useSession()?.user, 'teachers:create');
  const [adding, setAdding] = useState(false);
  const [{ q, status }, setParams] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral(STATUSES).withDefault('active'),
  });
  const teachers = useTeachers();
  const shown = teachers.data ? filterTeachers(teachers.data, q, status) : [];
  const activeCount = teachers.data?.filter((teacher) => teacher.isActive).length ?? 0;

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
        subtitle={teachers.data ? t('count', { count: activeCount }) : null}
        actions={addButton}
      />

      {teachers.data?.length ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={q}
            onSearch={(value) => void setParams({ q: value || null })}
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            clearLabel={common('clearSearch')}
          />
          <div className="sm:w-40">
            <Select
              aria-label={t('statusFilter')}
              value={status}
              onChange={(event) => void setParams({ status: event.target.value as Status })}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`filter.${value}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {teachers.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : teachers.isError ? (
        <QueryError error={teachers.error} onRetry={() => void teachers.refetch()} />
      ) : teachers.data.length === 0 ? (
        <StatePanel
          icon={<GraduationCap className="size-5" aria-hidden />}
          title={t('empty.title')}
        >
          <p>{t('empty.body')}</p>
          {addButton ? <div className="mt-2">{addButton}</div> : null}
        </StatePanel>
      ) : shown.length === 0 ? (
        <StatePanel
          icon={<SearchX className="size-5" aria-hidden />}
          title={t('empty.filteredTitle')}
        >
          <p>{q ? t('empty.searchBody', { search: q }) : t('empty.filteredBody')}</p>
        </StatePanel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((teacher) => (
            <li key={teacher.id}>
              <TeacherCard teacher={teacher} />
            </li>
          ))}
        </ul>
      )}

      <TeacherFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const t = useTranslations('Teachers');
  const common = useTranslations('Common');
  const user = useSession()?.user;
  const describeError = useApiError();
  const update = useUpdateTeacher(teacher.id);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const canUpdate = can(user, 'teachers:update');
  const canAssign = can(user, 'batches:update');
  const batches = teacher.assignedBatches ?? [];

  const setActive = async (isActive: boolean) => {
    try {
      await update.mutateAsync({ isActive });
      toast.success(t(isActive ? 'reactivated' : 'deactivated', { name: teacher.name }));
      setConfirming(false);
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-accent-foreground"
          >
            {initials(teacher.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-bold">{teacher.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {teacher.specialization || t('noSubject')}
            </p>
          </div>
        </div>
        {!teacher.isActive ? <Badge>{common('status.inactive')}</Badge> : null}
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <a
          href={`tel:${teacher.phone}`}
          className="flex w-fit items-center gap-2 hover:text-primary"
        >
          <Phone className="size-4 text-muted-foreground" aria-hidden />
          {teacher.phone}
        </a>
        <a
          href={`mailto:${teacher.email}`}
          className="flex min-w-0 items-center gap-2 hover:text-primary"
        >
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{teacher.email}</span>
        </a>
        {can(user, 'salary:read') ? (
          <p className="text-muted-foreground">
            {teacher.monthlySalary
              ? t('salaryPerMonth', { amount: formatCurrency(teacher.monthlySalary) })
              : t('noSalary')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Layers className="size-3.5" aria-hidden />
          {t('batchesLabel')}
        </p>
        {batches.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {batches.map((batch) => (
              <li key={batch.batchId}>
                <Link
                  href={`/app/batches/${batch.batchId}`}
                  className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-brand-soft"
                >
                  {batch.batchName}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noBatches')}</p>
        )}
      </div>

      {canUpdate || canAssign ? (
        <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
          {canUpdate ? (
            <Button
              size="sm"
              variant="outline"
              aria-label={`${common('edit')}: ${teacher.name}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              {common('edit')}
            </Button>
          ) : null}
          {canAssign && teacher.isActive ? (
            <Button size="sm" variant="outline" onClick={() => setManaging(true)}>
              <Layers aria-hidden />
              {t('manageBatches')}
            </Button>
          ) : null}
          {canUpdate ? (
            teacher.isActive ? (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                {t('deactivate')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={update.isPending}
                onClick={() => void setActive(true)}
              >
                {t('reactivate')}
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      <TeacherFormDialog open={editing} onOpenChange={setEditing} teacher={teacher} />
      {canAssign ? (
        <TeacherBatchesDialog open={managing} onOpenChange={setManaging} teacher={teacher} />
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('deactivateTitle', { name: teacher.name })}
        description={t('deactivateBody')}
        confirmLabel={t('deactivate')}
        cancelLabel={common('cancel')}
        pending={update.isPending}
        destructive
        onConfirm={() => void setActive(false)}
      />
    </article>
  );
}

/** "Anita Rao" -> "AR" */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}
