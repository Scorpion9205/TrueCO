'use client';

import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Check,
  Clock,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import {
  type Batch,
  fullName,
  type Student,
  useAssignTeacher,
  useBatch,
  useBatchStudents,
  useDeleteBatch,
  useEnrolStudent,
  useStudents,
  useTeachers,
  useUpdateBatch,
  useWithdrawStudent,
} from '@/lib/academics';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useRemoveTeacherFromBatch } from '@/lib/teachers';
import { useApiError } from '@/lib/use-api-error';
import { BatchFormDialog } from './batch-form-dialog';
import { ScheduleText } from './batches-page';

export function BatchDetail({ id }: { id: string }) {
  const t = useTranslations('Batches.detail');
  const batch = useBatch(id);

  const back = (
    <Link
      href="/app/batches"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('back')}
    </Link>
  );

  if (batch.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {back}
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  if (batch.isError) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <QueryError error={batch.error} onRetry={() => void batch.refetch()} />
      </div>
    );
  }
  return <BatchView batch={batch.data} back={back} />;
}

function BatchView({ batch, back }: { batch: Batch; back: ReactNode }) {
  const t = useTranslations('Batches');
  const common = useTranslations('Common');
  const user = useSession()?.user;
  const describeError = useApiError();
  const router = useRouter();
  const canManage = can(user, 'batches:update');
  const canDelete = can(user, 'batches:delete');
  const students = useBatchStudents(batch.id);
  const withdraw = useWithdrawStudent();
  const removeTeacher = useRemoveTeacherFromBatch();
  const update = useUpdateBatch(batch.id);
  const remove = useDeleteBatch();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [leaving, setLeaving] = useState<Student | null>(null);
  const teachers = batch.teachers ?? [];

  const confirmWithdraw = async () => {
    if (!leaving) return;
    const name = fullName(leaving);
    try {
      await withdraw.mutateAsync({ batchId: batch.id, studentId: leaving.id });
      toast.success(t('detail.withdrawn', { name, batch: batch.name }));
    } catch (error) {
      toast.error(describeError(error));
    }
    setLeaving(null);
  };

  const unassign = async (teacherId: string, name: string) => {
    try {
      await removeTeacher.mutateAsync({ batchId: batch.id, teacherId });
      toast.success(t('detail.teacherRemoved', { name }));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const setActive = async (isActive: boolean) => {
    try {
      await update.mutateAsync({ isActive });
      toast.success(
        t(isActive ? 'detail.reactivated' : 'detail.deactivated', { name: batch.name }),
      );
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  // A batch with students cannot be deleted; offer to mark it inactive instead
  const enrolled = students.data?.length ?? batch.activeStudentCount ?? 0;
  const deleteBatch = async () => {
    try {
      await remove.mutateAsync(batch.id);
      toast.success(t('detail.deleted', { name: batch.name }));
      router.replace('/app/batches');
    } catch (error) {
      toast.error(describeError(error));
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        title={batch.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {[batch.subject, batch.academicYear].filter(Boolean).join(' · ')}
            {!batch.isActive ? <Badge>{common('status.inactive')}</Badge> : null}
          </span>
        }
        actions={
          <>
            {canManage ? (
              <>
                <Button onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  {t('detail.addStudents')}
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden />
                  {t('detail.edit')}
                </Button>
                <Button
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => void setActive(!batch.isActive)}
                >
                  {batch.isActive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                  {t(batch.isActive ? 'detail.deactivate' : 'detail.reactivate')}
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                {t('detail.delete')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {t('detail.students')}
              {students.data ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({students.data.length})
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.isPending ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : students.isError ? (
              <QueryError error={students.error} onRetry={() => void students.refetch()} />
            ) : students.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noStudents')}</p>
            ) : (
              <ul className="divide-y">
                {[...students.data]
                  .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                  .map((student) => (
                    <li key={student.id} className="flex items-center gap-3 py-3">
                      <Link
                        href={`/app/students/${student.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                      >
                        {fullName(student)}
                        {student.rollNumber ? (
                          <span className="ml-2 font-normal text-muted-foreground">
                            {student.rollNumber}
                          </span>
                        ) : null}
                      </Link>
                      {canManage ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 text-muted-foreground"
                          aria-label={t('detail.withdrawTitle', {
                            name: fullName(student),
                            batch: batch.name,
                          })}
                          onClick={() => setLeaving(student)}
                        >
                          <UserMinus aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.schedule')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start gap-2 text-sm">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <ScheduleText batch={batch} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('detail.teachers')}</CardTitle>
              {canManage && can(user, 'teachers:read') ? (
                <Button size="sm" variant="ghost" onClick={() => setAssigning(true)}>
                  <Plus aria-hidden />
                  {t('detail.assignTeacher')}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTeacher')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {teachers.map((teacher) => (
                    <li key={teacher.teacherId} className="flex items-center gap-2 text-sm">
                      <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{teacher.teacherName}</span>
                      {canManage ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          disabled={removeTeacher.isPending}
                          aria-label={t('detail.removeTeacher', { name: teacher.teacherName })}
                          onClick={() => void unassign(teacher.teacherId, teacher.teacherName)}
                        >
                          <X aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BatchFormDialog open={editing} onOpenChange={setEditing} batch={batch} />
      {enrolled > 0 ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('detail.deleteTitle', { name: batch.name })}
          description={t('detail.deleteBlocked', { count: enrolled })}
          confirmLabel={batch.isActive && canManage ? t('detail.deactivate') : common('close')}
          cancelLabel={common('cancel')}
          onConfirm={() => {
            setConfirmDelete(false);
            if (batch.isActive && canManage) void setActive(false);
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('detail.deleteTitle', { name: batch.name })}
          description={t('detail.deleteBody')}
          confirmLabel={t('detail.delete')}
          cancelLabel={common('cancel')}
          onConfirm={() => void deleteBatch()}
          pending={remove.isPending}
          destructive
        />
      )}
      <AddStudentsDialog
        open={adding}
        onOpenChange={setAdding}
        batch={batch}
        enrolledIds={new Set((students.data ?? []).map((student) => student.id))}
      />
      <AssignTeacherDialog
        open={assigning}
        onOpenChange={setAssigning}
        batch={batch}
        assignedIds={teachers.map((teacher) => teacher.teacherId)}
      />
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => !open && setLeaving(null)}
        title={
          leaving ? t('detail.withdrawTitle', { name: fullName(leaving), batch: batch.name }) : ''
        }
        description={t('detail.withdrawBody')}
        confirmLabel={common('remove')}
        cancelLabel={common('cancel')}
        onConfirm={() => void confirmWithdraw()}
        pending={withdraw.isPending}
        destructive
      />
    </div>
  );
}

/** Search the institute's students and add them one by one, without leaving the dialog */
function AddStudentsDialog({
  open,
  onOpenChange,
  batch,
  enrolledIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
  enrolledIds: Set<string>;
}) {
  const t = useTranslations('Batches.detail');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const [search, setSearch] = useState('');
  const results = useStudents({ search, status: 'active', page: 1 });
  const enrol = useEnrolStudent();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const add = async (student: Student) => {
    setPendingId(student.id);
    try {
      await enrol.mutateAsync({ batchId: batch.id, studentId: student.id });
    } catch (error) {
      toast.error(describeError(error));
    }
    setPendingId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('addStudents')}
      closeLabel={common('close')}
    >
      <div className="flex flex-col gap-4">
        <SearchInput
          value={search}
          onSearch={setSearch}
          label={t('addStudentsSearch')}
          placeholder={t('addStudentsSearch')}
          clearLabel={common('clearSearch')}
        />
        {results.isPending ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : results.isError ? (
          <QueryError error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noResults')}</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y overflow-y-auto">
            {results.data.items.map((student) => {
              const inBatch = enrolledIds.has(student.id);
              return (
                <li key={student.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{fullName(student)}</span>
                    {student.rollNumber || student.phone ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[student.rollNumber, student.phone].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  {inBatch ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Check className="size-3.5" aria-hidden />
                      {t('alreadyIn')}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId !== null}
                      aria-label={`${t('add')} ${fullName(student)}`}
                      onClick={() => void add(student)}
                    >
                      <Plus aria-hidden />
                      {t('add')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function AssignTeacherDialog({
  open,
  onOpenChange,
  batch,
  assignedIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
  assignedIds: string[];
}) {
  const t = useTranslations('Batches.detail');
  const common = useTranslations('Common');
  const describeError = useApiError();
  const teachers = useTeachers(open);
  const assign = useAssignTeacher();
  const [teacherId, setTeacherId] = useState('');
  const available = (teachers.data ?? []).filter(
    (teacher) => teacher.isActive && !assignedIds.includes(teacher.id),
  );

  const submit = async () => {
    const teacher = available.find((item) => item.id === teacherId);
    if (!teacher) return;
    try {
      await assign.mutateAsync({ batchId: batch.id, teacherId });
      toast.success(t('teacherAssigned', { name: teacher.name }));
      setTeacherId('');
      onOpenChange(false);
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('assignTeacher')}
      closeLabel={common('close')}
    >
      <div className="flex flex-col gap-4">
        <Select
          aria-label={t('pickTeacher')}
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
        >
          <option value="">{t('chooseTeacher')}</option>
          {available.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.specialization
                ? `${teacher.name} · ${teacher.specialization}`
                : teacher.name}
            </option>
          ))}
        </Select>
        <Button size="lg" disabled={!teacherId || assign.isPending} onClick={() => void submit()}>
          <Users aria-hidden />
          {t('assignTeacher')}
        </Button>
      </div>
    </Dialog>
  );
}
