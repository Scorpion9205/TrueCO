'use client';

import { ArrowLeft, Loader2, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryError } from '@/components/dashboard/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { fullName, type Student, useBatchStudents } from '@/lib/academics';
import {
  hasPassed,
  type MarkEntry,
  type Test,
  useDeleteTest,
  useSaveMarks,
  useTest,
} from '@/lib/assessments';
import { can } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatDate } from '@/lib/format';
import { useApiError } from '@/lib/use-api-error';
import { cn } from '@/lib/utils';
import { TestFormDialog } from './test-form-dialog';
import { formatMarks } from './tests-page';

export function TestDetail({ id }: { id: string }) {
  const t = useTranslations('Tests.detail');
  const test = useTest(id);

  const back = (
    <Link
      href="/app/tests"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('back')}
    </Link>
  );

  if (test.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {back}
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (test.isError) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <QueryError error={test.error} onRetry={() => void test.refetch()} />
      </div>
    );
  }
  return <TestView test={test.data} back={back} />;
}

function TestView({ test, back }: { test: Test; back: ReactNode }) {
  const t = useTranslations('Tests');
  const common = useTranslations('Common');
  const router = useRouter();
  const describeError = useApiError();
  const canEdit = can(useSession()?.user, 'tests:create');
  const students = useBatchStudents(test.batchId);
  const remove = useDeleteTest();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const results = test.results ?? [];
  const sat = results.filter((result) => !result.isAbsent);
  const passedCount =
    test.passingMarks === null || test.passingMarks === undefined
      ? null
      : sat.filter((result) => result.marksObtained >= test.passingMarks!).length;

  const deleteTest = async () => {
    try {
      await remove.mutateAsync(test.id);
      toast.success(t('detail.deleted', { name: test.title }));
      router.replace(`/app/tests?batch=${test.batchId}`);
    } catch (error) {
      setConfirmDelete(false);
      toast.error(describeError(error));
    }
  };

  const stats: Array<[string, string]> = [
    [
      t('detail.stats.average'),
      test.averageScore === undefined ? t('detail.stats.none') : formatMarks(test.averageScore),
    ],
    [
      t('detail.stats.highest'),
      test.highestScore === undefined ? t('detail.stats.none') : formatMarks(test.highestScore),
    ],
    [
      t('detail.stats.passRate'),
      passedCount === null || sat.length === 0
        ? t('detail.stats.none')
        : `${passedCount}/${sat.length}`,
    ],
    [t('detail.stats.entered'), String(results.length)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        title={test.title}
        subtitle={[
          test.subject,
          formatDate(test.testDate),
          t('totalOf', { total: formatMarks(test.totalMarks) }),
          test.passingMarks ? `${t('form.passingMarks')} ${formatMarks(test.passingMarks)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          canEdit ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                {t('detail.edit')}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                {t('detail.delete')}
              </Button>
            </>
          ) : null
        }
      />

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-card">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="marks-title" className="flex flex-col gap-4">
        <h2 id="marks-title" className="text-lg font-bold">
          {t('detail.marks')}
        </h2>
        {students.isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : students.isError ? (
          <QueryError error={students.error} onRetry={() => void students.refetch()} />
        ) : (
          <MarksSheet
            key={`${test.id}:${test.totalMarks}:${results.length}`}
            test={test}
            students={students.data}
            readOnly={!canEdit}
          />
        )}
      </section>

      <TestFormDialog open={editing} onOpenChange={setEditing} test={test} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('detail.deleteTitle', { name: test.title })}
        description={t('detail.deleteBody')}
        confirmLabel={t('detail.delete')}
        cancelLabel={common('cancel')}
        onConfirm={() => void deleteTest()}
        pending={remove.isPending}
        destructive
      />
    </div>
  );
}

interface Row {
  studentId: string;
  name: string;
  formerMember: boolean;
}

interface Entry {
  /** As typed, so "37." mid-typing is not lost; blank means not entered */
  marks: string;
  absent: boolean;
}

/** Current batch members plus anyone who already has a result, by name */
export function buildMarksRows(students: Student[], test: Test): Row[] {
  const rows = new Map<string, Row>();
  for (const student of students) {
    rows.set(student.id, { studentId: student.id, name: fullName(student), formerMember: false });
  }
  for (const result of test.results ?? []) {
    if (!rows.has(result.studentId)) {
      rows.set(result.studentId, {
        studentId: result.studentId,
        name: result.studentName,
        formerMember: true,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A typed mark that can be saved: a number from 0 to the total */
export function parseMark(value: string, totalMarks: number): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= totalMarks ? n : null;
}

/** Rows to send: absent students, and those with a valid mark; blanks are left out */
export function entriesToSave(entries: Record<string, Entry>, totalMarks: number): MarkEntry[] {
  return Object.entries(entries).flatMap(([studentId, entry]): MarkEntry[] => {
    if (entry.absent) return [{ studentId, marksObtained: 0, isAbsent: true }];
    const marks = parseMark(entry.marks, totalMarks);
    return marks === null ? [] : [{ studentId, marksObtained: marks, isAbsent: false }];
  });
}

function MarksSheet({
  test,
  students,
  readOnly,
}: {
  test: Test;
  students: Student[];
  readOnly: boolean;
}) {
  const t = useTranslations('Tests.detail');
  const describeError = useApiError();
  const save = useSaveMarks(test.id);
  const rows = useMemo(() => buildMarksRows(students, test), [students, test]);
  const saved = useMemo(() => {
    const byStudent = new Map((test.results ?? []).map((result) => [result.studentId, result]));
    return Object.fromEntries(
      rows.map((row): [string, Entry] => {
        const result = byStudent.get(row.studentId);
        return [
          row.studentId,
          {
            marks: result && !result.isAbsent ? formatMarks(result.marksObtained) : '',
            absent: result?.isAbsent ?? false,
          },
        ];
      }),
    );
  }, [rows, test.results]);
  const [entries, setEntries] = useState(saved);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const invalid = rows.filter((row) => {
    const entry = entries[row.studentId];
    return (
      entry &&
      !entry.absent &&
      entry.marks.trim() !== '' &&
      parseMark(entry.marks, test.totalMarks) === null
    );
  });
  const dirty = rows.some(
    (row) =>
      entries[row.studentId]?.marks !== saved[row.studentId]?.marks ||
      entries[row.studentId]?.absent !== saved[row.studentId]?.absent,
  );
  const toSave = entriesToSave(entries, test.totalMarks);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noStudents')}</p>;
  }

  const update = (studentId: string, change: Partial<Entry>) =>
    setEntries((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { marks: '', absent: false }), ...change },
    }));

  const submit = async () => {
    try {
      await save.mutateAsync(toSave);
      toast.success(t('saved'));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
        {rows.map((row, index) => {
          const entry = entries[row.studentId] ?? { marks: '', absent: false };
          const marks = parseMark(entry.marks, test.totalMarks);
          const tooHigh = !entry.absent && entry.marks.trim() !== '' && marks === null;
          const passed =
            entry.absent || marks !== null
              ? hasPassed(marks ?? 0, entry.absent, test.passingMarks)
              : null;
          return (
            <li
              key={row.studentId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-medium">{row.name}</p>
                {row.formerMember ? (
                  <p className="text-xs text-muted-foreground">{t('notEnrolled')}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={(element) => {
                        inputs.current[index] = element;
                      }}
                      aria-label={t('marksFor', { name: row.name })}
                      aria-invalid={tooHigh || undefined}
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-10 w-20 text-right tabular-nums"
                      value={entry.absent ? '' : entry.marks}
                      disabled={readOnly || entry.absent}
                      onChange={(event) => update(row.studentId, { marks: event.target.value })}
                      onKeyDown={(event) => {
                        // Enter moves down the list, like a register
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          inputs.current[index + 1]?.focus();
                        }
                      }}
                    />
                    <span className="w-12 text-sm text-muted-foreground tabular-nums">
                      / {formatMarks(test.totalMarks)}
                    </span>
                  </div>
                  {tooHigh ? (
                    <span className="text-xs text-destructive">
                      {t('tooHigh', { total: formatMarks(test.totalMarks) })}
                    </span>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={t('absentFor', { name: row.name })}
                    checked={entry.absent}
                    disabled={readOnly}
                    onChange={(event) => update(row.studentId, { absent: event.target.checked })}
                  />
                  <span aria-hidden>{t('absent')}</span>
                </label>
                <span className="w-12 text-right">
                  {passed === null ? null : (
                    <Badge tone={passed ? 'success' : 'danger'}>
                      {passed ? t('pass') : t('fail')}
                    </Badge>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {readOnly ? null : (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:shadow-float">
          <div className="text-sm">
            <p className="font-semibold tabular-nums" aria-live="polite">
              {t('filled', { filled: toSave.length, total: rows.length })}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5 text-whatsapp" aria-hidden />
              {t('parentsNotified')} {toSave.length < rows.length ? t('blankSkipped') : null}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dirty ? <span className="text-xs text-warning">{t('unsaved')}</span> : null}
            <Button
              size="lg"
              className={cn('w-full sm:w-auto')}
              disabled={!dirty || invalid.length > 0 || toSave.length === 0 || save.isPending}
              aria-busy={save.isPending}
              onClick={() => void submit()}
            >
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {save.isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
